package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.reservation.service.ReservationSweepJob;
import com.campus.venue.reservation.service.ReservationSweepService;
import com.campus.venue.reservation.service.ReservationSweepService.SweepResult;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.ApplicationContext;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * ACC-M3-09：每分钟幂等清扫（docs/10 第 8 节，BE-4 W1–W5、T4）。测试配置关闭定时触发，直接调用清扫服务并配合可调时钟。
 * 典型时段为今天 09:30–11:00：开始 + 15 分钟为 09:45:00（正好不置 NO_SHOW），结束为 11:00:00（正好置 COMPLETED）。
 */
@DisplayName("ACC-M3-09 定时清扫")
@ExtendWith(OutputCaptureExtension.class)
class ReservationSweepTest extends UsageApiTestBase {

    @Autowired
    private ReservationSweepService sweepService;

    @Autowired
    private ReservationRepository reservations;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private ApplicationContext context;

    private String updatedAt(long id) {
        return jdbc.queryForObject("select updated_at::text from reservation where id = ?", String.class, id);
    }

    @Test
    @DisplayName("ACC-M3-09 NO_SHOW 判定点：开始 + 15 分钟正好不置，多 1 秒置；updated_at 取时钟")
    void noShowBoundary() {
        long id = todaySlot(zhangsan);
        String before = updatedAt(id);

        clock.setLocal(today(9, 45, 0));
        assertThat(sweepService.sweep()).isEqualTo(new SweepResult(0, 0));
        assertThat(status(id)).isEqualTo("CONFIRMED");
        assertThat(updatedAt(id)).isEqualTo(before);

        clock.setLocal(today(9, 45, 1));
        assertThat(sweepService.sweep()).isEqualTo(new SweepResult(1, 0));
        assertThat(status(id)).isEqualTo("NO_SHOW");
        assertThat(updatedAt(id)).isEqualTo("2026-10-12 09:45:01");
    }

    @Test
    @DisplayName("ACC-M3-09 COMPLETED 判定点：结束前 1 秒不置，结束正好置；updated_at 取时钟")
    void completionBoundary() {
        long id = checkedIn(zhangsan, court1, TODAY, SLOT, today(9, 20, 0));

        clock.setLocal(today(10, 59, 59));
        assertThat(sweepService.sweep()).isEqualTo(new SweepResult(0, 0));
        assertThat(status(id)).isEqualTo("CONFIRMED");

        clock.setLocal(today(11, 0, 0));
        assertThat(sweepService.sweep()).isEqualTo(new SweepResult(0, 1));
        assertThat(status(id)).isEqualTo("COMPLETED");
        assertThat(updatedAt(id)).isEqualTo("2026-10-12 11:00:00");
    }

    @Test
    @DisplayName("ACC-M3-09 已签到未结束（含已签退）的不动；未开始的不动")
    void checkedInBeforeTheEndAndFutureAreUntouched() {
        long inUse = checkedIn(zhangsan, court1, TODAY, SLOT, today(9, 20, 0));
        long checkedOut = fixtures.reservation(lisi, court2, TODAY, SLOT, "CONFIRMED");
        fixtures.usage(checkedOut, today(9, 20, 0), today(10, 0, 0));
        long future = fixtures.reservation(zhangsan, court1, TOMORROW, SLOT, "CONFIRMED");
        clock.setLocal(today(10, 30, 0));

        assertThat(sweepService.sweep()).isEqualTo(new SweepResult(0, 0));

        assertThat(List.of(status(inUse), status(checkedOut), status(future)))
                .containsOnly("CONFIRMED");
    }

    @Test
    @DisplayName("ACC-M3-09 已取消、管理员取消与其他终态不动（状态与 updated_at 都不变）")
    void cancelledAndTerminalAreUntouched() {
        long cancelled = fixtures.reservation(zhangsan, court1, TODAY, "08:00", "CANCELLED");
        long adminCancelled = fixtures.reservation(lisi, court1, TODAY, "08:00", "ADMIN_CANCELLED");
        long noShow = fixtures.reservation(zhangsan, court2, TODAY, "08:00", "NO_SHOW");
        Map<Long, String> before = Map.of(cancelled, updatedAt(cancelled), adminCancelled,
                updatedAt(adminCancelled), noShow, updatedAt(noShow));
        clock.setLocal(today(12, 0, 0));

        assertThat(sweepService.sweep()).isEqualTo(new SweepResult(0, 0));

        assertThat(status(cancelled)).isEqualTo("CANCELLED");
        assertThat(status(adminCancelled)).isEqualTo("ADMIN_CANCELLED");
        assertThat(status(noShow)).isEqualTo("NO_SHOW");
        before.forEach((id, value) -> assertThat(updatedAt(id)).isEqualTo(value));
    }

    @Test
    @DisplayName("ACC-M3-09 幂等：连续运行两次，第二次零写入（状态与 updated_at 不再变化）")
    void secondRunWritesNothing() {
        long stale = fixtures.reservation(zhangsan, court1, TODAY, "08:00", "CONFIRMED");
        long ended = checkedIn(lisi, court2, TODAY, "08:00", today(7, 50, 0));
        clock.setLocal(today(10, 0, 0));

        assertThat(sweepService.sweep()).isEqualTo(new SweepResult(1, 1));
        clock.setLocal(today(10, 1, 0));
        assertThat(sweepService.sweep()).isEqualTo(new SweepResult(0, 0));

        assertThat(status(stale)).isEqualTo("NO_SHOW");
        assertThat(status(ended)).isEqualTo("COMPLETED");
        assertThat(updatedAt(stale)).isEqualTo("2026-10-12 10:00:00");
        assertThat(updatedAt(ended)).isEqualTo("2026-10-12 10:00:00");
    }

    @Test
    @DisplayName("ACC-M3-09 W2：落库语句带 status = CONFIRMED 条件，已被别处改掉（如已取消）的不覆盖")
    void settleDoesNotOverwriteRowsChangedElsewhere() {
        long cancelled = fixtures.reservation(zhangsan, court1, TODAY, "08:00", "CANCELLED");
        long confirmed = fixtures.reservation(lisi, court2, TODAY, "08:00", "CONFIRMED");
        LocalDateTime at = today(10, 0, 0);

        Integer updated = new TransactionTemplate(transactionManager).execute(status ->
                reservations.settleIfConfirmed(List.of(cancelled, confirmed), ReservationStatus.NO_SHOW, at));

        assertThat(updated).isEqualTo(1);
        assertThat(status(cancelled)).isEqualTo("CANCELLED");
        assertThat(status(confirmed)).isEqualTo("NO_SHOW");
    }

    @Test
    @DisplayName("ACC-M3-09 候选超过一批时逐批处理，全部落库")
    void moreCandidatesThanOneBatch() {
        List<String> starts = List.of("08:00", "09:30", "11:00", "12:30", "14:00", "15:30", "17:00", "18:30");
        int total = 0;
        for (int day = 1; day <= 13; day++) {
            for (String start : starts) {
                fixtures.reservation(zhangsan, court1, TODAY.minusDays(day), start, "CONFIRMED");
                fixtures.reservation(lisi, court2, TODAY.minusDays(day), start, "CONFIRMED");
                total += 2;
            }
        }

        assertThat(sweepService.sweep()).isEqualTo(new SweepResult(total, 0));

        assertThat(total).isGreaterThan(200);
        assertThat(jdbc.queryForObject("select count(*) from reservation where status = 'NO_SHOW'", Integer.class))
                .isEqualTo(total);
    }

    @Test
    @DisplayName("ACC-M3-09 W5：有变化时记录一行 INFO 日志（各置了多少条）")
    void logsTheCountsWhenSomethingChanged(CapturedOutput output) {
        todaySlot(zhangsan);
        clock.setLocal(today(10, 0, 0));

        sweepService.sweep();

        assertThat(output.getOut()).contains("预约清扫：置 NO_SHOW 1 条，置 COMPLETED 0 条");
    }

    @Test
    @DisplayName("ACC-M3-09 W4：测试配置关闭定时任务；任务被触发时执行清扫")
    void jobIsDisabledInTestsAndSweepsWhenRun() {
        assertThat(context.getBeansOfType(ReservationSweepJob.class)).isEmpty();
        long id = todaySlot(zhangsan);
        clock.setLocal(today(10, 0, 0));

        new ReservationSweepJob(sweepService).run();

        assertThat(status(id)).isEqualTo("NO_SHOW");
    }

    @Test
    @DisplayName("ACC-M3-09 W1、W4：任务缺省开启、可经 app.sweep.enabled=false 关闭，每分钟第 0 秒运行")
    void jobIsEnabledByDefaultAndRunsEveryMinute() throws Exception {
        ApplicationContextRunner runner = new ApplicationContextRunner()
                .withBean(ReservationSweepService.class, () -> sweepService)
                .withUserConfiguration(ReservationSweepJob.class);

        runner.run(started -> assertThat(started).hasSingleBean(ReservationSweepJob.class));
        runner.withPropertyValues("app.sweep.enabled=false")
                .run(started -> assertThat(started).doesNotHaveBean(ReservationSweepJob.class));
        assertThat(ReservationSweepJob.class.getMethod("run").getAnnotation(Scheduled.class).cron())
                .isEqualTo("0 * * * * *");
    }
}
