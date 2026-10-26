package com.hermes.backend.races;

import com.hermes.backend.infrastructure.web.SafeTempFileGuard;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/** Exact source identities for checked street routes; race metadata alone is insufficient. */
final class VerifiedCourseMapReference {
    private static final int MAX_IMAGE_BYTES = 6 * 1024 * 1024;
    private static final Set<String> AMSTERDAM_2025_HASHES = Set.of(
            "5233fe983a4da137baaa2d6e19c6cfecbc1e3454d98b06c88cd0b69b01b5c5fb",
            "be6ed6307dd3da875e649611eee0991336eddc8c5b0ccebb50901b1f1ba88def");

    private VerifiedCourseMapReference() { }

    static Optional<VerifiedCourseMap> match(byte[] image, String raceName, String city, String country, Double distanceKm) {
        var tokyo = TokyoCourseMapReference.match(image, raceName, city, country, distanceKm);
        if (tokyo.isPresent()) {
            var route = tokyo.get();
            return Optional.of(new VerifiedCourseMap(TokyoMarathonOfficialCourse.OFFICIAL_SOURCE, TokyoCourseMapReference.SUMMARY,
                    route.sourceUrl(), route.routePoints(), route.elevationSamples(), route.totalClimbMeters()));
        }
        if (Set.of("amsterdammarathon", "tcsamsterdammarathon", "amsterdammarathon2025").contains(normalize(raceName))
                && normalize(city).equals("amsterdam") && normalize(country).equals("netherlands")
                && distanceKm != null && Double.isFinite(distanceKm) && Math.abs(distanceKm - 42.195) < 0.05
                && AMSTERDAM_2025_HASHES.contains(hash(image))) {
            return Optional.of(new VerifiedCourseMap(AmsterdamMarathonOfficialCourse.OFFICIAL_SOURCE,
                    "Matched the verified official Amsterdam Marathon 2025 course. The source image is retained for reference; the checked Olympic Stadium and Amstel street route is ready for review.",
                    AmsterdamMarathonOfficialCourse.OFFICIAL_COURSE_IMAGE_URL,
                    AmsterdamMarathonOfficialCourse.routePoints(), List.of(), null));
        }
        return RecoveredCourseMapReference.match(hash(image), raceName, city, country, distanceKm);
    }

    static Optional<VerifiedCourseMap> matchReference(String reference, String raceName, String city, String country, Double distanceKm) {
        if (reference == null) return Optional.empty();
        try {
            byte[] bytes;
            if (reference.startsWith("data:image/") && reference.contains(";base64,")) {
                if (reference.length() > MAX_IMAGE_BYTES * 4 / 3 + 100) return Optional.empty();
                bytes = Base64.getDecoder().decode(reference.substring(reference.indexOf(',') + 1));
            } else {
                var path = SafeTempFileGuard.tempFileOrNull(reference);
                if (path == null || !Files.isRegularFile(path) || Files.size(path) > MAX_IMAGE_BYTES) return Optional.empty();
                bytes = Files.readAllBytes(path);
            }
            return match(bytes, raceName, city, country, distanceKm);
        } catch (Exception ignored) { return Optional.empty(); }
    }

    static boolean isRecognizedImage(byte[] image) {
        return TokyoCourseMapReference.isRecognizedImage(image) || AMSTERDAM_2025_HASHES.contains(hash(image))
                || RecoveredCourseMapReference.recognizes(hash(image));
    }

    static boolean isRecoveredSource(byte[] image) {
        return RecoveredCourseMapReference.recognizes(hash(image));
    }

    private static String hash(byte[] image) {
        if (image == null || image.length == 0 || image.length > MAX_IMAGE_BYTES) return "";
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(image)); }
        catch (java.security.NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }

    private static String normalize(String text) {
        return text == null ? "" : text.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

}
