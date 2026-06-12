package com.hermes.backend;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
public class GeneratedRaceGpxPersistenceService {
    private final GeneratedRaceGpxAssetRepository repository;

    public GeneratedRaceGpxPersistenceService(GeneratedRaceGpxAssetRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public GeneratedRaceGpxAsset save(
            Runner runner,
            String raceId,
            String raceName,
            String city,
            String country,
            String officialWebsite,
            Double distanceKm,
            String gpxXml
    ) {
        String normalizedRaceId = requireNonBlank(raceId, "raceId");
        GeneratedRaceGpxAsset asset = repository.findByRaceId(normalizedRaceId)
                .orElseGet(GeneratedRaceGpxAsset::new);
        asset.setRaceId(normalizedRaceId);
        if (asset.getRunner() == null) {
            asset.setRunner(runner);
        }
        asset.setRaceName(trimToNull(raceName));
        asset.setCity(trimToNull(city));
        asset.setCountry(trimToNull(country));
        asset.setOfficialWebsite(trimToNull(officialWebsite));
        asset.setDistanceKm(distanceKm);
        asset.setGpxXml(requireNonBlank(gpxXml, "gpxXml"));
        return repository.save(asset);
    }

    @Transactional(readOnly = true)
    public Optional<GeneratedRaceGpxAsset> findByRaceId(String raceId) {
        String normalizedRaceId = trimToNull(raceId);
        if (normalizedRaceId == null) {
            return Optional.empty();
        }
        return repository.findByRaceId(normalizedRaceId);
    }

    private String requireNonBlank(String value, String fieldName) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return trimmed;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
