package com.hermes.backend.auth.mfa;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "admin_mfa_profile")
public class AdminMfaProfile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long runnerId;

    @Column(nullable = false, unique = true, length = 128)
    private String userHandleB64;

    private LocalDateTime bootstrapCompletedAt;
    private LocalDateTime recoveryCodesIssuedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public Long getRunnerId() { return runnerId; }
    public void setRunnerId(Long runnerId) { this.runnerId = runnerId; }
    public String getUserHandleB64() { return userHandleB64; }
    public void setUserHandleB64(String userHandleB64) { this.userHandleB64 = userHandleB64; }
    public LocalDateTime getBootstrapCompletedAt() { return bootstrapCompletedAt; }
    public void setBootstrapCompletedAt(LocalDateTime bootstrapCompletedAt) { this.bootstrapCompletedAt = bootstrapCompletedAt; }
    public LocalDateTime getRecoveryCodesIssuedAt() { return recoveryCodesIssuedAt; }
    public void setRecoveryCodesIssuedAt(LocalDateTime recoveryCodesIssuedAt) { this.recoveryCodesIssuedAt = recoveryCodesIssuedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
