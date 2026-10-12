package com.campus.venue.common.error;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import java.util.stream.Collectors;

/**
 * JSON 字符串值含 U+0000（BE-1 裁决第 14 节 F1）。PostgreSQL 文本类型不能存它，所以在反序列化时统一拒绝。
 * Jackson 在抛出途中为它补上字段路径，GlobalExceptionHandler 据此在 details.fields 中指明字段。
 */
public class NulCharacterException extends MismatchedInputException {

    private static final long serialVersionUID = 1L;

    public NulCharacterException(JsonParser parser) {
        super(parser, "字符串不能包含 U+0000", String.class);
    }

    /** 字段路径，如 displayName、items[0].name；没有路径时为空串。 */
    public String fieldPath() {
        return getPath().stream().map(NulCharacterException::segment).collect(Collectors.joining())
                .replaceFirst("^\\.", "");
    }

    private static String segment(JsonMappingException.Reference reference) {
        return reference.getFieldName() != null ? "." + reference.getFieldName()
                : "[" + reference.getIndex() + "]";
    }
}
