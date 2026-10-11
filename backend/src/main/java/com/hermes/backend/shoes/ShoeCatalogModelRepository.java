package com.hermes.backend.shoes;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShoeCatalogModelRepository extends JpaRepository<ShoeCatalogModel, Long> {
    /**
     * Every model, each with its brand. The brand is a lazy association and the callers read its name after this
     * returns, when no session is open any more (the request does not keep one), so it has to come back with the models.
     */
    @Override
    @EntityGraph(attributePaths = "brand")
    List<ShoeCatalogModel> findAll();

    List<ShoeCatalogModel> findByBrandIdOrderByNameAsc(Long brandId);
    Optional<ShoeCatalogModel> findByBrandAndNameIgnoreCase(ShoeCatalogBrand brand, String name);
    List<ShoeCatalogModel> findAllByOrderByBrand_NameAscNameAsc();
    long countByBrandId(Long brandId);
    void deleteByBrandId(Long brandId);
}
