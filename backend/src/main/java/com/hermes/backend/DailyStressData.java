package com.hermes.backend;

import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(
        name = "daily_stress_data",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_stress_runner_date",
                        columnNames = {"runner_id", "provider", "date"}
                )
        },
        indexes = {
                @Index(name = "idx_stress_runner", columnList = "runner_id"),
                @Index(name = "idx_stress_date", columnList = "date")
        }
)
public class DailyStressData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "runner_id")
    private Runner runner;

    @Column(nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ImportProvider provider;

    private Integer overallStressLevel;

    private Integer restStressDuration;

    private Integer lowStressDuration;

    private Integer mediumStressDuration;

    private Integer highStressDuration;

    @Column(length = 100, nullable = false)
    private String sourceChecksum;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Runner getRunner() { return runner; }
    public void setRunner(Runner runner) { this.runner = runner; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public ImportProvider getProvider() { return provider; }
    public void setProvider(ImportProvider provider) { this.provider = provider; }

    public Integer getOverallStressLevel() { return overallStressLevel; }
    public void setOverallStressLevel(Integer overallStressLevel) { this.overallStressLevel = overallStressLevel; }

    public Integer getRestStressDuration() { return restStressDuration; }
    public void setRestStressDuration(Integer restStressDuration) { this.restStressDuration = restStressDuration; }

    public Integer getLowStressDuration() { return lowStressDuration; }
    public void setLowStressDuration(Integer lowStressDuration) { this.lowStressDuration = lowStressDuration; }

    public Integer getMediumStressDuration() { return mediumStressDuration; }
    public void setMediumStressDuration(Integer mediumStressDuration) { this.mediumStressDuration = mediumStressDuration; }

    public Integer getHighStressDuration() { return highStressDuration; }
    public void setHighStressDuration(Integer highStressDuration) { this.highStressDuration = highStressDuration; }

    public String getSourceChecksum() { return sourceChecksum; }
    public void setSourceChecksum(String sourceChecksum) { this.sourceChecksum = sourceChecksum; }
}