package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ShoeImageAssetRepository extends JpaRepository<ShoeImageAsset, Long> {
    Optional<ShoeImageAsset> findByIdentityKey(String identityKey);
    List<ShoeImageAsset> findByIdentityKeyIn(List<String> identityKeys);
}
