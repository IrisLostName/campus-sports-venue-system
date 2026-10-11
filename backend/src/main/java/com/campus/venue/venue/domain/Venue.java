package com.campus.venue.venue.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/** 场馆（表 venue，docs/13 第 3.2 节）。 */
@Entity
@Table(name = "venue")
public class Venue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 50)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "venue_type", nullable = false, length = 20)
    private VenueType venueType;

    @Column(name = "location", length = 100)
    private String location;

    @Column(name = "description", length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "operational_status", nullable = false, length = 10)
    private VenueStatus operationalStatus = VenueStatus.OPEN;

    @Column(name = "user_booking_enabled", nullable = false)
    private boolean userBookingEnabled;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public VenueType getVenueType() {
        return venueType;
    }

    public void setVenueType(VenueType venueType) {
        this.venueType = venueType;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public VenueStatus getOperationalStatus() {
        return operationalStatus;
    }

    public void setOperationalStatus(VenueStatus operationalStatus) {
        this.operationalStatus = operationalStatus;
    }

    public boolean isUserBookingEnabled() {
        return userBookingEnabled;
    }

    public void setUserBookingEnabled(boolean userBookingEnabled) {
        this.userBookingEnabled = userBookingEnabled;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
