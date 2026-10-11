package com.campus.venue.reservation.service;

import com.campus.venue.common.config.BookingProperties;
import com.campus.venue.reservation.dto.BookingRules;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** 对外提供预约参数（BE-1 A4）：slotMinutes 固定 90；其余取 BOOKING_* 配置；timezone 为 APP_TIMEZONE。 */
@Service
public class BookingRulesService {

    /** 时段长度固定 90 分钟，不可配置（docs/03 第 4.3 节）。 */
    public static final int SLOT_MINUTES = 90;

    private final BookingProperties properties;
    private final String timezone;

    public BookingRulesService(BookingProperties properties, @Value("${app.timezone}") String timezone) {
        this.properties = properties;
        this.timezone = timezone;
    }

    public BookingRules rules() {
        return new BookingRules(SLOT_MINUTES,
                properties.advanceDays(),
                properties.cancelDeadlineMinutes(),
                properties.checkinOpenBeforeMinutes(),
                properties.checkinCloseAfterMinutes(),
                properties.checkoutGraceMinutes(),
                properties.maxActivePerUser(),
                timezone);
    }
}
