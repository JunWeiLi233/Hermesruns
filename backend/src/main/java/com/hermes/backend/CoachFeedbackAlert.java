package com.hermes.backend;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "coach_feedback_alert",
        indexes = {
                @Index(name = "idx_coach_alert_runner_created", columnList = "runner_id, created_at")
        }
)
public class CoachFeedbackAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "runner_id", nullable = false)
    private Runner runner;

    @Column(nullable = false, length = 40)
    private String alertType;

    @Column(nullable = false, length = 800)
    private String message;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private boolean dismissed;

    @ManyToOne
    @JoinColumn(name = "related_activity_id")
    private Activity relatedActivity;

    public Long getId() {
        return id;
    }

    public Runner getRunner() {
        return runner;
    }

    public void setRunner(Runner runner) {
        this.runner = runner;
    }

    public String getAlertType() {
        return alertType;
    }

    public void setAlertType(String alertType) {
        this.alertType = alertType;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public boolean isDismissed() {
        return dismissed;
    }

    public void setDismissed(boolean dismissed) {
        this.dismissed = dismissed;
    }

    public Activity getRelatedActivity() {
        return relatedActivity;
    }

    public void setRelatedActivity(Activity relatedActivity) {
        this.relatedActivity = relatedActivity;
    }
}
