package com.hermes.backend;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Stores Stripe webhook event ids so we never apply the same payment twice.
 */
@Entity
@Table(name = "processed_stripe_event")
public class ProcessedStripeEvent {

    @Id
    @Column(nullable = false, length = 255)
    private String id;

    @Column(nullable = false)
    private Instant processedAt = Instant.now();

    public ProcessedStripeEvent() {
    }

    public ProcessedStripeEvent(String id) {
        this.id = id;
        this.processedAt = Instant.now();
    }

    public String getId() {
        return id;
    }

    public Instant getProcessedAt() {
        return processedAt;
    }
}
