package com.hermes.backend.billing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** One durable active purchase attempt per account; immutable provider request fields are snapshotted. */
@Entity
@Table(name = "billing_checkout_attempt")
public class CheckoutAttempt {
    @Id
    private Long runnerId;
    @Column(nullable = false, length = 64)
    private String idempotencyKey;
    @Column(nullable = false)
    private int months;
    @Column(nullable = false)
    private long expiresAt;
    @Column(nullable = false, length = 320)
    private String email;
    @Column(nullable = false)
    private String priceId;
    @Column(nullable = false, length = 2048)
    private String baseUrl;
    private String sessionId;
    @Column(length = 4096)
    private String sessionUrl;

    protected CheckoutAttempt() {}

    CheckoutAttempt(Long runnerId, int months, String email, String priceId, String baseUrl) {
        this.runnerId = runnerId;
        this.months = months;
        this.email = email;
        this.priceId = priceId;
        this.baseUrl = baseUrl;
        this.idempotencyKey = "checkout-" + UUID.randomUUID();
        this.expiresAt = Instant.now().plusSeconds(3600).getEpochSecond();
    }

    Long getRunnerId() { return runnerId; }
    String getIdempotencyKey() { return idempotencyKey; }
    int getMonths() { return months; }
    long getExpiresAt() { return expiresAt; }
    String getEmail() { return email; }
    String getPriceId() { return priceId; }
    String getBaseUrl() { return baseUrl; }
    String getSessionUrl() { return sessionUrl; }
    void setSession(String id, String url) { this.sessionId = id; this.sessionUrl = url; }
}
