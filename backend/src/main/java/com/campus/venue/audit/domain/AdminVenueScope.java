package com.campus.venue.audit.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 场馆管理员授权范围（表 admin_venue_scope，docs/13 第 3.9 节）。 */
@Entity
@Table(name = "admin_venue_scope")
public class AdminVenueScope {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "admin_id", nullable = false)
    private Long adminId;

    @Column(name = "venue_id", nullable = false)
    private Long venueId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    private VenueScopeStatus status = VenueScopeStatus.ACTIVE;

    @Column(name = "valid_from")
    private LocalDate validFrom;

    @Column(name = "valid_to")
    private LocalDate validTo;

    @Column(name = "granted_by", nullable = false)
    private Long grantedBy;

    @Column(name = "granted_at", nullable = false)
    private LocalDateTime grantedAt;

    public Long getId() {
        return id;
    }

    public Long getAdminId() {
        return adminId;
    }

    public void setAdminId(Long adminId) {
        this.adminId = adminId;
    }

    public Long getVenueId() {
        return venueId;
    }

    public void setVenueId(Long venueId) {
        this.venueId = venueId;
    }

    public VenueScopeStatus getStatus() {
        return status;
    }

    public void setStatus(VenueScopeStatus status) {
        this.status = status;
    }

    public LocalDate getValidFrom() {
        return validFrom;
    }

    public void setValidFrom(LocalDate validFrom) {
        this.validFrom = validFrom;
    }

    public LocalDate getValidTo() {
        return validTo;
    }

    public void setValidTo(LocalDate validTo) {
        this.validTo = validTo;
    }

    public Long getGrantedBy() {
        return grantedBy;
    }

    public void setGrantedBy(Long grantedBy) {
        this.grantedBy = grantedBy;
    }

    public LocalDateTime getGrantedAt() {
        return grantedAt;
    }

    public void setGrantedAt(LocalDateTime grantedAt) {
        this.grantedAt = grantedAt;
    }
}
