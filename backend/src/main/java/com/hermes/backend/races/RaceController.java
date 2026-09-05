package com.hermes.backend.races;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.infrastructure.web.InputSanitizer;
import com.hermes.backend.races.model.RaceEventRequest;
import com.hermes.backend.runner.Runner;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/races")
public class RaceController {
    private final AuthService authService;
    private final RaceEventService raceEventService;
    private final RaceOfficialImageService raceOfficialImageService;
    private final RaceElevationProfileService raceElevationProfileService;
    private final RaceCourseMapService raceCourseMapService;

    public RaceController(AuthService authService, RaceEventService raceEventService,
                          RaceOfficialImageService raceOfficialImageService,
                          RaceElevationProfileService raceElevationProfileService,
                          RaceCourseMapService raceCourseMapService) {
        this.authService = authService;
        this.raceEventService = raceEventService;
        this.raceOfficialImageService = raceOfficialImageService;
        this.raceElevationProfileService = raceElevationProfileService;
        this.raceCourseMapService = raceCourseMapService;
    }

    @GetMapping
    public ResponseEntity<?> list(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) return unauthorized();
        return ResponseEntity.ok(raceEventService.list(runnerOptional.get()));
    }

    @GetMapping("/saved-status")
    public ResponseEntity<?> savedStatus(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam("name") String name
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) return unauthorized();
        try {
            if (name == null || name.trim().isBlank()) {
                return error(HttpStatus.BAD_REQUEST, "Race name is required.");
            }
            String normalizedName = name.trim();
            InputSanitizer.rejectControlAndHtmlChars(normalizedName, "name");
            return ResponseEntity.ok(raceEventService.savedStatus(runnerOptional.get(), normalizedName));
        } catch (IllegalArgumentException error) {
            return error(HttpStatus.BAD_REQUEST, error.getMessage());
        }
    }

    @PostMapping
    public ResponseEntity<?> create(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody RaceEventRequest request
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) return unauthorized();
        ValidationResult validation = validateRequest(request);
        if (!validation.valid()) return error(HttpStatus.BAD_REQUEST, validation.message());
        return saveResponse(raceEventService.create(runnerOptional.get(), request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody RaceEventRequest request
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) return unauthorized();
        ValidationResult validation = validateRequest(request);
        if (!validation.valid()) return error(HttpStatus.BAD_REQUEST, validation.message());
        return saveResponse(raceEventService.update(id, runnerOptional.get(), request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) return unauthorized();
        if (!raceEventService.delete(id, runnerOptional.get())) {
            return error(HttpStatus.NOT_FOUND, "Race not found.");
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/official-image")
    public ResponseEntity<?> officialImage(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam("website") String website
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }
        try {
            String imageUrl = raceOfficialImageService.resolveOfficialImage(website);
            return ResponseEntity.ok(Map.of("imageUrl", imageUrl == null ? "" : imageUrl));
        } catch (IllegalArgumentException error) {
            return error(HttpStatus.BAD_REQUEST, error.getMessage());
        } catch (Exception error) {
            return ResponseEntity.ok(Map.of("imageUrl", ""));
        }
    }

    @GetMapping("/elevation-profile")
    public ResponseEntity<?> elevationProfile(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam("name") String name,
            @RequestParam(value = "city", required = false) String city,
            @RequestParam(value = "country", required = false) String country,
            @RequestParam(value = "website", required = false) String website
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }
        try {
            if (name == null || name.trim().isBlank()) {
                return error(HttpStatus.BAD_REQUEST, "Race name is required.");
            }
            InputSanitizer.rejectControlAndHtmlChars(name, "name");
            InputSanitizer.rejectControlAndHtmlChars(city, "city");
            InputSanitizer.rejectControlAndHtmlChars(country, "country");
            RaceElevationProfileService.RaceElevationProfileResult result =
                    raceElevationProfileService.resolveProfile(name, city, country, website);
            return ResponseEntity.ok(Map.of(
                    "imageUrl", result.imageUrl() == null ? "" : result.imageUrl(),
                    "source", result.source() == null ? "" : result.source(),
                    "localizedFallbackUsed", result.localizedFallbackUsed(),
                    "profileSamples", result.profileSamples() == null ? List.of() : result.profileSamples()
            ));
        } catch (IllegalArgumentException error) {
            return error(HttpStatus.BAD_REQUEST, error.getMessage());
        } catch (Exception error) {
            return ResponseEntity.ok(Map.of(
                    "imageUrl", "",
                    "source", "",
                    "localizedFallbackUsed", false,
                    "profileSamples", List.of()
            ));
        }
    }

    @GetMapping("/course-map")
    public ResponseEntity<?> courseMap(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "raceId", required = false) String raceId,
            @RequestParam("name") String name,
            @RequestParam(value = "city", required = false) String city,
            @RequestParam(value = "country", required = false) String country,
            @RequestParam(value = "website", required = false) String website,
            @RequestParam(value = "lat", required = false) Double lat,
            @RequestParam(value = "lng", required = false) Double lng,
            @RequestParam(value = "distanceKm", required = false) Double distanceKm
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }
        try {
            if (name == null || name.trim().isBlank()) {
                return error(HttpStatus.BAD_REQUEST, "Race name is required.");
            }
            InputSanitizer.rejectControlAndHtmlChars(name, "name");
            InputSanitizer.rejectControlAndHtmlChars(city, "city");
            InputSanitizer.rejectControlAndHtmlChars(country, "country");
            RaceCourseMapResult result =
                    raceId == null || raceId.isBlank()
                            ? raceCourseMapService.resolveCourseMap(name, city, country, website, lat, lng, distanceKm)
                            : raceCourseMapService.resolveCourseMapWithStorage(raceId, name, city, country, website, lat, lng, distanceKm);
            Map<String, Object> payload = toRunnerCourseMapPayload(result);
            return ResponseEntity.ok(payload);
        } catch (IllegalArgumentException error) {
            return error(HttpStatus.BAD_REQUEST, error.getMessage());
        } catch (Exception error) {
            return ResponseEntity.ok(emptyCourseMapPayload());
        }
    }

    @GetMapping("/course-map-image")
    public ResponseEntity<?> courseMapImage(@RequestParam("ref") String imageReference) {
        if (imageReference != null && (imageReference.contains("..") || imageReference.startsWith("/") || imageReference.contains("\\"))) {
            return ResponseEntity.badRequest().body("Invalid ref parameter");
        }
        try {
            RaceCourseMapImageService.DisplayableCourseMapImage image =
                    raceCourseMapService.resolveDisplayableLocalImage(imageReference);
            if (image == null || image.imageBytes() == null || image.imageBytes().length == 0) {
                return ResponseEntity.notFound().build();
            }
            String mediaType = image.mediaType() == null || image.mediaType().isBlank()
                    ? "image/jpeg"
                    : image.mediaType();
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(mediaType))
                    .header("Cache-Control", "public, max-age=604800, immutable")
                    .body(image.imageBytes());
        } catch (Exception error) {
            return ResponseEntity.notFound().build();
        }
    }

    private ValidationResult validateRequest(RaceEventRequest request) {
        if (request == null) {
            return invalid("Race payload is required.");
        }
        if (request.name() == null || request.name().trim().isBlank()) {
            return invalid("Race name is required.");
        }
        if (request.eventDate() == null) {
            return invalid("Race date is required.");
        }
        if (request.distanceKm() != null && request.distanceKm() <= 0) {
            return invalid("Race distance must be positive.");
        }
        if (request.goalTimeSeconds() != null && request.goalTimeSeconds() <= 0) {
            return invalid("Goal time must be positive.");
        }

        // Basic anti-XSS / injection hardening: reject control chars + HTML delimiters.
        try {
            if (request.name() != null) InputSanitizer.rejectControlAndHtmlChars(request.name(), "name");
            InputSanitizer.rejectControlAndHtmlChars(request.organization(), "organization");
            InputSanitizer.rejectControlAndHtmlChars(request.location(), "location");
            InputSanitizer.rejectControlAndHtmlChars(request.notes(), "notes");
            if (request.name() != null && request.name().length() > 120) return invalid("Race name too long.");
            if (request.organization() != null && request.organization().length() > 80) return invalid("Organization too long.");
            if (request.location() != null && request.location().length() > 120) return invalid("Location too long.");
            if (request.notes() != null && request.notes().length() > 2000) return invalid("Notes too long.");
        } catch (IllegalArgumentException ex) {
            return invalid(ex.getMessage());
        }
        return valid();
    }

    private ResponseEntity<?> saveResponse(RaceEventService.SaveResult result) {
        return switch (result.outcome()) {
            case SAVED -> ResponseEntity.ok(result.race());
            case RACE_NOT_FOUND -> error(HttpStatus.NOT_FOUND, "Race not found.");
            case ACTIVITY_FORBIDDEN -> ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Activity does not belong to you"));
        };
    }

    private ResponseEntity<Map<String, String>> unauthorized() {
        return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("error", message);
        return ResponseEntity.status(status).body(response);
    }

    private Map<String, Object> emptyCourseMapPayload() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("imageUrl", "");
        payload.put("previewImageUrl", "");
        payload.put("overlayImageUrl", "");
        payload.put("source", "");
        payload.put("routeAvailable", false);
        payload.put("confidence", 0);
        payload.put("summary", "");
        payload.put("viewportBounds", null);
        payload.put("routePoints", List.of());
        payload.put("routePointCount", 0);
        payload.put("elevationSamples", List.of());
        payload.put("totalClimbMeters", null);
        payload.put("aiAssisted", false);
        payload.put("officialRouteVerified", false);
        return payload;
    }

    private Map<String, Object> toRunnerCourseMapPayload(RaceCourseMapResult result) {
        Map<String, Object> payload = new HashMap<>();
        boolean routeAvailable = hasVerifiedRoute(result);
        boolean cityLevelReference = hasCityLevelReference(result);
        boolean courseMapAvailable = routeAvailable || cityLevelReference;
        String imageUrl = result == null || result.imageUrl() == null ? "" : result.imageUrl();
        String previewImageUrl = imageUrl.isBlank()
                ? ""
                : raceCourseMapService.materializePreviewImageUrl(imageUrl);
        String overlayImageUrl = routeAvailable && result != null && result.overlayBounds() != null && !imageUrl.isBlank()
                ? raceCourseMapService.materializeTransparentOverlayImageUrl(imageUrl)
                : "";
        payload.put("imageUrl", imageUrl);
        payload.put("previewImageUrl", previewImageUrl == null || previewImageUrl.isBlank() ? imageUrl : previewImageUrl);
        payload.put("overlayImageUrl", overlayImageUrl == null ? "" : overlayImageUrl);
        payload.put("source", result == null || result.source() == null ? "" : result.source());
        payload.put("routeAvailable", courseMapAvailable);
        payload.put("cityLevelReference", cityLevelReference);
        payload.put("confidence", courseMapAvailable && result != null ? result.confidence() : 0);
        payload.put("summary", result == null || result.summary() == null ? "" : result.summary());
        payload.put("viewportBounds", courseMapAvailable && result != null ? result.overlayBounds() : null);
        payload.put("routePoints", routeAvailable && result != null && result.routePoints() != null ? result.routePoints() : List.of());
        payload.put("routePointCount", routeAvailable && result != null && result.routePoints() != null ? result.routePoints().size() : 0);
        payload.put("elevationSamples", routeAvailable && result != null && result.elevationSamples() != null ? result.elevationSamples() : List.of());
        payload.put("totalClimbMeters", routeAvailable && result != null ? result.totalClimbMeters() : null);
        payload.put("aiAssisted", courseMapAvailable && result != null && result.aiAssisted());
        payload.put("officialRouteVerified", routeAvailable && isOfficialGpsRoute(result));
        return payload;
    }

    private boolean hasVerifiedRoute(RaceCourseMapResult result) {
        return result != null
                && result.courseMapDetected()
                && result.routePoints() != null
                && !result.routePoints().isEmpty();
    }

    private boolean isOfficialGpsRoute(RaceCourseMapResult result) {
        if (!hasVerifiedRoute(result)) return false;
        String summary = result.summary() == null ? "" : result.summary().toLowerCase(java.util.Locale.ROOT);
        return summary.contains("official gpx")
                || summary.contains("official gps")
                || summary.contains("gpx-grounded")
                || summary.contains("official-route gpx");
    }

    private boolean hasCityLevelReference(RaceCourseMapResult result) {
        if (result == null || !result.courseMapDetected() || result.overlayBounds() == null) return false;
        if (result.routePoints() != null && !result.routePoints().isEmpty()) return false;
        String summary = result.summary() == null ? "" : result.summary().toLowerCase(java.util.Locale.ROOT);
        return result.confidence() >= 58
                && result.aiAssisted()
                && summary.contains("city-level course-map match")
                && summary.contains("not a distance-accurate route overlay");
    }

    private static ValidationResult invalid(String message) {
        return new ValidationResult(false, message);
    }

    private static ValidationResult valid() {
        return new ValidationResult(true, null);
    }

    private record ValidationResult(boolean valid, String message) {
    }

}
