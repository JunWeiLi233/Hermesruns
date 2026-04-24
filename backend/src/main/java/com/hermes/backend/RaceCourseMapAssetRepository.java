package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RaceCourseMapAssetRepository extends JpaRepository<RaceCourseMapAsset, Long> {
    Optional<RaceCourseMapAsset> findByRaceId(String raceId);
}
