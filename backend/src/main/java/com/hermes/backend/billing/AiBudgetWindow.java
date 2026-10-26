package com.hermes.backend.billing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;

/** Durable provider-attempt reservations. Updated using conditional SQL, never a detached entity save. */
@Entity
@Table(name = "ai_budget_window")
public class AiBudgetWindow {
    @Id
    @Column(length = 64)
    private String id;
    @Column(name = "reserved_requests", nullable = false)
    private long reservedRequests;
    @Column(name = "reserved_usd", nullable = false, precision = 19, scale = 6)
    private BigDecimal reservedUsd;

    protected AiBudgetWindow() {}
}
