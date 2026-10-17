package com.campus.venue.announcement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

/**
 * 发布公告请求（docs/12 第 5.8 节，BE-6 N3）：scope 必填；VENUE 须带 venueId，SYSTEM 不应带；title ≤ 100、
 * content ≤ 2000，均非空白，按原样保存；expiresAt 可选，由全局 JSON 配置严格解析（yyyy-MM-ddTHH:mm:ss），
 * 不校验是否已过去（与 mock 一致，API-SYNC）。
 */
@VenueIdMatchesScope(systemAllowsVenueId = false)
public record CreateAnnouncementRequest(
        @NotNull(message = "必填")
        @Pattern(regexp = "SYSTEM|VENUE", message = "应为 SYSTEM/VENUE 之一")
        String scope,

        Long venueId,

        @NotBlank(message = "必填")
        @Size(max = 100, message = "不能超过 100 个字符")
        String title,

        @NotBlank(message = "必填")
        @Size(max = 2000, message = "不能超过 2000 个字符")
        String content,

        LocalDateTime expiresAt) implements ScopedVenueId {
}
