package com.campus.venue.stats.controller;

import com.campus.venue.common.ApiPaths;
import com.campus.venue.stats.dto.DisplaySummary;
import com.campus.venue.stats.service.DisplaySummaryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 运营大屏（docs/12 第 5.10 节，BE-7 D1）：公开接口（已列入 PublicEndpoints，忽略 Authorization 头），
 * 无参数、无检查，只读；前端每 30 秒轮询。
 */
@RestController
@RequestMapping(ApiPaths.BASE + "/display")
public class DisplayController {

    private final DisplaySummaryService summaryService;

    public DisplayController(DisplaySummaryService summaryService) {
        this.summaryService = summaryService;
    }

    /** 返回 DisplaySummary，不含任何个人信息。 */
    @GetMapping("/summary")
    public DisplaySummary summary() {
        return summaryService.summary();
    }
}
