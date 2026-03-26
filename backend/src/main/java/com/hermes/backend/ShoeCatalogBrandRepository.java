package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ShoeCatalogBrandRepository extends JpaRepository<ShoeCatalogBrand, Long> {
    Optional<ShoeCatalogBrand> findByNameIgnoreCase(String name);
    List<ShoeCatalogBrand> findAllByOrderByNameAsc();
}

