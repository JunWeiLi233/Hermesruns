package com.hermes.backend;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "runner_admin_note", indexes = {
        @Index(name = "idx_runner_admin_note_runner", columnList = "runner_id"),
        @Index(name = "idx_runner_admin_note_created", columnList = "createdAt")
})
public class RunnerAdminNote {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "runner_id", nullable = false)
    private Runner runner;

    private Long authorRunnerId;
    private String authorEmail;
    private LocalDateTime createdAt;

    @Column(columnDefinition = "text", nullable = false)
    private String noteText;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public Long getId() { return id; }
    public Runner getRunner() { return runner; }
    public void setRunner(Runner runner) { this.runner = runner; }
    public Long getAuthorRunnerId() { return authorRunnerId; }
    public void setAuthorRunnerId(Long authorRunnerId) { this.authorRunnerId = authorRunnerId; }
    public String getAuthorEmail() { return authorEmail; }
    public void setAuthorEmail(String authorEmail) { this.authorEmail = authorEmail; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public String getNoteText() { return noteText; }
    public void setNoteText(String noteText) { this.noteText = noteText; }
}
