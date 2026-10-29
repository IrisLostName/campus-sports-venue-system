package com.campus.venue.reservation.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import org.springframework.data.domain.Persistable;

/**
 * 同行人名单的一行（表 reservation_companion，docs/13 第 3.6a 节，P2-2b）：哪位用户随该预约同行，position 为提交顺序。
 * 实现 Persistable：新建的行直接 INSERT，不先按复合主键 SELECT（saveAll 不会逐行多一次查询）。
 */
@Entity
@Table(name = "reservation_companion")
@IdClass(ReservationCompanionId.class)
public class ReservationCompanion implements Persistable<ReservationCompanionId> {

    @Id
    @Column(name = "reservation_id", nullable = false)
    private Long reservationId;

    @Id
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "position", nullable = false)
    private short position;

    @Transient
    private boolean fresh = true;

    protected ReservationCompanion() {
    }

    public ReservationCompanion(long reservationId, long userId, int position) {
        this.reservationId = reservationId;
        this.userId = userId;
        this.position = (short) position;
    }

    @Override
    public ReservationCompanionId getId() {
        return new ReservationCompanionId(reservationId, userId);
    }

    @Override
    public boolean isNew() {
        return fresh;
    }

    @PostLoad
    @PostPersist
    void markStored() {
        fresh = false;
    }

    public Long getReservationId() {
        return reservationId;
    }

    public Long getUserId() {
        return userId;
    }

    public int getPosition() {
        return position;
    }
}
