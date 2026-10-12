package com.campus.venue.common.config;

import com.campus.venue.common.error.NulCharacterException;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdScalarDeserializer;
import com.fasterxml.jackson.databind.deser.std.StringDeserializer;
import com.fasterxml.jackson.databind.type.LogicalType;
import java.io.IOException;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * JSON 字符串统一拒绝 U+0000（BE-1 裁决第 14 节 F1）：对所有 String 值生效，以后的 DTO 无需逐字段加注解。
 * 换行、制表符等其他控制字符照常接收。
 */
@Configuration(proxyBeanMethods = false)
public class JsonStringConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer jsonStringCustomizer() {
        return builder -> builder.deserializerByType(String.class, new NulRejectingStringDeserializer());
    }

    /** 先按 Jackson 默认规则取得字符串，再检查 U+0000。 */
    static final class NulRejectingStringDeserializer extends StdScalarDeserializer<String> {

        private static final long serialVersionUID = 1L;

        NulRejectingStringDeserializer() {
            super(String.class);
        }

        @Override
        public String deserialize(JsonParser parser, DeserializationContext context) throws IOException {
            String value = StringDeserializer.instance.deserialize(parser, context);
            if (value != null && value.indexOf('\u0000') >= 0) {
                throw new NulCharacterException(parser);
            }
            return value;
        }

        @Override
        public LogicalType logicalType() {
            return LogicalType.Textual;
        }

        @Override
        public Object getEmptyValue(DeserializationContext context) {
            return "";
        }
    }
}
