package com.hermes.backend;

public record UserAdminDto(
        Long id,
        String email,
        String displayName,
        String role,
        String status,
        String subscriptionTier,
        String proExpiresAt,
        boolean emailVerified,
        String createdAt,
        boolean stravaLinked,
        long noteCount,
        int shoeScanUsed,
        int shoeScanLimit,
        int shoeScanRemaining
) {
}
