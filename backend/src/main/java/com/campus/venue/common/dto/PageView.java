package com.campus.venue.common.dto;

import java.util.List;

/** 分页响应 Page&lt;T&gt;（docs/12 第 1 节）：page 从 1 起；页码超出范围时 items 为空、total 照实。 */
public record PageView<T>(List<T> items, int page, int pageSize, long total) {
}
