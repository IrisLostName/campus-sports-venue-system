package com.campus.venue.common.error;

import com.fasterxml.jackson.databind.JsonMappingException;
import java.util.stream.Collectors;

/** Jackson 异常中的字段路径，如 displayName、items[0].name；没有路径（裸值请求体等）时为空串。 */
final class JsonFieldPath {

    private JsonFieldPath() {
    }

    static String of(JsonMappingException ex) {
        String path = ex.getPath().stream().map(JsonFieldPath::segment).collect(Collectors.joining());
        return path.startsWith(".") ? path.substring(1) : path;
    }

    private static String segment(JsonMappingException.Reference reference) {
        return reference.getFieldName() != null ? "." + reference.getFieldName()
                : "[" + reference.getIndex() + "]";
    }
}
