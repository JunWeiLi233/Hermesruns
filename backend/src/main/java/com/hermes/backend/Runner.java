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
                @Index(name = "idx_runner_email_verif_token", columnList = "emailVerificationTokenHash")
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

    private Long stravaAthleteId;

    private String stravaUsername;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String stravaAccessToken;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String stravaRefreshToken;

    private Long stravaTokenExpiresAt;

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

    /** False until the user completes email verification (password sign-up only). OAuth users are verified by the provider. */
    @Column(nullable = false)
    @ColumnDefault("true")
    private boolean emailVerified = true;

    @JsonIgnore
    @Column(length = 64)
    private String emailVerificationTokenHash;

    private LocalDateTime emailVerificationExpiresAt;

    @PrePersist
    @PreUpdate
    private void applySubscriptionAiDefaults() {
        if (subscriptionTier == null || subscriptionTier.isBlank()) {
            subscriptionTier = "FREE";
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

    public boolean isEmailVerified() { return emailVerified; }
    public void setEmailVerified(boolean emailVerified) { this.emailVerified = emailVerified; }

    public String getEmailVerificationTokenHash() { return emailVerificationTokenHash; }
    public void setEmailVerificationTokenHash(String emailVerificationTokenHash) { this.emailVerificationTokenHash = emailVerificationTokenHash; }

    public LocalDateTime getEmailVerificationExpiresAt() { return emailVerificationExpiresAt; }
    public void setEmailVerificationExpiresAt(LocalDateTime emailVerificationExpiresAt) { this.emailVerificationExpiresAt = emailVerificationExpiresAt; }

    // ── Garmin fields ──

    private String garminUserId;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String garminAccessToken;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String garminAccessTokenSecret;

    private String garminConsumerKey;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String garminConsumerSecret;

    private String garminRedirectUri;

    public String getGarminUserId() { return garminUserId; }
    public void setGarminUserId(String garminUserId) { this.garminUserId = garminUserId; }

    public String getGarminAccessToken() { return garminAccessToken; }
    public void setGarminAccessToken(String garminAccessToken) { this.garminAccessToken = garminAccessToken; }

    public String getGarminAccessTokenSecret() { return garminAccessTokenSecret; }
    public void setGarminAccessTokenSecret(String garminAccessTokenSecret) { this.garminAccessTokenSecret = garminAccessTokenSecret; }

    public String getGarminConsumerKey() { return garminConsumerKey; }
    public void setGarminConsumerKey(String garminConsumerKey) { this.garminConsumerKey = garminConsumerKey; }

    public String getGarminConsumerSecret() { return garminConsumerSecret; }
    public void setGarminConsumerSecret(String garminConsumerSecret) { this.garminConsumerSecret = garminConsumerSecret; }

    public String getGarminRedirectUri() { return garminRedirectUri; }
    public void setGarminRedirectUri(String garminRedirectUri) { this.garminRedirectUri = garminRedirectUri; }
}
