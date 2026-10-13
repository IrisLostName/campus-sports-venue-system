package com.campus.venue.common.dto;

import java.util.List;
import java.util.function.Function;
import java.util.function.LongSupplier;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * 数据库分页（docs/12 第 1 节）：偏移量按 long 计算；偏移超出 int 或不小于总数时不发分页查询，只计数并返回空页
 * （items 为空、total 照实）。避免超大页码使偏移超出 Integer.MAX_VALUE 而 500（BE-3 审计 F1）。
 */
public final class DatabasePaging {

    private DatabasePaging() {
    }

    /**
     * 先计数，页码在范围内时再按 page、pageSize、sort 查询本页并转换为视图。
     *
     * @param count 总数查询
     * @param query 本页查询（不计数）
     * @param toViews 实体到视图的转换
     */
    public static <E, V> PageView<V> page(int page, int pageSize, Sort sort, LongSupplier count,
            Function<Pageable, List<E>> query, Function<List<E>, List<V>> toViews) {
        long total = count.getAsLong();
        long offset = (long) (page - 1) * pageSize;
        if (offset > Integer.MAX_VALUE || offset >= total) {
            return new PageView<>(List.of(), page, pageSize, total);
        }
        List<E> items = query.apply(PageRequest.of(page - 1, pageSize, sort));
        return new PageView<>(toViews.apply(items), page, pageSize, total);
    }
}
