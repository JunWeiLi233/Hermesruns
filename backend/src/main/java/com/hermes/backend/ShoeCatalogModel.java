package com.hermes.backend;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "shoe_catalog_models", indexes = {
        @Index(name = "idx_shoe_catalog_model_brand", columnList = "brand_id"),
        @Index(name = "idx_shoe_catalog_model_name", columnList = "name")
})
public class ShoeCatalogModel {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "brand_id", nullable = false)
    @JsonIgnore
    private ShoeCatalogBrand brand;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 100)
    private String nameZh;

    @Column(length = 100)
    private String nameEn;

    @Column(nullable = false, length = 32)
    private String type = "daily";

    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (type == null || type.isBlank()) type = "daily";
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public ShoeCatalogBrand getBrand() { return brand; }
    public void setBrand(ShoeCatalogBrand brand) { this.brand = brand; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getNameZh() { return nameZh; }
    public void setNameZh(String nameZh) { this.nameZh = nameZh; }

    public String getNameEn() { return nameEn; }
    public void setNameEn(String nameEn) { this.nameEn = nameEn; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
