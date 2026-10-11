package com.campus.venue.security;

import com.campus.venue.common.error.ErrorBody;
import com.campus.venue.common.error.ErrorCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

/**
 * 过滤器层的错误输出（J5）：与 GlobalExceptionHandler 相同的 ErrorBody，不输出 WWW-Authenticate。
 * 只写状态、类型与正文，不清除已有响应头，因此 CorsFilter 先前加上的 CORS 头得以保留。
 */
@Component
public class SecurityErrorWriter {

    private final ObjectMapper objectMapper;

    public SecurityErrorWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void write(HttpServletResponse response, ErrorCode code) throws IOException {
        response.setStatus(code.getStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), ErrorBody.of(code, null));
    }
}
