package com.campus.venue.reservation.service;

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 签到码的格式（docs/12 第 4 节 CheckInCode、第 5.7 节，P2-1b 裁决第 2 节）：{@code <check_in_uuid>.<reservationId>}。
 * 对客户端不透明；只含 URL 安全字符，至多 36 + 1 + 18 = 55 个字符。签发一律小写；解析时十六进制大小写都接受，
 * 按 UUID 值比较（P2-1b 裁决第 6 节第 7 条）。预约 id 为不带前导 0 的十进制，至多 18 位，解析不会溢出。
 * 码固定不变、不签名、不过期，只含随机签到标识与预约 id。
 */
public final class CheckInCodes {

    /** 整个签到码须匹配的正则（请求体校验与解析共用）。 */
    public static final String REGEXP = "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"
            + "\\.([1-9][0-9]{0,17})$";

    private static final Pattern PATTERN = Pattern.compile(REGEXP);

    private CheckInCodes() {
    }

    /** 解析结果：码中的签到标识与预约 id。 */
    public record Parsed(UUID checkInUuid, long reservationId) {
    }

    public static String format(UUID checkInUuid, long reservationId) {
        return checkInUuid.toString() + "." + reservationId;
    }

    /** 解析格式正确的签到码；格式不对时抛 IllegalArgumentException（格式已由请求体校验挡住，这里不可达）。 */
    public static Parsed parse(String code) {
        Matcher matcher = PATTERN.matcher(code == null ? "" : code);
        if (!matcher.matches()) {
            throw new IllegalArgumentException("签到码格式不正确");
        }
        return new Parsed(UUID.fromString(matcher.group(1)), Long.parseLong(matcher.group(2)));
    }
}
