package com.campus.venue.common.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalTimeSerializer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.ResolverStyle;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * JSON 时间格式（docs/12 第 1 节）：日期 yyyy-MM-dd、时间 HH:mm、
 * 时间戳 yyyy-MM-dd'T'HH:mm:ss（不带偏移，秒为 0 时也输出秒）。
 * 显式格式用于去掉小数秒（Clock 与 PostgreSQL TIMESTAMP 都带微秒）。
 * 反序列化一律严格解析（BE-3 裁决第 12 节）：2026-02-30、2026-1-5、24:00、8:00、缺秒的时间戳均拒绝；
 * 年份用 uuuu，STRICT 下 yyyy 缺纪元无法解析。小数不再被截成整数（关闭 ACCEPT_FLOAT_AS_INT）。
 */
@Configuration(proxyBeanMethods = false)
public class JsonTimeConfig {

    static final DateTimeFormatter DATE = strict("uuuu-MM-dd");
    static final DateTimeFormatter TIME = strict("HH:mm");
    static final DateTimeFormatter TIMESTAMP = strict("uuuu-MM-dd'T'HH:mm:ss");

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer jsonTimeCustomizer() {
        return builder -> builder
                .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS,
                        DeserializationFeature.ACCEPT_FLOAT_AS_INT)
                .serializers(new LocalDateSerializer(DATE),
                        new LocalTimeSerializer(TIME),
                        new LocalDateTimeSerializer(TIMESTAMP))
                .deserializerByType(LocalDate.class, new LocalDateDeserializer(DATE))
                .deserializerByType(LocalTime.class, new LocalTimeDeserializer(TIME))
                .deserializerByType(LocalDateTime.class, new LocalDateTimeDeserializer(TIMESTAMP));
    }

    private static DateTimeFormatter strict(String pattern) {
        return DateTimeFormatter.ofPattern(pattern).withResolverStyle(ResolverStyle.STRICT);
    }
}
