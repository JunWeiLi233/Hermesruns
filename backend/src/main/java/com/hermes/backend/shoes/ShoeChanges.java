package com.hermes.backend.shoes;

/** Validated inventory changes; explicit flags distinguish clearing nullable fields from omission. */
public record ShoeChanges(
        String brand,
        String model,
        String nickname,
        boolean nicknameChanged,
        Double maxDistanceKm,
        Boolean retired,
        Boolean isPrimary,
        Double initialDistanceKm,
        String photoUrl,
        boolean photoUrlChanged) {
}
