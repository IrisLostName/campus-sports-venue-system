package com.campus.venue.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/** 自助找回密码的一次尝试（表 password_reset_attempt，docs/13 第 3.9a 节）。username 为请求中的原样字符串，不关联账号。 */
@Entity
@Table(name = "password_reset_attempt")
public class PasswordResetAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username", nullable = false, length = 32)
    private String username;

    @Column(name = "attempted_at", nullable = false)
    private LocalDateTime attemptedAt;

    @Column(name = "succeeded", nullable = false)
    private boolean succeeded;

    protected PasswordResetAttempt() {
    }

    public PasswordResetAttempt(String username, LocalDateTime attemptedAt, boolean succeeded) {
        this.username = username;
        this.attemptedAt = attemptedAt;
        this.succeeded = succeeded;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public LocalDateTime getAttemptedAt() {
        return attemptedAt;
    }

    public boolean isSucceeded() {
        return succeeded;
    }
}
