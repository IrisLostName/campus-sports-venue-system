package com.campus.venue.reservation.controller;

import com.campus.venue.common.ApiPaths;
import com.campus.venue.reservation.dto.BookingRules;
import com.campus.venue.reservation.service.BookingRulesService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 预约参数（docs/12 第 5.1 节），公开接口。 */
@RestController
public class BookingRulesController {

    private final BookingRulesService bookingRulesService;

    public BookingRulesController(BookingRulesService bookingRulesService) {
        this.bookingRulesService = bookingRulesService;
    }

    @GetMapping(ApiPaths.BASE + "/config/booking-rules")
    public BookingRules bookingRules() {
        return bookingRulesService.rules();
    }
}
