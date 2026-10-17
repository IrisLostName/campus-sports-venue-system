package com.campus.venue.reservation.repository;

import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.repository.AdminReservationFilter.StatusCondition;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.venue.domain.Resource;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Pageable;

/**
 * AdminReservationSearch 的 Criteria 实现（BE-5 A1）。每个方法一条 SQL：场馆范围、关键字均为子查询，
 * 不随结果条数增加查询次数。关键字以 lower(列) LIKE lower(模式) ESCAPE '\' 匹配，模式由服务层转义 %、_ 与反斜杠。
 * 字符串取值经 Hibernate 绑定为参数，不拼进 SQL。
 */
public class AdminReservationSearchImpl implements AdminReservationSearch {

    private static final char ESCAPE = '\\';

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public long countForAdmin(AdminReservationFilter filter) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Long> query = cb.createQuery(Long.class);
        Root<Reservation> root = query.from(Reservation.class);
        query.select(cb.count(root)).where(predicates(cb, query, root, filter));
        return entityManager.createQuery(query).getSingleResult();
    }

    @Override
    public List<Reservation> findForAdmin(AdminReservationFilter filter, Pageable page) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Reservation> query = cb.createQuery(Reservation.class);
        Root<Reservation> root = query.from(Reservation.class);
        query.select(root).where(predicates(cb, query, root, filter))
                .orderBy(cb.desc(root.get("serviceDate")), cb.desc(root.get("startTime")), cb.desc(root.get("id")));
        // 偏移量已由 DatabasePaging 限制在 int 范围内
        return entityManager.createQuery(query)
                .setFirstResult((int) page.getOffset())
                .setMaxResults(page.getPageSize())
                .getResultList();
    }

    @Override
    public List<Reservation> findStartedConfirmedForAdmin(AdminReservationFilter filter, LocalDate today,
            LocalTime nowTime) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Reservation> query = cb.createQuery(Reservation.class);
        Root<Reservation> root = query.from(Reservation.class);
        List<Predicate> list = new ArrayList<>(List.of(predicates(cb, query, root, filter.scopeOnly())));
        list.add(cb.equal(root.get("status"), ReservationStatus.CONFIRMED));
        Expression<LocalDate> date = root.get("serviceDate");
        list.add(cb.or(cb.lessThan(date, today),
                cb.and(cb.equal(date, today), cb.lessThanOrEqualTo(root.<LocalTime>get("startTime"), nowTime))));
        query.select(root).where(list.toArray(Predicate[]::new)).orderBy(cb.asc(root.get("id")));
        return entityManager.createQuery(query).getResultList();
    }

    private static Predicate[] predicates(CriteriaBuilder cb, CriteriaQuery<?> query, Root<Reservation> root,
            AdminReservationFilter filter) {
        List<Predicate> list = new ArrayList<>();
        if (filter.venueIds() != null) {
            Subquery<Long> resourceIds = query.subquery(Long.class);
            Root<Resource> resource = resourceIds.from(Resource.class);
            resourceIds.select(resource.get("id")).where(resource.get("venueId").in(filter.venueIds()));
            list.add(root.get("resourceId").in(resourceIds));
        }
        if (filter.dateFrom() != null) {
            list.add(cb.greaterThanOrEqualTo(root.get("serviceDate"), filter.dateFrom()));
        }
        if (filter.dateTo() != null) {
            list.add(cb.lessThanOrEqualTo(root.get("serviceDate"), filter.dateTo()));
        }
        if (filter.status() != null) {
            list.add(status(cb, root, filter.status()));
        }
        if (filter.keywordPattern() != null) {
            list.add(keyword(cb, query, root, filter.keywordPattern()));
        }
        return list.toArray(Predicate[]::new);
    }

    /** (status = stored 且 id 不在 exceptIds) 或 id 在 alsoIds；空集合不生成 IN。 */
    private static Predicate status(CriteriaBuilder cb, Root<Reservation> root, StatusCondition condition) {
        Predicate stored = cb.equal(root.get("status"), condition.stored());
        if (!condition.exceptIds().isEmpty()) {
            stored = cb.and(stored, cb.not(root.get("id").in(condition.exceptIds())));
        }
        if (!condition.alsoIds().isEmpty()) {
            stored = cb.or(stored, root.get("id").in(condition.alsoIds()));
        }
        return stored;
    }

    /** 用户名、姓名（app_user）或场地名（resource）任一包含关键字，不区分大小写。 */
    private static Predicate keyword(CriteriaBuilder cb, CriteriaQuery<?> query, Root<Reservation> root,
            String pattern) {
        Expression<String> lowered = cb.lower(cb.literal(pattern));
        Subquery<Long> byUser = query.subquery(Long.class);
        Root<AppUser> user = byUser.from(AppUser.class);
        byUser.select(user.get("id")).where(cb.equal(user.get("id"), root.get("userId")),
                cb.or(cb.like(cb.lower(user.get("username")), lowered, ESCAPE),
                        cb.like(cb.lower(user.get("displayName")), lowered, ESCAPE)));
        Subquery<Long> byResource = query.subquery(Long.class);
        Root<Resource> resource = byResource.from(Resource.class);
        byResource.select(resource.get("id")).where(cb.equal(resource.get("id"), root.get("resourceId")),
                cb.like(cb.lower(resource.get("name")), lowered, ESCAPE));
        return cb.or(cb.exists(byUser), cb.exists(byResource));
    }
}
