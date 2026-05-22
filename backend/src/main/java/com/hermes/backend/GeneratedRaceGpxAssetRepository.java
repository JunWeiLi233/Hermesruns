package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GeneratedRaceGpxAssetRepository extends JpaRepository<GeneratedRaceGpxAsset, Long> {
    Optional<GeneratedRaceGpxAsset> findByRaceId(String raceId);
}
