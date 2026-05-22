package com.hermes.backend;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
        indexes = {
                @Index(name = "idx_runner_email", columnList = "email"),
                @Index(name = "idx_runner_session_token", columnList = "sessionToken"),
                @Index(name = "idx_runner_strava_athlete_id", columnList = "stravaAthleteId"),
                @Index(name = "idx_runner_deleted_role", columnList = "deleted, role"),
                @Index(name = "idx_runner_email_verif_token", columnList = "emailVerificationTokenHash"),
                @Index(name = "idx_runner_pw_reset_token", columnList = "passwordResetTokenHash"),
                @Index(name = "idx_runner_garmin_sync", columnList = "garminWellnessSyncEnabled, deleted")
        }
)
public class Runner {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    private String status;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    private boolean deleted = false;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String sessionToken;

    private LocalDateTime tokenIssuedAt;

    private String role = "USER";

    private String displayName;

    @Column(length = 280)
    private String settingsMantra;

    @Column(nullable = false)
    @ColumnDefault("false")
    private boolean weeklyDigestEnabled = false;

    /** Optional profile override for coach HR zone math (bpm). */
    private Integer maxHeartRateBpm;

    /** Optional resting HR for readiness checks (bpm). */
    private Integer restingHeartRateBpm;

    private Long stravaAthleteId;

    private String stravaUsername;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String stravaAccessToken;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String stravaRefreshToken;

    private Long stravaTokenExpiresAt;

    private String garminConnectEmail;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String garminConnectPasswordEncrypted;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String garminConnectTokenEncrypted;

    @Column(nullable = false)
    @ColumnDefault("false")
    private boolean garminWellnessSyncEnabled = false;

    private LocalDateTime garminWellnessLastSyncedAt;

    @Column(length = 32)
    private String wellnessSleepSource;

    @Column(length = 32)
    private String wellnessHrvSource;

    @Column(length = 32)
    private String wellnessRestingHrSource;

    @Column(length = 32)
    private String wellnessStressSource;

    private LocalDateTime createdAt;

    public Runner() {
    }

    public Runner(String email, String status) {
        this.email = email;
        this.status = status;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }

    public String getSessionToken() {
        return sessionToken;
    }

    public void setSessionToken(String sessionToken) {
        this.sessionToken = sessionToken;
    }

    public LocalDateTime getTokenIssuedAt() {
        return tokenIssuedAt;
    }

    public void setTokenIssuedAt(LocalDateTime tokenIssuedAt) {
        this.tokenIssuedAt = tokenIssuedAt;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getSettingsMantra() {
        return settingsMantra;
    }

    public void setSettingsMantra(String settingsMantra) {
        this.settingsMantra = settingsMantra;
    }

    public boolean isWeeklyDigestEnabled() {
        return weeklyDigestEnabled;
    }

    public void setWeeklyDigestEnabled(boolean weeklyDigestEnabled) {
        this.weeklyDigestEnabled = weeklyDigestEnabled;
    }

    public Integer getMaxHeartRateBpm() {
        return maxHeartRateBpm;
    }

    public void setMaxHeartRateBpm(Integer maxHeartRateBpm) {
        this.maxHeartRateBpm = maxHeartRateBpm;
    }

    public Integer getRestingHeartRateBpm() {
        return restingHeartRateBpm;
    }

    public void setRestingHeartRateBpm(Integer restingHeartRateBpm) {
        this.restingHeartRateBpm = restingHeartRateBpm;
    }

    public Long getStravaAthleteId() {
        return stravaAthleteId;
    }

    public void setStravaAthleteId(Long stravaAthleteId) {
        this.stravaAthleteId = stravaAthleteId;
    }

    public String getStravaUsername() {
        return stravaUsername;
    }

    public void setStravaUsername(String stravaUsername) {
        this.stravaUsername = stravaUsername;
    }

    public String getStravaAccessToken() {
        return stravaAccessToken;
    }

    public void setStravaAccessToken(String stravaAccessToken) {
        this.stravaAccessToken = stravaAccessToken;
    }

    public String getStravaRefreshToken() {
        return stravaRefreshToken;
    }

    public void setStravaRefreshToken(String stravaRefreshToken) {
        this.stravaRefreshToken = stravaRefreshToken;
    }

    public Long getStravaTokenExpiresAt() {
        return stravaTokenExpiresAt;
    }

    public void setStravaTokenExpiresAt(Long stravaTokenExpiresAt) {
        this.stravaTokenExpiresAt = stravaTokenExpiresAt;
    }

    public String getGarminConnectEmail() { return garminConnectEmail; }
    public void setGarminConnectEmail(String garminConnectEmail) { this.garminConnectEmail = garminConnectEmail; }

    public String getGarminConnectPasswordEncrypted() { return garminConnectPasswordEncrypted; }
    public void setGarminConnectPasswordEncrypted(String garminConnectPasswordEncrypted) { this.garminConnectPasswordEncrypted = garminConnectPasswordEncrypted; }

    public String getGarminConnectTokenEncrypted() { return garminConnectTokenEncrypted; }
    public void setGarminConnectTokenEncrypted(String garminConnectTokenEncrypted) { this.garminConnectTokenEncrypted = garminConnectTokenEncrypted; }

    public boolean isGarminWellnessSyncEnabled() { return garminWellnessSyncEnabled; }
    public void setGarminWellnessSyncEnabled(boolean garminWellnessSyncEnabled) { this.garminWellnessSyncEnabled = garminWellnessSyncEnabled; }

    public LocalDateTime getGarminWellnessLastSyncedAt() { return garminWellnessLastSyncedAt; }
    public void setGarminWellnessLastSyncedAt(LocalDateTime garminWellnessLastSyncedAt) { this.garminWellnessLastSyncedAt = garminWellnessLastSyncedAt; }

    public String getWellnessSleepSource() { return wellnessSleepSource; }
    public void setWellnessSleepSource(String wellnessSleepSource) { this.wellnessSleepSource = wellnessSleepSource; }

    public String getWellnessHrvSource() { return wellnessHrvSource; }
    public void setWellnessHrvSource(String wellnessHrvSource) { this.wellnessHrvSource = wellnessHrvSource; }

    public String getWellnessRestingHrSource() { return wellnessRestingHrSource; }
    public void setWellnessRestingHrSource(String wellnessRestingHrSource) { this.wellnessRestingHrSource = wellnessRestingHrSource; }

    public String getWellnessStressSource() { return wellnessStressSource; }
    public void setWellnessStressSource(String wellnessStressSource) { this.wellnessStressSource = wellnessStressSource; }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    // ── Subscription & AI usage fields ──
    // ColumnDefault: required so Hibernate ddl-auto can add NOT NULL columns on PostgreSQL when rows already exist.

    @Column(nullable = false)
    @ColumnDefault("'FREE'")
    private String subscriptionTier = "FREE"; // FREE or PRO

    private LocalDateTime proExpiresAt;

    @Column(nullable = false)
    @ColumnDefault("5")
    private int aiWelcomeScansRemaining = 5;

    /**
     * AI shoe-scan lifecycle: {@code NEW_USER} = one trial scan, then {@code REGULAR_USER} with
     * {@link #aiFreeScansRemaining} (3) for non-Pro. Null = legacy row (migrated on first quota touch).
     */
    @Column(length = 24)
    private String aiExperiencePhase;

    @Column(nullable = false)
    @ColumnDefault("0")
    private int aiFreeScansRemaining = 0;

    private LocalDate aiDailyLastUsedDate;

    @Column(nullable = false)
    @ColumnDefault("0")
    private int aiMonthlyScansUsed = 0;

    private LocalDate aiMonthlyResetDate;

    @Column(nullable = false)
    @ColumnDefault("0")
    private int aiDailyScansUsed = 0;

    private LocalDate aiDailyResetDate;

    /** Monthly shoe-scan counter for feature quota gating (free users). Reset on the 1st of each month. */
    @Column(nullable = false)
    @ColumnDefault("0")
    private int shoeScanCount = 0;

    private LocalDate shoeScanCountReset;

    /** False until the user completes email verification (password sign-up only). OAuth users are verified by the provider. */
    @Column(nullable = false)
    @ColumnDefault("true")
    private boolean emailVerified = true;

    @JsonIgnore
    @Column(length = 64)
    private String emailVerificationTokenHash;

    private LocalDateTime emailVerificationExpiresAt;

    @JsonIgnore
    @Column(length = 64)
    private String passwordResetTokenHash;

    private LocalDateTime passwordResetExpiresAt;

    @PrePersist
    @PreUpdate
    private void applySubscriptionAiDefaults() {
        if (subscriptionTier == null || subscriptionTier.isBlank()) {
            subscriptionTier = "FREE";
        }
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public String getSubscriptionTier() { return subscriptionTier; }
    public void setSubscriptionTier(String subscriptionTier) { this.subscriptionTier = subscriptionTier; }

    public LocalDateTime getProExpiresAt() { return proExpiresAt; }
    public void setProExpiresAt(LocalDateTime proExpiresAt) { this.proExpiresAt = proExpiresAt; }

    public int getAiWelcomeScansRemaining() { return aiWelcomeScansRemaining; }
    public void setAiWelcomeScansRemaining(int aiWelcomeScansRemaining) { this.aiWelcomeScansRemaining = aiWelcomeScansRemaining; }

    public String getAiExperiencePhase() { return aiExperiencePhase; }
    public void setAiExperiencePhase(String aiExperiencePhase) { this.aiExperiencePhase = aiExperiencePhase; }

    public int getAiFreeScansRemaining() { return aiFreeScansRemaining; }
    public void setAiFreeScansRemaining(int aiFreeScansRemaining) { this.aiFreeScansRemaining = aiFreeScansRemaining; }

    public LocalDate getAiDailyLastUsedDate() { return aiDailyLastUsedDate; }
    public void setAiDailyLastUsedDate(LocalDate aiDailyLastUsedDate) { this.aiDailyLastUsedDate = aiDailyLastUsedDate; }

    public int getAiMonthlyScansUsed() { return aiMonthlyScansUsed; }
    public void setAiMonthlyScansUsed(int aiMonthlyScansUsed) { this.aiMonthlyScansUsed = aiMonthlyScansUsed; }

    public LocalDate getAiMonthlyResetDate() { return aiMonthlyResetDate; }
    public void setAiMonthlyResetDate(LocalDate aiMonthlyResetDate) { this.aiMonthlyResetDate = aiMonthlyResetDate; }

    public int getAiDailyScansUsed() { return aiDailyScansUsed; }
    public void setAiDailyScansUsed(int aiDailyScansUsed) { this.aiDailyScansUsed = aiDailyScansUsed; }

    public LocalDate getAiDailyResetDate() { return aiDailyResetDate; }
    public void setAiDailyResetDate(LocalDate aiDailyResetDate) { this.aiDailyResetDate = aiDailyResetDate; }

    public int getShoeScanCount() { return shoeScanCount; }
    public void setShoeScanCount(int shoeScanCount) { this.shoeScanCount = shoeScanCount; }

    public LocalDate getShoeScanCountReset() { return shoeScanCountReset; }
    public void setShoeScanCountReset(LocalDate shoeScanCountReset) { this.shoeScanCountReset = shoeScanCountReset; }

    public boolean isEmailVerified() { return emailVerified; }
    public void setEmailVerified(boolean emailVerified) { this.emailVerified = emailVerified; }

    public String getEmailVerificationTokenHash() { return emailVerificationTokenHash; }
    public void setEmailVerificationTokenHash(String emailVerificationTokenHash) { this.emailVerificationTokenHash = emailVerificationTokenHash; }

    public LocalDateTime getEmailVerificationExpiresAt() { return emailVerificationExpiresAt; }
    public void setEmailVerificationExpiresAt(LocalDateTime emailVerificationExpiresAt) { this.emailVerificationExpiresAt = emailVerificationExpiresAt; }

    public String getPasswordResetTokenHash() { return passwordResetTokenHash; }
    public void setPasswordResetTokenHash(String passwordResetTokenHash) { this.passwordResetTokenHash = passwordResetTokenHash; }

    public LocalDateTime getPasswordResetExpiresAt() { return passwordResetExpiresAt; }
    public void setPasswordResetExpiresAt(LocalDateTime passwordResetExpiresAt) { this.passwordResetExpiresAt = passwordResetExpiresAt; }
}
