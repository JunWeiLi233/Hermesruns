package com.hermes.backend.auth.mfa;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "admin_mfa_challenge")
public class AdminMfaChallenge {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String selectorHash;

    @Column(nullable = false)
    private Long runnerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AdminMfaPurpose purpose;

    @Column(nullable = false, length = 32)
    private String primaryMethod;

    @Lob
    private String requestJson;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private int attempts;

    private LocalDateTime consumedAt;
    private LocalDateTime bootstrapVerifiedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public String getSelectorHash() { return selectorHash; }
    public void setSelectorHash(String selectorHash) { this.selectorHash = selectorHash; }
    public Long getRunnerId() { return runnerId; }
    public void setRunnerId(Long runnerId) { this.runnerId = runnerId; }
    public AdminMfaPurpose getPurpose() { return purpose; }
    public void setPurpose(AdminMfaPurpose purpose) { this.purpose = purpose; }
    public String getPrimaryMethod() { return primaryMethod; }
    public void setPrimaryMethod(String primaryMethod) { this.primaryMethod = primaryMethod; }
    public String getRequestJson() { return requestJson; }
    public void setRequestJson(String requestJson) { this.requestJson = requestJson; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int attempts) { this.attempts = attempts; }
    public LocalDateTime getConsumedAt() { return consumedAt; }
    public void setConsumedAt(LocalDateTime consumedAt) { this.consumedAt = consumedAt; }
    public LocalDateTime getBootstrapVerifiedAt() { return bootstrapVerifiedAt; }
    public void setBootstrapVerifiedAt(LocalDateTime bootstrapVerifiedAt) { this.bootstrapVerifiedAt = bootstrapVerifiedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
