package com.campus.venue.reservation.domain;

import java.io.Serializable;
import java.util.Objects;

/** reservation_companion 的复合主键 (reservation_id, user_id)。 */
public class ReservationCompanionId implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long reservationId;
    private Long userId;

    protected ReservationCompanionId() {
    }

    public ReservationCompanionId(Long reservationId, Long userId) {
        this.reservationId = reservationId;
        this.userId = userId;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof ReservationCompanionId id && Objects.equals(reservationId, id.reservationId)
                && Objects.equals(userId, id.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(reservationId, userId);
    }
}
