package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/races")
public class RaceController {
    private final AuthService authService;
    private final RaceEventRepository raceEventRepository;
    private final ActivityRepository activityRepository;
    private final RaceOfficialImageService raceOfficialImageService;
    private final RaceElevationProfileService raceElevationProfileService;
    private final RaceCourseMapService raceCourseMapService;

    public RaceController(
            AuthService authService,
            RaceEventRepository raceEventRepository,
            ActivityRepository activityRepository,
            RaceOfficialImageService raceOfficialImageService,
            RaceElevationProfileService raceElevationProfileService,
            RaceCourseMapService raceCourseMapService
    ) {
        this.authService = authService;
        this.raceEventRepository = raceEventRepository;
        this.activityRepository = activityRepository;
        this.raceOfficialImageService = raceOfficialImageService;
        this.raceElevationProfileService = raceElevationProfileService;
        this.raceCourseMapService = raceCourseMapService;
    }

    @GetMapping
    public ResponseEntity<?> list(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        Runner runner = runnerOptional.get();
        List<Activity> runActivities = activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN);
        List<RaceEventResponse> races = raceEventRepository.findByRunnerOrderByEventDateAsc(runner).stream()
                .map(race -> toResponse(race, runActivities))
                .toList();

        return ResponseEntity.ok(races);
    }

    @GetMapping("/saved-status")
    public ResponseEntity<?> savedStatus(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam("name") String name
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        try {
            if (name == null || name.trim().isBlank()) {
                return error(HttpStatus.BAD_REQUEST, "Race name is required.");
            }
            String normalizedName = name.trim();
            InputSanitizer.rejectControlAndHtmlChars(normalizedName, "name");

            Optional<RaceEvent> raceOptional =
                    raceEventRepository.findFirstByRunnerAndNameIgnoreCaseOrderByEventDateAsc(runnerOptional.get(), normalizedName);
            return ResponseEntity.ok(new SavedRaceStatusResponse(
                    raceOptional.isPresent(),
                    raceOptional.map(RaceEvent::getId).orElse(null)
            ));
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
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        ValidationResult validation = validateRequest(request);
        if (!validation.valid()) {
            return error(HttpStatus.BAD_REQUEST, validation.message());
        }

        RaceEvent raceEvent = new RaceEvent();
        applyRequest(raceEvent, request);
        raceEvent.setRunner(runnerOptional.get());
        RaceEvent saved = raceEventRepository.save(raceEvent);
        List<Activity> runActivities = activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runnerOptional.get(), ActivityType.RUN);
        return ResponseEntity.ok(toResponse(saved, runActivities));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody RaceEventRequest request
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        ValidationResult validation = validateRequest(request);
        if (!validation.valid()) {
            return error(HttpStatus.BAD_REQUEST, validation.message());
        }

        Optional<RaceEvent> raceOptional = raceEventRepository.findByIdAndRunner(id, runnerOptional.get());
        if (raceOptional.isEmpty()) {
            return error(HttpStatus.NOT_FOUND, "Race not found.");
        }

        RaceEvent raceEvent = raceOptional.get();
        applyRequest(raceEvent, request);
        RaceEvent saved = raceEventRepository.save(raceEvent);
        List<Activity> runActivities = activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runnerOptional.get(), ActivityType.RUN);
        return ResponseEntity.ok(toResponse(saved, runActivities));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        Optional<RaceEvent> raceOptional = raceEventRepository.findByIdAndRunner(id, runnerOptional.get());
        if (raceOptional.isEmpty()) {
            return error(HttpStatus.NOT_FOUND, "Race not found.");
        }

        raceEventRepository.delete(raceOptional.get());
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

    private void applyRequest(RaceEvent raceEvent, RaceEventRequest request) {
        raceEvent.setName(request.name().trim());
        raceEvent.setOrganization(InputSanitizer.trimToNull(request.organization()));
        raceEvent.setLocation(InputSanitizer.trimToNull(request.location()));
        raceEvent.setEventDate(request.eventDate());
        raceEvent.setDistanceKm(request.distanceKm());
        raceEvent.setRegistrationStatus(parseStatus(request.registrationStatus()));
        raceEvent.setGoalTimeSeconds(request.goalTimeSeconds());
        raceEvent.setNotes(InputSanitizer.trimToNull(request.notes()));
        raceEvent.setNyrrNinePlusOneEligible(Boolean.TRUE.equals(request.nyrrNinePlusOneEligible()));
        raceEvent.setCompletedActivityId(request.completedActivityId());
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

    private RaceEventResponse toResponse(RaceEvent raceEvent, List<Activity> runActivities) {
        Activity matchedActivity = resolveMatchedActivity(raceEvent, runActivities);
        boolean completed = matchedActivity != null || raceEvent.getRegistrationStatus() == RaceRegistrationStatus.COMPLETED;
        long countdownDays = ChronoUnit.DAYS.between(LocalDate.now(), raceEvent.getEventDate());

        return new RaceEventResponse(
                raceEvent.getId(),
                raceEvent.getName(),
                raceEvent.getOrganization(),
                raceEvent.getLocation(),
                raceEvent.getEventDate(),
                raceEvent.getDistanceKm(),
                raceEvent.getRegistrationStatus().name(),
                raceEvent.getGoalTimeSeconds(),
                raceEvent.getNotes(),
                raceEvent.isNyrrNinePlusOneEligible(),
                raceEvent.getCompletedActivityId(),
                completed,
                countdownDays,
                matchedActivity == null ? null : new LinkedActivitySummary(
                        matchedActivity.getId(),
                        matchedActivity.getName(),
                        matchedActivity.getStartTime(),
                        matchedActivity.getStartDate(),
                        matchedActivity.getDistanceKm(),
                        matchedActivity.getMovingTimeSeconds()
                )
        );
    }

    private Activity resolveMatchedActivity(RaceEvent raceEvent, List<Activity> runActivities) {
        if (raceEvent.getCompletedActivityId() != null) {
            for (Activity activity : runActivities) {
                if (raceEvent.getCompletedActivityId().equals(activity.getId())) {
                    return activity;
                }
            }
        }

        if (raceEvent.getEventDate() == null) {
            return null;
        }

        List<ActivityCandidate> candidates = new ArrayList<>();
        for (Activity activity : runActivities) {
            LocalDate activityDate = extractActivityDate(activity);
            if (activityDate == null) {
                continue;
            }

            long dayDelta = Math.abs(ChronoUnit.DAYS.between(raceEvent.getEventDate(), activityDate));
            if (dayDelta > 2) {
                continue;
            }

            double activityKm = resolveDistanceKm(activity);
            if (activityKm <= 0) {
                continue;
            }

            if (raceEvent.getDistanceKm() != null && raceEvent.getDistanceKm() > 0) {
                double toleranceKm = Math.max(1.5, raceEvent.getDistanceKm() * 0.15);
                if (Math.abs(activityKm - raceEvent.getDistanceKm()) > toleranceKm) {
                    continue;
                }
            }

            candidates.add(new ActivityCandidate(activity, dayDelta, Math.abs(activityKm - Optional.ofNullable(raceEvent.getDistanceKm()).orElse(activityKm))));
        }

        return candidates.stream()
                .min(Comparator.comparingLong(ActivityCandidate::dayDelta).thenComparingDouble(ActivityCandidate::distanceDelta))
                .map(ActivityCandidate::activity)
                .orElse(null);
    }

    private LocalDate extractActivityDate(Activity activity) {
        if (activity.getStartTime() != null) {
            return activity.getStartTime().toLocalDate();
        }
        if (activity.getStartDate() != null && !activity.getStartDate().isBlank()) {
            String value = activity.getStartDate();
            if (value.length() >= 10) {
                try {
                    return LocalDate.parse(value.substring(0, 10));
                } catch (Exception ignored) {
                    return null;
                }
            }
        }
        return null;
    }

    private double resolveDistanceKm(Activity activity) {
        if (activity.getDistanceKm() > 0) {
            return activity.getDistanceKm();
        }
        if (activity.getDistanceMeters() != null && activity.getDistanceMeters() > 0) {
            return activity.getDistanceMeters() / 1000.0;
        }
        return 0;
    }

    private RaceRegistrationStatus parseStatus(String value) {
        if (value == null || value.isBlank()) {
            return RaceRegistrationStatus.INTERESTED;
        }
        try {
            return RaceRegistrationStatus.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ignored) {
            return RaceRegistrationStatus.INTERESTED;
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
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
        payload.put("elevationSamples", List.of());
        payload.put("totalClimbMeters", null);
        payload.put("aiAssisted", false);
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
        payload.put("elevationSamples", routeAvailable && result != null && result.elevationSamples() != null ? result.elevationSamples() : List.of());
        payload.put("totalClimbMeters", routeAvailable && result != null ? result.totalClimbMeters() : null);
        payload.put("aiAssisted", courseMapAvailable && result != null && result.aiAssisted());
        return payload;
    }

    private boolean hasVerifiedRoute(RaceCourseMapResult result) {
        return result != null
                && result.courseMapDetected()
                && result.routePoints() != null
                && !result.routePoints().isEmpty();
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

    private record ActivityCandidate(Activity activity, long dayDelta, double distanceDelta) {
    }

    public record RaceEventRequest(
            String name,
            String organization,
            String location,
            LocalDate eventDate,
            Double distanceKm,
            String registrationStatus,
            Integer goalTimeSeconds,
            String notes,
            Boolean nyrrNinePlusOneEligible,
            Long completedActivityId
    ) {
    }

    public record LinkedActivitySummary(
            Long id,
            String name,
            java.time.LocalDateTime startTime,
            String startDate,
            double distanceKm,
            int movingTimeSeconds
    ) {
    }

    public record RaceEventResponse(
            Long id,
            String name,
            String organization,
            String location,
            LocalDate eventDate,
            Double distanceKm,
            String registrationStatus,
            Integer goalTimeSeconds,
            String notes,
            boolean nyrrNinePlusOneEligible,
            Long completedActivityId,
            boolean completed,
            long countdownDays,
            LinkedActivitySummary matchedActivity
    ) {
    }

    public record SavedRaceStatusResponse(
            boolean saved,
            Long raceId
    ) {
    }
}
