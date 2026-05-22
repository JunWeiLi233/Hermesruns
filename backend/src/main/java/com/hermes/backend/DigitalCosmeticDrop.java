package com.hermes.backend;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "digital_cosmetic_drop",
        indexes = {
                @Index(name = "idx_cosmetic_drop_runner_created", columnList = "runner_id,createdAt"),
                @Index(name = "idx_cosmetic_drop_runner_tier", columnList = "runner_id,tier")
        }
)
public class DigitalCosmeticDrop {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "runner_id", nullable = false)
    private Runner runner;

    @ManyToOne
    @JoinColumn(name = "activity_id")
    private Activity activity;

    @ManyToOne
    @JoinColumn(name = "shoe_id")
    private Shoe shoe;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private DigitalCosmeticTier tier;

    /** 0.00 pristine, 1.00 battle-scarred */
    private Double wearFloat;

    @Column(length = 48)
    private String wearLabel;

    @Column(length = 2048)
    private String title;

    @Column(length = 4096)
    private String rewardPayloadJson;

    @Column(nullable = false)
    private boolean voidedByAntiSpoof;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public Runner getRunner() {
        return runner;
    }

    public void setRunner(Runner runner) {
        this.runner = runner;
    }

    public Activity getActivity() {
        return activity;
    }

    public void setActivity(Activity activity) {
        this.activity = activity;
    }

    public Shoe getShoe() {
        return shoe;
    }

    public void setShoe(Shoe shoe) {
        this.shoe = shoe;
    }

    public DigitalCosmeticTier getTier() {
        return tier;
    }

    public void setTier(DigitalCosmeticTier tier) {
        this.tier = tier;
    }

    public Double getWearFloat() {
        return wearFloat;
    }

    public void setWearFloat(Double wearFloat) {
        this.wearFloat = wearFloat;
    }

    public String getWearLabel() {
        return wearLabel;
    }

    public void setWearLabel(String wearLabel) {
        this.wearLabel = wearLabel;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getRewardPayloadJson() {
        return rewardPayloadJson;
    }

    public void setRewardPayloadJson(String rewardPayloadJson) {
        this.rewardPayloadJson = rewardPayloadJson;
    }

    public boolean isVoidedByAntiSpoof() {
        return voidedByAntiSpoof;
    }

    public void setVoidedByAntiSpoof(boolean voidedByAntiSpoof) {
        this.voidedByAntiSpoof = voidedByAntiSpoof;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
