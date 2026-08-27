package com.hermes.backend.auth.mfa;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "admin_passkey_credential")
public class AdminPasskeyCredential {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long runnerId;

    @Column(nullable = false, unique = true, length = 1024)
    private String credentialIdB64;

    @Column(nullable = false, length = 128)
    private String userHandleB64;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARBINARY)
    @Column(nullable = false)
    private byte[] publicKeyCose;

    @Column(nullable = false)
    private long signatureCount;

    private Boolean backupEligible;
    private Boolean backedUp;

    @Column(length = 100)
    private String label;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime lastUsedAt;

    public Long getId() { return id; }
    void setId(Long id) { this.id = id; }
    public Long getRunnerId() { return runnerId; }
    public void setRunnerId(Long runnerId) { this.runnerId = runnerId; }
    public String getCredentialIdB64() { return credentialIdB64; }
    public void setCredentialIdB64(String credentialIdB64) { this.credentialIdB64 = credentialIdB64; }
    public String getUserHandleB64() { return userHandleB64; }
    public void setUserHandleB64(String userHandleB64) { this.userHandleB64 = userHandleB64; }
    public byte[] getPublicKeyCose() { return publicKeyCose; }
    public void setPublicKeyCose(byte[] publicKeyCose) { this.publicKeyCose = publicKeyCose; }
    public long getSignatureCount() { return signatureCount; }
    public void setSignatureCount(long signatureCount) { this.signatureCount = signatureCount; }
    public Boolean getBackupEligible() { return backupEligible; }
    public void setBackupEligible(Boolean backupEligible) { this.backupEligible = backupEligible; }
    public Boolean getBackedUp() { return backedUp; }
    public void setBackedUp(Boolean backedUp) { this.backedUp = backedUp; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getLastUsedAt() { return lastUsedAt; }
    public void setLastUsedAt(LocalDateTime lastUsedAt) { this.lastUsedAt = lastUsedAt; }
}
