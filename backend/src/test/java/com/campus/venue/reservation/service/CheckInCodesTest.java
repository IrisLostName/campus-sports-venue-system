package com.campus.venue.reservation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.campus.venue.reservation.service.CheckInCodes.Parsed;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** P2-1b 裁决第 2 节、第 6 节第 7 条：签到码 {@code <check_in_uuid>.<reservationId>} 的签发格式与解析。 */
@DisplayName("ACC-M3-05 签到码格式")
class CheckInCodesTest {

    private static final String UUID_TEXT = "3f2a9c4e-1b7d-4e2f-9a10-5c6d7e8f9a0b";

    @Test
    @DisplayName("签发为小写 UUID + '.' + 预约 id，可原样解析回来，且只含 URL 安全字符、不超过 100 个字符")
    void formatRoundTrips() {
        UUID uuid = UUID.fromString(UUID_TEXT.toUpperCase());
        String code = CheckInCodes.format(uuid, 42);

        assertThat(code).isEqualTo(UUID_TEXT + ".42").matches("[A-Za-z0-9._~-]+").hasSizeLessThanOrEqualTo(100);
        assertThat(CheckInCodes.parse(code)).isEqualTo(new Parsed(uuid, 42));
        String longest = CheckInCodes.format(uuid, 999_999_999_999_999_999L);
        assertThat(longest).hasSize(55);
        assertThat(CheckInCodes.parse(longest).reservationId()).isEqualTo(999_999_999_999_999_999L);
    }

    @Test
    @DisplayName("十六进制大小写都接受，按 UUID 值比较")
    void upperCaseHexIsAccepted() {
        assertThat(CheckInCodes.parse(UUID_TEXT.toUpperCase() + ".7"))
                .isEqualTo(new Parsed(UUID.fromString(UUID_TEXT), 7));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", UUID_TEXT, UUID_TEXT + ".", UUID_TEXT + ".0", UUID_TEXT + ".012",
        UUID_TEXT + ".-1", UUID_TEXT + ".1.2", UUID_TEXT + ".1 ", " " + UUID_TEXT + ".1", UUID_TEXT + "x.1",
        UUID_TEXT + ".1234567890123456789", "3f2a9c4e1b7d4e2f9a105c6d7e8f9a0b.1", "3f2a9c4e-1b7d-4e2f-9a10-5c6d7e8f9a0g.1",
        "{3f2a9c4e-1b7d-4e2f-9a10-5c6d7e8f9a0b}.1", ".1"})
    @DisplayName("格式不对的码不匹配正则，解析抛 IllegalArgumentException")
    void malformedCodesAreRejected(String code) {
        assertThat(code).doesNotMatch(CheckInCodes.REGEXP);
        assertThatThrownBy(() -> CheckInCodes.parse(code)).isInstanceOf(IllegalArgumentException.class);
    }
}
