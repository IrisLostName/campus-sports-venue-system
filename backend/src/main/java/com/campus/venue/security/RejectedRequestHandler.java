package com.campus.venue.security;

import com.campus.venue.common.error.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.web.firewall.RequestRejectedException;
import org.springframework.security.web.firewall.RequestRejectedHandler;
import org.springframework.stereotype.Component;

/** StrictHttpFirewall 拒绝的请求（如路径含分号、编码斜杠）→ 400 VALIDATION_ERROR（BE-1 裁决第 11 节第 5 条）。 */
@Component
public class RejectedRequestHandler implements RequestRejectedHandler {

    private final SecurityErrorWriter writer;

    public RejectedRequestHandler(SecurityErrorWriter writer) {
        this.writer = writer;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
            RequestRejectedException requestRejectedException) throws IOException {
        writer.write(response, ErrorCode.VALIDATION_ERROR);
    }
}
