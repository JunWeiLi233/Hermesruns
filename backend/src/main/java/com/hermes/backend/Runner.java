package com.hermes.backend;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
        indexes = {
                @Index(name = "idx_runner_email", columnList = "email"),
                @Index(name = "idx_runner_session_token", columnList = "sessionToken"),
                @Index(name = "idx_runner_strava_athlete_id", columnList = "stravaAthleteId"),
                @Index(name = "idx_runner_deleted_role", columnList = "deleted, role")
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
}
