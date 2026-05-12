package com.hermes.backend;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "soreness_logs",
        indexes = {
                @Index(name = "idx_soreness_log_runner_date", columnList = "runner_id, date")
        }
)
public class SorenessLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "runner_id", nullable = false)
    private Runner runner;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false, length = 10)
    private String level;

    @Column(length = 500)
    private String notes;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public SorenessLog() {}

    public SorenessLog(Runner runner, LocalDate date, String level, String notes) {
        this.runner = runner;
        this.date = date;
        this.level = level;
        this.notes = notes;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Runner getRunner() { return runner; }
    public void setRunner(Runner runner) { this.runner = runner; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public String getLevel() { return level; }
    public void setLevel(String level) { this.level = level; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
