package com.hermes.backend.shoes;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

public interface ShoeCatalogModelRepository extends JpaRepository<ShoeCatalogModel, Long> {
    List<ShoeCatalogModel> findByBrandIdOrderByNameAsc(Long brandId);
    Optional<ShoeCatalogModel> findByBrandAndNameIgnoreCase(ShoeCatalogBrand brand, String name);
    @EntityGraph(attributePaths = "brand")
    List<ShoeCatalogModel> findAllByOrderByBrand_NameAscNameAsc();
    long countByBrandId(Long brandId);
    void deleteByBrandId(Long brandId);
}
