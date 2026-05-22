package com.hermes.backend;

import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(
        name = "daily_hrv_data",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_hrv_runner_date",
                        columnNames = {"runner_id", "provider", "date"}
                )
        },
        indexes = {
                @Index(name = "idx_hrv_runner", columnList = "runner_id"),
                @Index(name = "idx_hrv_date", columnList = "date")
        }
)
public class DailyHRVData {

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

    private Double lastNightAvg;

    private Double lastNight5MinHigh;

    private Double weeklyAvg;

    private Double baselineLowUpper;

    private Double baselineBalancedLow;

    private Double baselineBalancedUpper;

    @Column(length = 30)
    private String status;

    @Column(length = 200)
    private String feedbackPhrase;

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

    public Double getLastNightAvg() { return lastNightAvg; }
    public void setLastNightAvg(Double lastNightAvg) { this.lastNightAvg = lastNightAvg; }

    public Double getLastNight5MinHigh() { return lastNight5MinHigh; }
    public void setLastNight5MinHigh(Double lastNight5MinHigh) { this.lastNight5MinHigh = lastNight5MinHigh; }

    public Double getWeeklyAvg() { return weeklyAvg; }
    public void setWeeklyAvg(Double weeklyAvg) { this.weeklyAvg = weeklyAvg; }

    public Double getBaselineLowUpper() { return baselineLowUpper; }
    public void setBaselineLowUpper(Double baselineLowUpper) { this.baselineLowUpper = baselineLowUpper; }

    public Double getBaselineBalancedLow() { return baselineBalancedLow; }
    public void setBaselineBalancedLow(Double baselineBalancedLow) { this.baselineBalancedLow = baselineBalancedLow; }

    public Double getBaselineBalancedUpper() { return baselineBalancedUpper; }
    public void setBaselineBalancedUpper(Double baselineBalancedUpper) { this.baselineBalancedUpper = baselineBalancedUpper; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getFeedbackPhrase() { return feedbackPhrase; }
    public void setFeedbackPhrase(String feedbackPhrase) { this.feedbackPhrase = feedbackPhrase; }

    public String getSourceChecksum() { return sourceChecksum; }
    public void setSourceChecksum(String sourceChecksum) { this.sourceChecksum = sourceChecksum; }
}