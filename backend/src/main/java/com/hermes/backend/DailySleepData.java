package com.hermes.backend;

import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(
        name = "daily_sleep_data",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_sleep_runner_date",
                        columnNames = {"runner_id", "provider", "date"}
                )
        },
        indexes = {
                @Index(name = "idx_sleep_runner", columnList = "runner_id"),
                @Index(name = "idx_sleep_date", columnList = "date")
        }
)
public class DailySleepData {

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

    private Integer sleepTimeSeconds;

    private Integer deepSleepSeconds;

    private Integer lightSleepSeconds;

    private Integer remSleepSeconds;

    private Integer awakeSleepSeconds;

    private Integer sleepScore;

    private Integer awakeCount;

    private Double averageSpO2;

    private Double lowestSpO2;

    private Double highestSpO2;

    private Double averageRespiration;

    private Double avgSleepStress;

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

    public Integer getSleepTimeSeconds() { return sleepTimeSeconds; }
    public void setSleepTimeSeconds(Integer sleepTimeSeconds) { this.sleepTimeSeconds = sleepTimeSeconds; }

    public Integer getDeepSleepSeconds() { return deepSleepSeconds; }
    public void setDeepSleepSeconds(Integer deepSleepSeconds) { this.deepSleepSeconds = deepSleepSeconds; }

    public Integer getLightSleepSeconds() { return lightSleepSeconds; }
    public void setLightSleepSeconds(Integer lightSleepSeconds) { this.lightSleepSeconds = lightSleepSeconds; }

    public Integer getRemSleepSeconds() { return remSleepSeconds; }
    public void setRemSleepSeconds(Integer remSleepSeconds) { this.remSleepSeconds = remSleepSeconds; }

    public Integer getAwakeSleepSeconds() { return awakeSleepSeconds; }
    public void setAwakeSleepSeconds(Integer awakeSleepSeconds) { this.awakeSleepSeconds = awakeSleepSeconds; }

    public Integer getSleepScore() { return sleepScore; }
    public void setSleepScore(Integer sleepScore) { this.sleepScore = sleepScore; }

    public Integer getAwakeCount() { return awakeCount; }
    public void setAwakeCount(Integer awakeCount) { this.awakeCount = awakeCount; }

    public Double getAverageSpO2() { return averageSpO2; }
    public void setAverageSpO2(Double averageSpO2) { this.averageSpO2 = averageSpO2; }

    public Double getLowestSpO2() { return lowestSpO2; }
    public void setLowestSpO2(Double lowestSpO2) { this.lowestSpO2 = lowestSpO2; }

    public Double getHighestSpO2() { return highestSpO2; }
    public void setHighestSpO2(Double highestSpO2) { this.highestSpO2 = highestSpO2; }

    public Double getAverageRespiration() { return averageRespiration; }
    public void setAverageRespiration(Double averageRespiration) { this.averageRespiration = averageRespiration; }

    public Double getAvgSleepStress() { return avgSleepStress; }
    public void setAvgSleepStress(Double avgSleepStress) { this.avgSleepStress = avgSleepStress; }

    public String getSourceChecksum() { return sourceChecksum; }
    public void setSourceChecksum(String sourceChecksum) { this.sourceChecksum = sourceChecksum; }
}