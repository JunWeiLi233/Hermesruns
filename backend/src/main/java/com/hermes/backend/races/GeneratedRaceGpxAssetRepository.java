package com.hermes.backend.races;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GeneratedRaceGpxAssetRepository extends JpaRepository<GeneratedRaceGpxAsset, Long> {
    Optional<GeneratedRaceGpxAsset> findByRaceId(String raceId);
}
