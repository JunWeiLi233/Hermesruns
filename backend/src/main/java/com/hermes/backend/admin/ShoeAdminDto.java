package com.hermes.backend.admin;

public record ShoeAdminDto(
        Long id,
        String brand,
        String model,
        String nickname,
        String identityKey,
        String photoUrl,
        boolean photoVerified,
        String pendingImageUrl,
        String pendingImageSource,
        String liveImageUrl,
        String liveImageSource,
        boolean retired,
        String createdAt,
        Long runnerId,
        String runnerEmail
) {
}
