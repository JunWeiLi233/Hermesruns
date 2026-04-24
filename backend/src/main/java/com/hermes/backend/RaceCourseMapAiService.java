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
        RaceCourseMapService.CourseMapAlignment alignment = requestAlignment(
                imageBytes,
                mediaType,
                promptBuilder.buildAlignmentPrompt(raceName, city, country, latitude, longitude, distanceKm, forceRouteExtraction, raceType, null),
                latitude,
                longitude,
                distanceKm,
                raceType
        );
        if (alignment == null) {
            scanWatcher.record("qwen.alignment_missing", "failed", "Qwen returned no parseable course-map alignment.");
            return null;
        }
        RaceCourseMapService.RouteGeometryDiagnosis diagnosis = geometryService.diagnoseRouteGeometry(alignment.routePoints(), raceType, distanceKm);
        String rescuePrompt = null;
        if (diagnosis.needsCorrectionPrompt()) {
            rescuePrompt = diagnosis.feedbackPrompt();
            scanWatcher.record("qwen.rescue_requested", "running", "Route geometry diagnosis requested a corrective Qwen pass.", Map.of(
                    "routePoints", alignment.routePoints() == null ? 0 : alignment.routePoints().size(),
                    "reason", "geometry"
            ));
        } else {
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
                scanWatcher.record("qwen.rescue_requested", "running", "Plausibility checks requested a corrective Qwen pass.", Map.of(
                        "routePoints", alignment.routePoints() == null ? 0 : alignment.routePoints().size(),
                        "reason", plausibilityVerdict.reason() == null ? "" : plausibilityVerdict.reason()
                ));
            }
        }
        if (rescuePrompt == null || rescuePrompt.isBlank()) {
            return alignment;
        }
        RaceCourseMapService.CourseMapAlignment corrected = requestAlignment(
                imageBytes,
                mediaType,
                promptBuilder.buildAlignmentPrompt(raceName, city, country, latitude, longitude, distanceKm, true, raceType, rescuePrompt),
                latitude,
                longitude,
                distanceKm,
                raceType
        );
        if (corrected == null) {
            scanWatcher.record("qwen.rescue_parse_failed", "failed", "Corrective Qwen pass returned no parseable alignment.");
            return null;
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
        if (!correctedPlausibility.plausible()) {
            scanWatcher.record("qwen.rescue_rejected", "failed", "Corrective Qwen pass still failed route plausibility checks.", Map.of(
                    "routePoints", corrected.routePoints() == null ? 0 : corrected.routePoints().size(),
                    "reason", correctedPlausibility.reason() == null ? "" : correctedPlausibility.reason()
            ));
            return null;
        }
        double originalScore = scoreAlignmentCandidate(alignment, latitude, longitude, distanceKm, raceType);
        double correctedScore = scoreAlignmentCandidate(corrected, latitude, longitude, distanceKm, raceType);
        scanWatcher.record("qwen.rescue_scored", "completed", "Corrective Qwen pass scored against the original alignment.", Map.of(
                "originalScore", Math.round(originalScore * 100.0) / 100.0,
                "correctedScore", Math.round(correctedScore * 100.0) / 100.0,
                "selected", "corrected"
        ));
        return corrected;
    }

    private RaceCourseMapService.CourseMapAlignment requestAlignment(
            byte[] imageBytes,
            String mediaType,
            String prompt,
            Double latitude,
            Double longitude,
            Double distanceKm,
            RaceCourseMapService.PromptRaceType raceType
    ) {
        String text = callQwen(imageBytes, mediaType, prompt);
        if (text == null || text.isBlank()) {
            scanWatcher.record("qwen.response_empty", "failed", "Qwen returned an empty alignment response.");
            return null;
        }
        return parseAlignment(text, latitude, longitude, distanceKm, raceType);
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

}
