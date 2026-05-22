package com.hermes.backend;

import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(
        name = "body_composition_data",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_bodycomp_runner_date",
                        columnNames = {"runner_id", "provider", "date"}
                )
        },
        indexes = {
                @Index(name = "idx_bodycomp_runner", columnList = "runner_id"),
                @Index(name = "idx_bodycomp_date", columnList = "date")
        }
)
public class BodyCompositionData {

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

    private Double weight;

    private Double bmi;

    private Double bodyFat;

    private Double bodyWater;

    private Double boneMass;

    private Double muscleMass;

    private Double visceralFat;

    private Integer metabolicAge;

    private Integer physiqueRating;

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

    public Double getWeight() { return weight; }
    public void setWeight(Double weight) { this.weight = weight; }

    public Double getBmi() { return bmi; }
    public void setBmi(Double bmi) { this.bmi = bmi; }

    public Double getBodyFat() { return bodyFat; }
    public void setBodyFat(Double bodyFat) { this.bodyFat = bodyFat; }

    public Double getBodyWater() { return bodyWater; }
    public void setBodyWater(Double bodyWater) { this.bodyWater = bodyWater; }

    public Double getBoneMass() { return boneMass; }
    public void setBoneMass(Double boneMass) { this.boneMass = boneMass; }

    public Double getMuscleMass() { return muscleMass; }
    public void setMuscleMass(Double muscleMass) { this.muscleMass = muscleMass; }

    public Double getVisceralFat() { return visceralFat; }
    public void setVisceralFat(Double visceralFat) { this.visceralFat = visceralFat; }

    public Integer getMetabolicAge() { return metabolicAge; }
    public void setMetabolicAge(Integer metabolicAge) { this.metabolicAge = metabolicAge; }

    public Integer getPhysiqueRating() { return physiqueRating; }
    public void setPhysiqueRating(Integer physiqueRating) { this.physiqueRating = physiqueRating; }

    public String getSourceChecksum() { return sourceChecksum; }
    public void setSourceChecksum(String sourceChecksum) { this.sourceChecksum = sourceChecksum; }
}