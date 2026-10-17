package com.campus.venue.common.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.query.QueryUtils;
import org.springframework.stereotype.Component;

/**
 * 按 Specification 取一页（BE-6 各管理端列表）：只发一条带 ORDER BY、OFFSET、LIMIT 的查询，不附带计数
 * （计数由调用方经 JpaSpecificationExecutor.count 单独发出，配合 DatabasePaging）。
 * Spring Data 的 findAll(spec, pageable) 会视结果条数决定是否再计数，查询次数不固定，所以不用它。
 */
@Component
public class SpecificationPages {

    @PersistenceContext
    private EntityManager entityManager;

    public <E> List<E> find(Class<E> type, Specification<E> spec, Pageable page) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<E> query = cb.createQuery(type);
        Root<E> root = query.from(type);
        query.select(root);
        Predicate predicate = spec.toPredicate(root, query, cb);
        if (predicate != null) {
            query.where(predicate);
        }
        query.orderBy(QueryUtils.toOrders(page.getSort(), root, cb));
        // 偏移量已由 DatabasePaging 限制在 int 范围内
        return entityManager.createQuery(query)
                .setFirstResult((int) page.getOffset())
                .setMaxResults(page.getPageSize())
                .getResultList();
    }
}
