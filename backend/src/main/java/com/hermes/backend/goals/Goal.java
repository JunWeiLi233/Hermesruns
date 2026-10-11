package com.hermes.backend.goals;

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
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;

/**
 * A target a runner has set for a week, a month or a year: so many kilometres, so much time, so many runs or so much climb.
 * A runner has at most one goal for each period and metric (a weekly distance goal and a weekly runs goal can sit side by
 * side, two weekly distance goals cannot). What the runner has done towards it is never stored: it is worked out from their
 * runs whenever the goal is read, so it cannot drift from them.
 *
 * <p>Period and metric are plain strings (see {@link GoalPeriods}, {@link GoalMetrics}), like the other small derived tables,
 * so the schema needs no enum constraint.</p>
 */
@Entity
@Table(
        name = "goal",
        uniqueConstraints = @UniqueConstraint(name = "uk_goal_runner_period_metric", columnNames = {"runner_id", "period", "metric"}),
        indexes = @Index(name = "idx_goal_runner", columnList = "runner_id")
)
public class Goal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "runner_id", nullable = false)
    private Runner runner;

    @Column(nullable = false, length = 8)
    private String period;

    @Column(nullable = false, length = 12)
    private String metric;

    /** In the metric's own unit: km, seconds, runs or metres. */
    @Column(nullable = false)
    private double target;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected Goal() {
    }

    public Goal(Runner runner, String period, String metric, double target) {
        this.runner = runner;
        this.period = period;
        this.metric = metric;
        this.target = target;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    public Long getId() {
        return id;
    }

    public Runner getRunner() {
        return runner;
    }

    public String getPeriod() {
        return period;
    }

    public String getMetric() {
        return metric;
    }

    public double getTarget() {
        return target;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void changeTarget(double target) {
        this.target = target;
        this.updatedAt = LocalDateTime.now();
    }
}
