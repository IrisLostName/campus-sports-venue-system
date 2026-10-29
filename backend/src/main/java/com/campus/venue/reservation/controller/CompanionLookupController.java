package com.campus.venue.reservation.controller;

import com.campus.venue.common.ApiPaths;
import com.campus.venue.reservation.dto.Companion;
import com.campus.venue.reservation.service.CompanionLookupService;
import com.campus.venue.security.AuthenticatedUser;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 添加同行人时查找用户（docs/12 第 5.3 节，契约 v1.2）。放在预约包里：它只服务于同行人名单，返回体是 Companion。
 * 角色用方法级注解，参数校验先于角色检查（认证 → 格式 → 角色 → 业务）。
 */
@RestController
@RequestMapping(ApiPaths.BASE + "/users")
public class CompanionLookupController {

    private final CompanionLookupService lookupService;

    public CompanionLookupController(CompanionLookupService lookupService) {
        this.lookupService = lookupService;
    }

    /** q 非空白、按原值 ≤ 32；精确匹配用户名或手机号，恰好一个合格用户时返回，否则 NOT_FOUND。 */
    @GetMapping("/lookup")
    @PreAuthorize("hasRole('USER')")
    public Companion lookup(@AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam @NotBlank(message = "必填") @Size(max = 32, message = "不能超过 32 个字符") String q) {
        return lookupService.lookup(user, q);
    }
}
