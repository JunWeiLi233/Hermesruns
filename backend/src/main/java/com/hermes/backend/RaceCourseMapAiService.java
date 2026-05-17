package com.hermes.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class RaceCourseMapAiService {
    private static final Map<String, Object> ROUTE_POINT_SCHEMA = Map.of(
            "type", "object",
            "properties", Map.of(
                    "lat", Map.of("type", "number"),
                    "lng", Map.of("type", "number"),
                    "label", Map.of("type", "string")
            ),
            "required", List.of("lat", "lng"),
            "additionalProperties", false
    );
    private static final Map<String, Object> OVERLAY_BOUNDS_SCHEMA = Map.of(
            "type", List.of("object", "null"),
            "properties", Map.of(
                    "north", Map.of("type", "number"),
                    "south", Map.of("type", "number"),
                    "east", Map.of("type", "number"),
                    "west", Map.of("type", "number")
            ),
            "required", List.of("north", "south", "east", "west"),
            "additionalProperties", false
    );
    private static final Map<String, Object> CANDIDATE_ALIGNMENT_SCHEMA = Map.of(
            "type", "object",
            "properties", Map.of(
                    "confidence", Map.of("type", "number"),
                    "summary", Map.of("type", "string"),
                    "overlayBounds", OVERLAY_BOUNDS_SCHEMA,
                    "routePoints", Map.of("type", "array", "items", ROUTE_POINT_SCHEMA),
                    "startLabel", Map.of("type", "string"),
                    "finishLabel", Map.of("type", "string")
            ),
            "required", List.of("confidence", "summary", "routePoints"),
            "additionalProperties", false
    );
    private static final Map<String, Object> ALIGNMENT_RESPONSE_SCHEMA = Map.of(
            "type", "object",
            "properties", Map.of(
                    "isCourseMap", Map.of("type", "boolean"),
                    "confidence", Map.of("type", "number"),
                    "summary", Map.of("type", "string"),
                    "overlayBounds", OVERLAY_BOUNDS_SCHEMA,
                    "routePoints", Map.of("type", "array", "items", ROUTE_POINT_SCHEMA),
                    "startLabel", Map.of("type", "string"),
                    "finishLabel", Map.of("type", "string"),
                    "candidateAlignments", Map.of("type", "array", "items", CANDIDATE_ALIGNMENT_SCHEMA)
            ),
            "required", List.of("isCourseMap", "confidence", "summary", "routePoints"),
            "additionalProperties", false
    );

    private final ObjectMapper objectMapper;
    private final RaceCourseMapGeometryService geometryService;
    private final QwenCourseMapAlignmentClient qwenCourseMapAlignmentClient;
    private final CourseMapScanWatcher scanWatcher;
    private final RaceCourseMapPromptBuilder promptBuilder;

    public RaceCourseMapAiService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            RaceCourseMapGeometryService geometryService
    ) {
        this(restTemplate, objectMapper, geometryService, new QwenCourseMapAlignmentClient(objectMapper), new CourseMapScanWatcher(), new RaceCourseMapPromptBuilder());
    }

    public RaceCourseMapAiService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            RaceCourseMapGeometryService geometryService,
            QwenCourseMapAlignmentClient qwenCourseMapAlignmentClient
    ) {
        this(restTemplate, objectMapper, geometryService, qwenCourseMapAlignmentClient, new CourseMapScanWatcher(), new RaceCourseMapPromptBuilder());
    }

    @org.springframework.beans.factory.annotation.Autowired
    public RaceCourseMapAiService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            RaceCourseMapGeometryService geometryService,
            QwenCourseMapAlignmentClient qwenCourseMapAlignmentClient,
            CourseMapScanWatcher scanWatcher,
            RaceCourseMapPromptBuilder promptBuilder
    ) {
        this.objectMapper = objectMapper;
        this.geometryService = geometryService;
        this.qwenCourseMapAlignmentClient = qwenCourseMapAlignmentClient;
        this.scanWatcher = scanWatcher;
        this.promptBuilder = promptBuilder;
    }

    public RaceCourseMapService.CourseMapAlignment analyzeCandidate(
            String imageReference,
            byte[] imageBytes,
            String raceName,
            String city,
            String country,
            Double latitude,
            Double longitude,
            Double distanceKm,
            boolean forceRouteExtraction,
            RaceCourseMapService.PromptRaceType raceType,
            String mediaType
    ) {
        return analyzeCandidate(
                imageReference,
                imageBytes,
                raceName,
                city,
                country,
                latitude,
                longitude,
                distanceKm,
                forceRouteExtraction,
                raceType,
                mediaType,
                false
        );
    }

    public RaceCourseMapService.CourseMapAlignment analyzeCandidate(
            String imageReference,
            byte[] imageBytes,
            String raceName,
            String city,
            String country,
            Double latitude,
            Double longitude,
            Double distanceKm,
            boolean forceRouteExtraction,
            RaceCourseMapService.PromptRaceType raceType,
            String mediaType,
            boolean preserveRejectedAlignment
    ) {
        scanWatcher.beginStep("qwen.build_prompt", "Building Qwen alignment prompt with race context.");
        String promptText = promptBuilder.buildAlignmentPrompt(raceName, city, country, latitude, longitude, distanceKm, forceRouteExtraction, raceType, null);
        scanWatcher.completeStep("qwen.build_prompt", "SUCCESS", "Alignment prompt built.", Map.of(
                "promptChars", promptText.length(),
                "forceRouteExtraction", forceRouteExtraction,
                "raceType", raceType == null ? "" : raceType.name()
        ));

        // Preprocess the image once here and reuse the prepared bytes for both the
        // initial alignment call and any rescue call. This avoids repeating the
        // resize → contrast-enhance → sharpen pipeline on the same image bytes.
        scanWatcher.beginStep("qwen.image_preprocess", "Preprocessing course-map image for Qwen (shared for all passes).");
        byte[] preparedImageBytes = QwenImagePreprocessor.preprocessBytes(imageBytes);
        String preparedMediaType = preparedImageBytes == imageBytes ? mediaType : "image/png";
        scanWatcher.completeStep("qwen.image_preprocess", "SUCCESS", "Image preprocessing complete (shared for all passes).", Map.of(
                "originalMediaType", mediaType == null ? "" : mediaType,
                "finalMediaType", preparedMediaType
        ));

        scanWatcher.beginStep("qwen.call", "Sending course-map alignment request to Qwen.");
        RaceCourseMapService.CourseMapAlignment alignment = requestAlignmentPrepared(
                preparedImageBytes,
                preparedMediaType,
                promptText,
                latitude,
                longitude,
                distanceKm,
                raceType
        );
        if (alignment == null) {
            scanWatcher.completeStep("qwen.call", "FAILED", "Qwen returned no parseable course-map alignment.");
            scanWatcher.record("qwen.alignment_missing", "FAILED", "Qwen returned no parseable course-map alignment.");
            return null;
        }
        scanWatcher.completeStep("qwen.call", "SUCCESS", "Qwen returned a parseable alignment.", Map.of(
                "confidence", alignment.confidence(),
                "routePoints", alignment.routePoints() == null ? 0 : alignment.routePoints().size(),
                "isCourseMap", alignment.isCourseMap()
        ));
        if (!alignment.isCourseMap()) {
            scanWatcher.beginStep("qwen.decision", "Final alignment decision - Qwen did not detect a course map.");
            scanWatcher.completeStep("qwen.decision", "SUCCESS", "Non-course-map response accepted without rescue pass.", Map.of(
                    "confidence", alignment.confidence()
            ));
            return alignment;
        }

        scanWatcher.beginStep("qwen.geometry_check", "Running route geometry diagnosis on Qwen alignment.");
        RaceCourseMapService.RouteGeometryDiagnosis diagnosis = geometryService.diagnoseRouteGeometry(alignment.routePoints(), raceType, distanceKm);
        String rescuePrompt = null;
        String rescueReason = null;
        if (diagnosis.needsCorrectionPrompt()) {
            rescuePrompt = diagnosis.feedbackPrompt();
            rescueReason = "geometry";
            scanWatcher.completeStep("qwen.geometry_check", "FAILED", "Route geometry diagnosis requested a corrective Qwen pass.", Map.of(
                    "routePoints", alignment.routePoints() == null ? 0 : alignment.routePoints().size(),
                    "reason", "geometry"
            ));
            scanWatcher.record("qwen.rescue_requested", "RUNNING", "Route geometry diagnosis requested a corrective Qwen pass.", Map.of(
                    "routePoints", alignment.routePoints() == null ? 0 : alignment.routePoints().size(),
                    "reason", "geometry"
            ));
        } else {
            scanWatcher.completeStep("qwen.geometry_check", "SUCCESS", "Route geometry passed diagnosis checks.");
            scanWatcher.beginStep("qwen.plausibility_check", "Running alignment plausibility assessment.");
            RaceCourseMapGeometryService.AlignmentPlausibilityVerdict plausibilityVerdict =
                    geometryService.assessAlignmentPlausibility(
                            alignment.routePoints(),
                            latitude,
                            longitude,
                            distanceKm,
                            promptBuilder.minimumRoutePointCountForRescue(raceType),
                            raceType
                    );
            if (!plausibilityVerdict.plausible()) {
                rescuePrompt = promptBuilder.buildPlausibilityRescuePrompt(plausibilityVerdict, raceType, distanceKm);
                rescueReason = plausibilityVerdict.reason();
                scanWatcher.completeStep("qwen.plausibility_check", "FAILED", "Plausibility checks requested a corrective Qwen pass.", Map.of(
                        "routePoints", alignment.routePoints() == null ? 0 : alignment.routePoints().size(),
                        "reason", plausibilityVerdict.reason() == null ? "" : plausibilityVerdict.reason()
                ));
                scanWatcher.record("qwen.rescue_requested", "RUNNING", "Plausibility checks requested a corrective Qwen pass.", Map.of(
                        "routePoints", alignment.routePoints() == null ? 0 : alignment.routePoints().size(),
                        "reason", plausibilityVerdict.reason() == null ? "" : plausibilityVerdict.reason()
                ));
            } else {
                scanWatcher.completeStep("qwen.plausibility_check", "SUCCESS", "Alignment passed plausibility checks.");
            }
        }
        if (rescuePrompt == null || rescuePrompt.isBlank()) {
            scanWatcher.beginStep("qwen.known_course_check", "Running known-course geography verification.");
            KnownCourseGeographyVerdict geographyVerdict = assessKnownCourseGeography(alignment, raceName, city, country);
            if (!geographyVerdict.valid()) {
                rescuePrompt = geographyVerdict.correctivePrompt();
                rescueReason = geographyVerdict.reason();
                scanWatcher.completeStep("qwen.known_course_check", "FAILED", "Known-course geography checks requested a corrective Qwen pass.", Map.of(
                        "routePoints", alignment.routePoints() == null ? 0 : alignment.routePoints().size(),
                        "reason", geographyVerdict.reason()
                ));
                scanWatcher.record("qwen.rescue_requested", "RUNNING", "Known-course geography checks requested a corrective Qwen pass.", Map.of(
                        "routePoints", alignment.routePoints() == null ? 0 : alignment.routePoints().size(),
                        "reason", geographyVerdict.reason()
                ));
            } else {
                scanWatcher.completeStep("qwen.known_course_check", "SUCCESS", "Known-course geography checks passed.");
            }
        }
        if (rescuePrompt == null || rescuePrompt.isBlank()) {
            scanWatcher.beginStep("qwen.decision", "Final alignment decision — no rescue needed.");
            scanWatcher.completeStep("qwen.decision", "SUCCESS", "Alignment accepted without rescue pass.", Map.of(
                    "confidence", alignment.confidence(),
                    "routePoints", alignment.routePoints() == null ? 0 : alignment.routePoints().size()
            ));
            return alignment;
        }

        scanWatcher.beginStep("qwen.rescue", "Running corrective Qwen pass with rescue prompt.");
        RaceCourseMapService.CourseMapAlignment corrected = requestAlignmentPrepared(
                preparedImageBytes,
                preparedMediaType,
                promptBuilder.buildAlignmentPrompt(raceName, city, country, latitude, longitude, distanceKm, true, raceType, rescuePrompt),
                latitude,
                longitude,
                distanceKm,
                raceType
        );
        if (corrected == null) {
            scanWatcher.completeStep("qwen.rescue", "FAILED", "Corrective Qwen pass returned no parseable alignment.");
            scanWatcher.record("qwen.rescue_parse_failed", "FAILED", "Corrective Qwen pass returned no parseable alignment.");
            return preserveRejectedAlignment ? alignment : null;
        }
        RaceCourseMapGeometryService.AlignmentPlausibilityVerdict correctedPlausibility =
                geometryService.assessAlignmentPlausibility(
                        corrected.routePoints(),
                        latitude,
                        longitude,
                        distanceKm,
                        promptBuilder.minimumRoutePointCountForRescue(raceType),
                        raceType
                );
        KnownCourseGeographyVerdict correctedGeography = assessKnownCourseGeography(corrected, raceName, city, country);
        double originalScore = scoreAlignmentCandidate(alignment, latitude, longitude, distanceKm, raceType);
        double correctedScore = scoreAlignmentCandidate(corrected, latitude, longitude, distanceKm, raceType);
        String rescueOutcome;
        if (!correctedGeography.valid()) {
            rescueOutcome = "FAILED: still failed known-course geography checks";
            scanWatcher.completeStep("qwen.rescue", "FAILED", "Corrective Qwen pass still failed known-course geography checks.", Map.of(
                    "routePoints", corrected.routePoints() == null ? 0 : corrected.routePoints().size(),
                    "reason", correctedGeography.reason()
            ));
            scanWatcher.record("qwen.rescue_rejected", "FAILED", "Corrective Qwen pass still failed known-course geography checks.", Map.of(
                    "routePoints", corrected.routePoints() == null ? 0 : corrected.routePoints().size(),
                    "reason", correctedGeography.reason()
            ));
            return preserveRejectedAlignment ? alignment : null;
        }
        if (!correctedPlausibility.plausible()) {
            if (isUsableLowerDensityCorrectiveRoute(corrected, correctedPlausibility.reason(), distanceKm)
                    && correctedScore > originalScore) {
                rescueOutcome = "SUCCESS: lower-density corrected route accepted";
                scanWatcher.completeStep("qwen.rescue", "SUCCESS", "Corrective Qwen pass improved the route but remained below the dense-route point target.", Map.of(
                        "routePoints", corrected.routePoints() == null ? 0 : corrected.routePoints().size(),
                        "reason", correctedPlausibility.reason() == null ? "" : correctedPlausibility.reason(),
                        "originalScore", Math.round(originalScore * 100.0) / 100.0,
                        "correctedScore", Math.round(correctedScore * 100.0) / 100.0
                ));
                scanWatcher.record("qwen.rescue_lower_density_accepted", "SUCCESS", "Corrective Qwen pass improved the route but remained below the dense-route point target.", Map.of(
                        "routePoints", corrected.routePoints() == null ? 0 : corrected.routePoints().size(),
                        "reason", correctedPlausibility.reason() == null ? "" : correctedPlausibility.reason(),
                        "originalScore", Math.round(originalScore * 100.0) / 100.0,
                        "correctedScore", Math.round(correctedScore * 100.0) / 100.0
                ));
                return corrected;
            }
            if (isUsableLowerDensityCorrectiveRoute(alignment, rescueReason, distanceKm)
                    && originalScore >= correctedScore) {
                rescueOutcome = "SUCCESS: original lower-density route preserved (corrective regressed)";
                scanWatcher.completeStep("qwen.rescue", "SUCCESS", "Corrective Qwen pass regressed, so Hermes kept the lower-density original route.", Map.of(
                        "routePoints", alignment.routePoints() == null ? 0 : alignment.routePoints().size(),
                        "reason", rescueReason == null ? "" : rescueReason,
                        "originalScore", Math.round(originalScore * 100.0) / 100.0,
                        "correctedScore", Math.round(correctedScore * 100.0) / 100.0
                ));
                scanWatcher.record("qwen.rescue_original_preserved", "SUCCESS", "Corrective Qwen pass regressed, so Hermes kept the lower-density original route.", Map.of(
                        "routePoints", alignment.routePoints() == null ? 0 : alignment.routePoints().size(),
                        "reason", rescueReason == null ? "" : rescueReason,
                        "originalScore", Math.round(originalScore * 100.0) / 100.0,
                        "correctedScore", Math.round(correctedScore * 100.0) / 100.0
                ));
                return alignment;
            }
            rescueOutcome = "FAILED: still failed route plausibility checks";
            scanWatcher.completeStep("qwen.rescue", "FAILED", "Corrective Qwen pass still failed route plausibility checks.", Map.of(
                "routePoints", corrected.routePoints() == null ? 0 : corrected.routePoints().size(),
                "reason", correctedPlausibility.reason() == null ? "" : correctedPlausibility.reason()
            ));
            scanWatcher.record("qwen.rescue_rejected", "FAILED", "Corrective Qwen pass still failed route plausibility checks.", Map.of(
                "routePoints", corrected.routePoints() == null ? 0 : corrected.routePoints().size(),
                "reason", correctedPlausibility.reason() == null ? "" : correctedPlausibility.reason()
            ));
            return preserveRejectedAlignment ? alignment : null;
        }
        rescueOutcome = "SUCCESS: corrected alignment scored against original";
        scanWatcher.completeStep("qwen.rescue", "SUCCESS", "Corrective Qwen pass scored against the original alignment.", Map.of(
                "originalScore", Math.round(originalScore * 100.0) / 100.0,
                "correctedScore", Math.round(correctedScore * 100.0) / 100.0,
                "selected", "corrected"
        ));
        scanWatcher.record("qwen.rescue_scored", "SUCCESS", "Corrective Qwen pass scored against the original alignment.", Map.of(
                "originalScore", Math.round(originalScore * 100.0) / 100.0,
                "correctedScore", Math.round(correctedScore * 100.0) / 100.0,
                "selected", "corrected"
        ));
        return corrected;
    }

    private KnownCourseGeographyVerdict assessKnownCourseGeography(
            RaceCourseMapService.CourseMapAlignment alignment,
            String raceName,
            String city,
            String country
    ) {
        List<RoutePoint> routePoints = alignment == null || alignment.routePoints() == null
                ? List.of()
                : alignment.routePoints();
        KnownCourseGeographyProfile profile = knownCourseGeographyProfile(raceName, city, country);
        if (routePoints.isEmpty() || profile == null) {
            return KnownCourseGeographyVerdict.ok();
        }
        for (RoutePoint point : routePoints) {
            if (profile.isNewYorkCityMarathon() && isNewYorkOpenWaterPoint(point)) {
                String reason = profile.courseName() + " route includes an open water checkpoint near New York Harbor or the Atlantic Ocean at "
                        + String.format(Locale.ROOT, "%.4f, %.4f", point.lat(), point.lng());
                String prompt = reason
                        + ". Re-read the visible course line and labels instead of guessing from race memory. "
                        + "The route may cross the Verrazzano-Narrows Bridge, Queensboro Bridge, and other visible bridge corridors, "
                        + "but it must not draw checkpoints through open water. If the image cannot visually support the full route, return routePoints=[] with low confidence.";
                return KnownCourseGeographyVerdict.invalid(reason, prompt);
            }
            if (!profile.contains(point)) {
                String reason = profile.courseName() + " route includes a checkpoint outside the known "
                        + profile.courseName()
                        + " corridor at "
                        + String.format(Locale.ROOT, "%.4f, %.4f", point.lat(), point.lng());
                String prompt = reason
                        + ". Re-read the visible course line and labels instead of stretching the route outside the known race corridor. "
                        + "Use known-course context only to choose among visible map evidence, not to create unseen geometry. "
                        + "If the image cannot visually support the full route, return routePoints=[] with low confidence.";
                return KnownCourseGeographyVerdict.invalid(reason, prompt);
            }
        }
        return KnownCourseGeographyVerdict.ok();
    }

    private KnownCourseGeographyProfile knownCourseGeographyProfile(String raceName, String city, String country) {
        String combined = String.join(
                " ",
                promptBuilder.safePromptValue(raceName),
                promptBuilder.safePromptValue(city),
                promptBuilder.safePromptValue(country)
        ).toLowerCase(Locale.ROOT);
        if (!combined.contains("marathon")) {
            return null;
        }
        for (KnownCourseGeographyProfile profile : knownCourseGeographyProfiles()) {
            if (profile.matches(combined)) {
                return profile;
            }
        }
        return null;
    }

    private List<KnownCourseGeographyProfile> knownCourseGeographyProfiles() {
        return List.of(
                new KnownCourseGeographyProfile("New York City Marathon", List.of("new york", "nyc"), 40.5800, 40.8600, -74.1800, -73.9200),
                new KnownCourseGeographyProfile("Chicago Marathon", List.of("chicago"), 41.7650, 41.9900, -87.7200, -87.5900),
                new KnownCourseGeographyProfile("Boston Marathon", List.of("boston"), 42.2050, 42.3700, -71.5450, -71.0350),
                new KnownCourseGeographyProfile("Paris Marathon", List.of("paris"), 48.8150, 48.8950, 2.2500, 2.4700),
                new KnownCourseGeographyProfile("Munich Marathon", List.of("munich", "munchen", "muenchen"), 48.1050, 48.1900, 11.5050, 11.6400),
                new KnownCourseGeographyProfile("Gold Coast Marathon", List.of("gold coast"), -28.1050, -27.8950, 153.3800, 153.4700)
        );
    }

    private boolean isNewYorkOpenWaterPoint(RoutePoint point) {
        if (point == null) return false;
        double lat = point.lat();
        double lng = point.lng();
        boolean lowerBayOrAtlantic = lat < 40.595 && lng > -74.020 && lng < -73.700;
        boolean offshoreSouthOfBrooklyn = lat < 40.555 && lng > -74.160 && lng < -73.700;
        return lowerBayOrAtlantic || offshoreSouthOfBrooklyn;
    }

    /**
     * Invoke Qwen with already-preprocessed image bytes. Preprocessing (resize, contrast-enhance,
     * sharpen) must be applied by the caller before this method — call
     * {@link QwenImagePreprocessor#preprocessBytes(byte[])} once and reuse the result for all
     * passes (initial + rescue) to avoid redundant work.
     */
    private RaceCourseMapService.CourseMapAlignment requestAlignmentPrepared(
            byte[] preparedBytes,
            String preparedMediaType,
            String prompt,
            Double latitude,
            Double longitude,
            Double distanceKm,
            RaceCourseMapService.PromptRaceType raceType
    ) {
        scanWatcher.beginStep("qwen.invoke", "Calling Qwen vision model for course-map alignment.");
        String text = callQwen(preparedBytes, preparedMediaType, prompt);
        if (text == null || text.isBlank()) {
            scanWatcher.completeStep("qwen.invoke", "FAILED", "Qwen returned an empty alignment response.");
            scanWatcher.record("qwen.response_empty", "FAILED", "Qwen returned an empty alignment response.");
            return null;
        }
        scanWatcher.completeStep("qwen.invoke", "SUCCESS", "Qwen returned alignment response text.", Map.of(
                "responseChars", text.length()
        ));

        scanWatcher.beginStep("qwen.parse_json", "Parsing Qwen JSON alignment response.");
        RaceCourseMapService.CourseMapAlignment result = parseAlignment(text, latitude, longitude, distanceKm, raceType);
        if (result == null) {
            scanWatcher.completeStep("qwen.parse_json", "FAILED", "Failed to parse Qwen alignment JSON.");
        } else {
            scanWatcher.completeStep("qwen.parse_json", "SUCCESS", "Qwen JSON parsed into alignment candidate.", Map.of(
                    "confidence", result.confidence(),
                    "routePoints", result.routePoints() == null ? 0 : result.routePoints().size()
            ));
        }
        return result;
    }



    private String callQwen(byte[] imageBytes, String mediaType, String prompt) {
        return qwenCourseMapAlignmentClient.analyzeCandidate(imageBytes, mediaType, prompt);
    }

    private RaceCourseMapService.CourseMapAlignment parseAlignment(String text, Double latitude, Double longitude, Double distanceKm, RaceCourseMapService.PromptRaceType raceType) {
        try {
            String json = extractJsonObject(text);
            if (json == null) return null;
            Map<String, Object> parsed = objectMapper.readValue(json, new TypeReference<>() {});
            List<RaceCourseMapService.CourseMapAlignment> alignments = new ArrayList<>();
            RaceCourseMapService.CourseMapAlignment rootAlignment = parseAlignmentCandidate(parsed, false, raceType);
            if (rootAlignment != null) {
                alignments.add(rootAlignment);
            }
            Object rawCandidates = parsed.get("candidateAlignments");
            if (rawCandidates instanceof List<?> candidateList) {
                for (Object candidate : candidateList) {
                    RaceCourseMapService.CourseMapAlignment parsedCandidate = parseAlignmentCandidate(candidate, true, raceType);
                    if (parsedCandidate != null) {
                        alignments.add(parsedCandidate);
                    }
                }
            }
            if (alignments.isEmpty()) {
                scanWatcher.record("qwen.alignment_parse_empty", "failed", "Qwen JSON contained no usable alignment candidates.");
                return null;
            }
            RaceCourseMapService.CourseMapAlignment best = chooseBestAlignment(alignments, latitude, longitude, distanceKm, raceType);
            scanWatcher.record("qwen.alignment_parsed", "completed", "Qwen JSON parsed into route alignment candidates.", Map.of(
                    "candidateCount", alignments.size(),
                    "selectedRoutePoints", best == null || best.routePoints() == null ? 0 : best.routePoints().size(),
                    "selectedConfidence", best == null ? 0 : best.confidence()
            ));
            return best;
        } catch (Exception ex) {
            scanWatcher.record("qwen.alignment_parse_failed", "failed", "Qwen alignment JSON could not be parsed.", Map.of(
                    "error", ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage()
            ));
            return null;
        }
    }

    private RaceCourseMapService.CourseMapAlignment parseAlignmentCandidate(Object raw, boolean defaultIsCourseMap, RaceCourseMapService.PromptRaceType raceType) {
        if (!(raw instanceof Map<?, ?> map)) return null;
        boolean isCourseMap = map.containsKey("isCourseMap")
                ? asBoolean(map.get("isCourseMap"), defaultIsCourseMap)
                : defaultIsCourseMap;
        int confidence = clampConfidence(map.get("confidence"));
        String summary = asTrimmedString(map.get("summary"));
        OverlayBounds overlayBounds = parseOverlayBounds(map.get("overlayBounds"));
        List<RoutePoint> routePoints = geometryService.processRoutePoints(parseRoutePoints(map.get("routePoints")), raceType);
        return new RaceCourseMapService.CourseMapAlignment(
                isCourseMap,
                confidence,
                summary,
                overlayBounds,
                routePoints,
                asTrimmedString(map.get("startLabel")),
                asTrimmedString(map.get("finishLabel"))
        );
    }

    private String extractJsonObject(String text) {
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end <= start) return null;
        return text.substring(start, end + 1);
    }

    private OverlayBounds parseOverlayBounds(Object raw) {
        if (!(raw instanceof Map<?, ?> map)) return null;
        Double north = asDouble(map.get("north"));
        Double south = asDouble(map.get("south"));
        Double east = asDouble(map.get("east"));
        Double west = asDouble(map.get("west"));
        if (north == null || south == null || east == null || west == null) return null;
        if (north <= south || east <= west) return null;
        return new OverlayBounds(north, south, east, west);
    }

    private List<RoutePoint> parseRoutePoints(Object raw) {
        if (!(raw instanceof List<?> list)) return List.of();
        List<RoutePoint> points = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> pointMap)) continue;
            Double lat = asDouble(pointMap.get("lat"));
            Double lng = asDouble(pointMap.get("lng"));
            if (lat == null || lng == null) continue;
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
            points.add(new RoutePoint(lat, lng, asTrimmedString(pointMap.get("label"))));
        }
        return points;
    }

    private RaceCourseMapService.CourseMapAlignment chooseBestAlignment(
            List<RaceCourseMapService.CourseMapAlignment> alignments,
            Double latitude,
            Double longitude,
            Double distanceKm,
            RaceCourseMapService.PromptRaceType raceType
    ) {
        RaceCourseMapService.CourseMapAlignment best = null;
        double bestScore = Double.NEGATIVE_INFINITY;
        for (RaceCourseMapService.CourseMapAlignment alignment : alignments) {
            double score = scoreAlignmentCandidate(alignment, latitude, longitude, distanceKm, raceType);
            if (score > bestScore) {
                bestScore = score;
                best = alignment;
            }
        }
        return best;
    }

    public double scoreAlignmentCandidate(
            RaceCourseMapService.CourseMapAlignment alignment,
            Double latitude,
            Double longitude,
            Double distanceKm,
            RaceCourseMapService.PromptRaceType raceType
    ) {
        if (alignment == null) return Double.NEGATIVE_INFINITY;
        if (!alignment.isCourseMap()) {
            return alignment.confidence() - 140.0;
        }
        List<RoutePoint> routePoints = alignment.routePoints() == null ? List.of() : alignment.routePoints();
        if (routePoints.isEmpty()) {
            return -120.0;
        }

        double pointDensityFactor = Math.max(0.35, Math.min(1.6, routePoints.size() / 12.0));
        double centroidFactor = 1.0;
        if (latitude != null && longitude != null) {
            double centroidDistanceKm = geometryService.routeCentroidDistanceKm(routePoints, latitude, longitude);
            double maxCentroidDistanceKm = 50.0;
            if (centroidDistanceKm > maxCentroidDistanceKm) {
                centroidFactor = 0.05;
            } else {
                centroidFactor = Math.max(0.1, 1.0 - (centroidDistanceKm / Math.max(maxCentroidDistanceKm, 0.1)));
            }
        }

        double lengthRatioFactor = 1.0;
        if (distanceKm != null && distanceKm > 0) {
            double routeDistanceKm = geometryService.polylineDistanceKm(routePoints);
            if (isCollapsedRouteCandidate(routeDistanceKm, distanceKm)) {
                return -160.0;
            }
            RaceCourseMapService.AlignmentRatioWindow ratioWindow = new RaceCourseMapService.AlignmentRatioWindow(0.30, 3.0);
            RaceCourseMapService.AlignmentRatioWindow expectedWindow = geometryService.expectedDistanceRatioWindow(distanceKm, routePoints.size());
            double distanceRatio = routeDistanceKm / distanceKm;
            if (distanceRatio < ratioWindow.minRatio() || distanceRatio > ratioWindow.maxRatio()) {
                lengthRatioFactor = 0.05;
            } else {
                double ratioDelta = Math.abs(1.0 - distanceRatio);
                double maxRatioDelta = Math.max(1.0 - expectedWindow.minRatio(), expectedWindow.maxRatio() - 1.0);
                lengthRatioFactor = Math.max(0.2, 1.0 - Math.min(ratioDelta / Math.max(maxRatioDelta, 0.01), 0.8));
            }
        }

        RaceCourseMapService.RouteGeometryDiagnosis diagnosis = geometryService.diagnoseRouteGeometry(routePoints, raceType, distanceKm);
        double score = alignment.confidence() * pointDensityFactor * centroidFactor * lengthRatioFactor;
        if (alignment.overlayBounds() != null) score += 2.0;
        if (alignment.startLabel() != null) score += 1.0;
        if (alignment.finishLabel() != null) score += 1.0;
        score -= diagnosis.selfIntersectionPenalty();
        score -= diagnosis.startDistanceBacktrackPenalty();
        return score;
    }

    private boolean isCollapsedRouteCandidate(double routeDistanceKm, Double distanceKm) {
        if (distanceKm == null || distanceKm <= 0) return false;
        return routeDistanceKm < Math.max(1.0, distanceKm * 0.08);
    }

    private boolean isUsableLowerDensityCorrectiveRoute(
            RaceCourseMapService.CourseMapAlignment corrected,
            String plausibilityReason,
            Double distanceKm
    ) {
        if (corrected == null || !corrected.isCourseMap() || corrected.routePoints() == null) return false;
        if (plausibilityReason == null || !plausibilityReason.startsWith("route has only ")) return false;
        if (corrected.routePoints().size() < 6) return false;
        if (distanceKm == null || distanceKm <= 0) return true;
        double routeDistanceKm = geometryService.polylineDistanceKm(corrected.routePoints());
        if (isCollapsedRouteCandidate(routeDistanceKm, distanceKm)) return false;
        return routeDistanceKm >= 3.0;
    }

    private String asTrimmedString(Object value) {
        if (!(value instanceof String stringValue)) return null;
        String trimmed = stringValue.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Double asDouble(Object value) {
        if (value instanceof Number number) return number.doubleValue();
        if (value instanceof String stringValue) {
            try {
                return Double.parseDouble(stringValue.trim());
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    private boolean asBoolean(Object value, boolean fallback) {
        if (value instanceof Boolean boolValue) return boolValue;
        if (value instanceof Number numberValue) return numberValue.doubleValue() != 0.0;
        if (value instanceof String stringValue) {
            String normalized = stringValue.trim().toLowerCase(Locale.ROOT);
            if ("true".equals(normalized)) return true;
            if ("false".equals(normalized)) return false;
        }
        return fallback;
    }

    private int clampConfidence(Object value) {
        Double parsed = asDouble(value);
        if (parsed == null) return 0;
        return Math.max(0, Math.min(100, (int) Math.round(parsed)));
    }

    private record KnownCourseGeographyVerdict(boolean valid, String reason, String correctivePrompt) {
        static KnownCourseGeographyVerdict ok() {
            return new KnownCourseGeographyVerdict(true, "", "");
        }

        static KnownCourseGeographyVerdict invalid(String reason, String correctivePrompt) {
            return new KnownCourseGeographyVerdict(false, reason, correctivePrompt);
        }
    }

    private record KnownCourseGeographyProfile(
            String courseName,
            List<String> matchTerms,
            double south,
            double north,
            double west,
            double east
    ) {
        boolean matches(String context) {
            for (String matchTerm : matchTerms) {
                if (context.contains(matchTerm)) {
                    return true;
                }
            }
            return false;
        }

        boolean contains(RoutePoint point) {
            if (point == null) return false;
            double padding = 0.015;
            return point.lat() >= south - padding
                    && point.lat() <= north + padding
                    && point.lng() >= west - padding
                    && point.lng() <= east + padding;
        }

        boolean isNewYorkCityMarathon() {
            return courseName.toLowerCase(Locale.ROOT).contains("new york");
        }
    }
}
