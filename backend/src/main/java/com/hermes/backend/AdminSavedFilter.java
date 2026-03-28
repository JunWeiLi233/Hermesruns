package com.hermes.backend;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "admin_saved_filter", indexes = {
        @Index(name = "idx_admin_saved_filter_owner_scope", columnList = "ownerRunnerId,scope"),
        @Index(name = "idx_admin_saved_filter_updated", columnList = "updatedAt")
})
public class AdminSavedFilter {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long ownerRunnerId;
    private String ownerEmail;
    private String scope;
    private String name;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Column(columnDefinition = "text", nullable = false)
    private String queryJson;

    @PrePersist
    @PreUpdate
    void touch() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getOwnerRunnerId() { return ownerRunnerId; }
    public void setOwnerRunnerId(Long ownerRunnerId) { this.ownerRunnerId = ownerRunnerId; }
    public String getOwnerEmail() { return ownerEmail; }
    public void setOwnerEmail(String ownerEmail) { this.ownerEmail = ownerEmail; }
    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public String getQueryJson() { return queryJson; }
    public void setQueryJson(String queryJson) { this.queryJson = queryJson; }
}
