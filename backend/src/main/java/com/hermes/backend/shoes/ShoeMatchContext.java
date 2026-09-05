package com.hermes.backend.shoes;

import java.util.List;
import java.util.Map;

/** Inventory snapshot prepared before per-item validation, preserving identity backfill timing. */
public record ShoeMatchContext(Map<String, List<Shoe>> byIdentity, Map<Long, Double> distanceByShoe) {
}
