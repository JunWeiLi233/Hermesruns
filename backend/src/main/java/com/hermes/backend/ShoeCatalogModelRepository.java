package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ShoeCatalogModelRepository extends JpaRepository<ShoeCatalogModel, Long> {
    List<ShoeCatalogModel> findByBrandIdOrderByNameAsc(Long brandId);
    Optional<ShoeCatalogModel> findByBrandAndNameIgnoreCase(ShoeCatalogBrand brand, String name);
    List<ShoeCatalogModel> findAllByOrderByBrand_NameAscNameAsc();
    long countByBrandId(Long brandId);
    void deleteByBrandId(Long brandId);
}
