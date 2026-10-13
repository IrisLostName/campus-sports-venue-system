package com.campus.venue.reservation.service;

import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.domain.UsageRecord;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.reservation.repository.UsageRecordRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 每分钟清扫的落库逻辑（docs/10 第 8 节，BE-4 W1–W5，ACC-M3-09）：把已越过判定点的 CONFIRMED 预约置为 NO_SHOW 或
 * COMPLETED。判定只用 DisplayStatusCalculator 的 noShowDue、completionDue（BE-4 G7），与读取接口的有效状态一致。
 * 候选只取已开始的 CONFIRMED 预约，按 id 分批、每批一个事务并锁定该批预约行；更新语句带 status = CONFIRMED 条件，
 * 重复运行不产生额外写入。系统动作，不写 ADMIN_OPERATION_LOG（W3）。定时触发见 ReservationSweepJob。
 */
@Service
public class ReservationSweepService {

    /** 每批（每个事务）最多处理的候选预约数。 */
    static final int BATCH_SIZE = 200;

    private static final Logger LOG = LoggerFactory.getLogger(ReservationSweepService.class);

    private final ReservationRepository reservations;
    private final UsageRecordRepository usageRecords;
    private final DisplayStatusCalculator calculator;
    private final TransactionTemplate transactions;
    private final Clock clock;

    public ReservationSweepService(ReservationRepository reservations, UsageRecordRepository usageRecords,
            DisplayStatusCalculator calculator, PlatformTransactionManager transactionManager, Clock clock) {
        this.reservations = reservations;
        this.usageRecords = usageRecords;
        this.calculator = calculator;
        this.transactions = new TransactionTemplate(transactionManager);
        this.clock = clock;
    }

    /** 一次清扫的结果：本次置为 NO_SHOW、COMPLETED 的条数。 */
    public record SweepResult(int noShow, int completed) {

        SweepResult plus(SweepResult other) {
            return new SweepResult(noShow + other.noShow, completed + other.completed);
        }
    }

    /** 一批的处理结果：本批最后一个候选的 id、本批是否取满（取满则可能还有下一批）。 */
    private record Batch(long lastId, boolean full, SweepResult result) {
    }

    /** 清扫一次：“现在”只取一次 Clock；逐批处理直到候选取尽。每次运行记录一行日志（W5）。 */
    public SweepResult sweep() {
        LocalDateTime now = LocalDateTime.now(clock);
        SweepResult total = new SweepResult(0, 0);
        long afterId = 0;
        Batch batch;
        do {
            long from = afterId;
            batch = transactions.execute(status -> sweepBatch(from, now));
            total = total.plus(batch.result());
            afterId = batch.lastId();
        } while (batch.full());
        if (total.noShow() + total.completed() > 0) {
            LOG.info("预约清扫：置 NO_SHOW {} 条，置 COMPLETED {} 条", total.noShow(), total.completed());
        } else {
            LOG.debug("预约清扫：无变化");
        }
        return total;
    }

    /** 在一个事务内：锁定一批候选，按判定点分组，条件更新落库。 */
    private Batch sweepBatch(long afterId, LocalDateTime now) {
        List<Reservation> candidates = reservations.lockStartedConfirmed(afterId, now.toLocalDate(),
                now.toLocalTime(), PageRequest.of(0, BATCH_SIZE));
        if (candidates.isEmpty()) {
            return new Batch(afterId, false, new SweepResult(0, 0));
        }
        // 锁定之后再读使用记录：并发签到要么已提交（这里能看到），要么在等本批的行锁
        Map<Long, UsageRecord> usage = usageRecords.mapByReservationId(
                candidates.stream().map(Reservation::getId).toList());
        List<Long> noShow = new ArrayList<>();
        List<Long> completed = new ArrayList<>();
        for (Reservation reservation : candidates) {
            UsageRecord record = usage.get(reservation.getId());
            if (calculator.noShowDue(reservation, record, now)) {
                noShow.add(reservation.getId());
            } else if (calculator.completionDue(reservation, record, now)) {
                completed.add(reservation.getId());
            }
        }
        LocalDateTime at = now.truncatedTo(ChronoUnit.MICROS);
        SweepResult result = new SweepResult(settle(noShow, ReservationStatus.NO_SHOW, at),
                settle(completed, ReservationStatus.COMPLETED, at));
        long lastId = candidates.get(candidates.size() - 1).getId();
        return new Batch(lastId, candidates.size() == BATCH_SIZE, result);
    }

    private int settle(Collection<Long> ids, ReservationStatus target, LocalDateTime at) {
        return ids.isEmpty() ? 0 : reservations.settleIfConfirmed(ids, target, at);
    }
}
