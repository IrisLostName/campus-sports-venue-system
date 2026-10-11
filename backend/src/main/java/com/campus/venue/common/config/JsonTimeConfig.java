package com.campus.venue.common.config;

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
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * JSON 时间格式（docs/12 第 1 节）：日期 yyyy-MM-dd、时间 HH:mm、
 * 时间戳 yyyy-MM-dd'T'HH:mm:ss（不带偏移，秒为 0 时也输出秒）。
 * Jackson 默认会省略整点时间戳的秒，所以必须显式指定格式。
 */
@Configuration(proxyBeanMethods = false)
public class JsonTimeConfig {

    static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");
    static final DateTimeFormatter TIMESTAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer jsonTimeCustomizer() {
        return builder -> builder
                .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .serializers(new LocalDateSerializer(DATE),
                        new LocalTimeSerializer(TIME),
                        new LocalDateTimeSerializer(TIMESTAMP))
                .deserializerByType(LocalDate.class, new LocalDateDeserializer(DATE))
                .deserializerByType(LocalTime.class, new LocalTimeDeserializer(TIME))
                .deserializerByType(LocalDateTime.class, new LocalDateTimeDeserializer(TIMESTAMP));
    }
}
