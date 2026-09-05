package com.hermes.backend.shoes;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShoeCatalogBrandRepository extends JpaRepository<ShoeCatalogBrand, Long> {
    Optional<ShoeCatalogBrand> findByNameIgnoreCase(String name);
    List<ShoeCatalogBrand> findAllByOrderByNameAsc();
}

