package com.campus.venue.user.dto;

import jakarta.validation.constraints.NotNull;
import java.util.List;

/** 整体替换授权场馆请求（docs/12 第 5.9 节，BE-6 U4）：venueIds 必填（可为空数组 = 全部撤销），元素须为正整数。 */
public record SetVenueScopeRequest(
        @NotNull(message = "必填")
        @VenueIdList
        List<Long> venueIds) {
}
