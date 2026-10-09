package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;

/**
 * Remembers that a runner deleted a run that came from a provider API, so the next sync does not bring
 * it back. It stores only the provider's activity id, never the activity itself, and it is removed with
 * the runner's other provider data when they disconnect or delete their account.
 */
@Entity
@Table(
        name = "deleted_activity_tombstone",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_deleted_activity_tombstone", columnNames = {"runner_id", "provider", "external_id"})
        },
        indexes = {
                @Index(name = "idx_deleted_activity_tombstone_runner", columnList = "runner_id")
        }
)
public class DeletedActivityTombstone {

    public static final String PROVIDER_STRAVA = "STRAVA";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "runner_id", nullable = false)
    private Runner runner;

    @Column(nullable = false, length = 16)
    private String provider;

    @Column(name = "external_id", nullable = false, length = 64)
    private String externalId;

    @Column(nullable = false)
    private LocalDateTime deletedAt;

    protected DeletedActivityTombstone() {
    }

    public DeletedActivityTombstone(Runner runner, String provider, String externalId) {
        this.runner = runner;
        this.provider = provider;
        this.externalId = externalId;
    }

    @PrePersist
    void prePersist() {
        if (deletedAt == null) {
            deletedAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getProvider() {
        return provider;
    }

    public String getExternalId() {
        return externalId;
    }

    public LocalDateTime getDeletedAt() {
        return deletedAt;
    }
}
