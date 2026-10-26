package com.hermes.backend.races;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.infrastructure.web.SafeTempFileGuard;
import com.hermes.backend.routing.RoutePoint;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/** Content-verified reference for the non-geographic Tokyo 2026 illustration. */
final class TokyoCourseMapReference {
    static final String SUMMARY = "Matched the verified official Tokyo Marathon 2026 course. The illustrated source is retained for reference; the verified street route is ready for review.";
    private static final Data DATA = load();
    private static final Set<String> IMAGE_HASHES = Set.copyOf(DATA.imageSha256());
    private static final Course COURSE = new Course(List.copyOf(DATA.routePoints()),
            List.copyOf(DATA.elevationSamples()), DATA.totalClimbMeters(), DATA.sourceUrl());
    private static final int MAX_IMAGE_BYTES = 6 * 1024 * 1024;

    private TokyoCourseMapReference() { }

    static Optional<Course> match(byte[] image, String raceName, String city, String country, Double distanceKm) {
        if (!isContext(raceName, city, country, distanceKm) || !isRecognizedImage(image)) return Optional.empty();
        return Optional.of(COURSE);
    }

    static Optional<Course> matchReference(String imageReference, String raceName, String city, String country, Double distanceKm) {
        if (!isContext(raceName, city, country, distanceKm) || imageReference == null) return Optional.empty();
        try {
            byte[] bytes;
            if (imageReference.startsWith("data:image/") && imageReference.contains(";base64,")) {
                if (imageReference.length() > MAX_IMAGE_BYTES * 4 / 3 + 100) return Optional.empty();
                bytes = Base64.getDecoder().decode(imageReference.substring(imageReference.indexOf(',') + 1));
            } else {
                var path = SafeTempFileGuard.tempFileOrNull(imageReference);
                if (path == null || !Files.isRegularFile(path) || Files.size(path) > MAX_IMAGE_BYTES) return Optional.empty();
                bytes = Files.readAllBytes(path);
            }
            return match(bytes, raceName, city, country, distanceKm);
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    static boolean isRecognizedImage(byte[] image) {
        if (image == null || image.length == 0 || image.length > MAX_IMAGE_BYTES) return false;
        try {
            return IMAGE_HASHES.contains(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(image)));
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 unavailable", error);
        }
    }

    private static boolean isContext(String raceName, String city, String country, Double distanceKm) {
        String race = normalize(raceName);
        return (race.equals("tokyomarathon") || race.equals("tokyomarathon2026"))
                && normalize(city).equals("tokyo") && normalize(country).equals("japan")
                && distanceKm != null && Double.isFinite(distanceKm) && Math.abs(distanceKm - 42.195) < 0.05;
    }

    private static String normalize(String text) {
        return text == null ? "" : text.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private static Data load() {
        try (var stream = TokyoCourseMapReference.class.getResourceAsStream("/races/tokyo-marathon-2026-reference.json")) {
            if (stream == null) throw new IllegalStateException("Tokyo course reference missing");
            Data data = new ObjectMapper().readValue(stream, Data.class);
            if (data.routePoints().size() != 600 || data.imageSha256().isEmpty()) throw new IllegalStateException("Invalid Tokyo course reference");
            return data;
        } catch (Exception error) {
            throw new IllegalStateException("Unable to load verified Tokyo course reference", error);
        }
    }

    record Course(List<RoutePoint> routePoints, List<Integer> elevationSamples, Integer totalClimbMeters, String sourceUrl) {
        RaceCourseMapResult preview(String imageUrl) {
            double north = routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow();
            double south = routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow();
            double east = routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow();
            double west = routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow();
            return new RaceCourseMapResult(imageUrl, TokyoMarathonOfficialCourse.OFFICIAL_SOURCE, true, 90,
                    SUMMARY, new OverlayBounds(north, south, east, west), routePoints, elevationSamples, totalClimbMeters, false);
        }
    }

    private record Data(String sourceUrl, int sourcePage, String geometryProvenance, List<String> imageSha256,
                        List<RoutePoint> routePoints, List<Integer> elevationSamples, Integer totalClimbMeters) { }
}
