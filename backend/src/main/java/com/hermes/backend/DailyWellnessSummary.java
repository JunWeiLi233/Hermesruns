package com.hermes.backend;

import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(
        name = "daily_wellness_summary",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_wellness_runner_date",
                        columnNames = {"runner_id", "provider", "date"}
                )
        },
        indexes = {
                @Index(name = "idx_wellness_runner", columnList = "runner_id"),
                @Index(name = "idx_wellness_date", columnList = "date")
        }
)
public class DailyWellnessSummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "runner_id")
    private Runner runner;

    @Column(nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ImportProvider provider;

    private Integer restingHeartRate;

    private Integer avgStressLevel;

    private Integer maxStressLevel;

    @Column(length = 50)
    private String stressQualifier;

    private Long totalSteps;

    private Double totalDistanceMeters;

    private Double activeKilocalories;

    private Integer sedentarySeconds;

    private Integer bodyBatteryHighest;

    private Integer bodyBatteryLowest;

    private Integer bodyBatteryAtWake;

    private Integer moderateIntensityMinutes;

    private Integer vigorousIntensityMinutes;

    private Double averageSpo2;

    private Double lowestSpo2;

    private Integer floorsAscended;

    private Integer floorsDescended;

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

    public Integer getRestingHeartRate() { return restingHeartRate; }
    public void setRestingHeartRate(Integer restingHeartRate) { this.restingHeartRate = restingHeartRate; }

    public Integer getAvgStressLevel() { return avgStressLevel; }
    public void setAvgStressLevel(Integer avgStressLevel) { this.avgStressLevel = avgStressLevel; }

    public Integer getMaxStressLevel() { return maxStressLevel; }
    public void setMaxStressLevel(Integer maxStressLevel) { this.maxStressLevel = maxStressLevel; }

    public String getStressQualifier() { return stressQualifier; }
    public void setStressQualifier(String stressQualifier) { this.stressQualifier = stressQualifier; }

    public Long getTotalSteps() { return totalSteps; }
    public void setTotalSteps(Long totalSteps) { this.totalSteps = totalSteps; }

    public Double getTotalDistanceMeters() { return totalDistanceMeters; }
    public void setTotalDistanceMeters(Double totalDistanceMeters) { this.totalDistanceMeters = totalDistanceMeters; }

    public Double getActiveKilocalories() { return activeKilocalories; }
    public void setActiveKilocalories(Double activeKilocalories) { this.activeKilocalories = activeKilocalories; }

    public Integer getSedentarySeconds() { return sedentarySeconds; }
    public void setSedentarySeconds(Integer sedentarySeconds) { this.sedentarySeconds = sedentarySeconds; }

    public Integer getBodyBatteryHighest() { return bodyBatteryHighest; }
    public void setBodyBatteryHighest(Integer bodyBatteryHighest) { this.bodyBatteryHighest = bodyBatteryHighest; }

    public Integer getBodyBatteryLowest() { return bodyBatteryLowest; }
    public void setBodyBatteryLowest(Integer bodyBatteryLowest) { this.bodyBatteryLowest = bodyBatteryLowest; }

    public Integer getBodyBatteryAtWake() { return bodyBatteryAtWake; }
    public void setBodyBatteryAtWake(Integer bodyBatteryAtWake) { this.bodyBatteryAtWake = bodyBatteryAtWake; }

    public Integer getModerateIntensityMinutes() { return moderateIntensityMinutes; }
    public void setModerateIntensityMinutes(Integer moderateIntensityMinutes) { this.moderateIntensityMinutes = moderateIntensityMinutes; }

    public Integer getVigorousIntensityMinutes() { return vigorousIntensityMinutes; }
    public void setVigorousIntensityMinutes(Integer vigorousIntensityMinutes) { this.vigorousIntensityMinutes = vigorousIntensityMinutes; }

    public Double getAverageSpo2() { return averageSpo2; }
    public void setAverageSpo2(Double averageSpo2) { this.averageSpo2 = averageSpo2; }

    public Double getLowestSpo2() { return lowestSpo2; }
    public void setLowestSpo2(Double lowestSpo2) { this.lowestSpo2 = lowestSpo2; }

    public Integer getFloorsAscended() { return floorsAscended; }
    public void setFloorsAscended(Integer floorsAscended) { this.floorsAscended = floorsAscended; }

    public Integer getFloorsDescended() { return floorsDescended; }
    public void setFloorsDescended(Integer floorsDescended) { this.floorsDescended = floorsDescended; }

    public String getSourceChecksum() { return sourceChecksum; }
    public void setSourceChecksum(String sourceChecksum) { this.sourceChecksum = sourceChecksum; }
}