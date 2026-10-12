package com.campus.venue.availability.repository;

import com.campus.venue.availability.domain.AvailabilityRule;
import com.campus.venue.availability.domain.AvailabilityRuleStatus;
import com.campus.venue.availability.domain.AvailabilityRuleType;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 开放规则读取（docs/13 第 3.4 节）。调用方传入 WEEKLY/CLOSURE 与 ACTIVE。 */
public interface AvailabilityRuleRepository extends JpaRepository<AvailabilityRule, Long> {

    /** 某场馆某星期的每周窗口。 */
    List<AvailabilityRule> findByVenueIdAndRuleTypeAndStatusAndWeekday(Long venueId, AvailabilityRuleType ruleType,
            AvailabilityRuleStatus status, Short weekday);

    /** 覆盖某日期的特殊关闭（日期范围含两端）。 */
    @Query("select r from AvailabilityRule r where r.venueId = :venueId and r.ruleType = :ruleType"
            + " and r.status = :status and r.startDate <= :date and r.endDate >= :date")
    List<AvailabilityRule> findCovering(@Param("venueId") Long venueId, @Param("ruleType") AvailabilityRuleType ruleType,
            @Param("status") AvailabilityRuleStatus status, @Param("date") LocalDate date);

    /** 每周窗口列表，按星期、开始时间排序（与 mock activeWeekly 一致）。 */
    List<AvailabilityRule> findByVenueIdAndRuleTypeAndStatusOrderByWeekdayAscOpenTimeAsc(Long venueId,
            AvailabilityRuleType ruleType, AvailabilityRuleStatus status);

    /** 特殊关闭列表，按开始日期、再按 id 排序（与 mock activeClosures 一致）。 */
    List<AvailabilityRule> findByVenueIdAndRuleTypeAndStatusOrderByStartDateAscIdAsc(Long venueId,
            AvailabilityRuleType ruleType, AvailabilityRuleStatus status);
}
