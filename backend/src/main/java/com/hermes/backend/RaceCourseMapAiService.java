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

    public RaceCourseMapAiService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            RaceCourseMapGeometryService geometryService
    ) {
        this(restTemplate, objectMapper, geometryService, new QwenCourseMapAlignmentClient(objectMapper), new CourseMapScanWatcher());
    }

    public RaceCourseMapAiService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            RaceCourseMapGeometryService geometryService,
            QwenCourseMapAlignmentClient qwenCourseMapAlignmentClient
    ) {
        this(restTemplate, objectMapper, geometryService, qwenCourseMapAlignmentClient, new CourseMapScanWatcher());
    }

    @org.springframework.beans.factory.annotation.Autowired
    public RaceCourseMapAiService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            RaceCourseMapGeometryService geometryService,
            QwenCourseMapAlignmentClient qwenCourseMapAlignmentClient,
            CourseMapScanWatcher scanWatcher
    ) {
        this.objectMapper = objectMapper;
        this.geometryService = geometryService;
        this.qwenCourseMapAlignmentClient = qwenCourseMapAlignmentClient;
        this.scanWatcher = scanWatcher;
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
                buildAlignmentPrompt(raceName, city, country, latitude, longitude, distanceKm, forceRouteExtraction, raceType, null),
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
        String rescueReason = null;
        if (diagnosis.needsCorrectionPrompt()) {
            rescuePrompt = diagnosis.feedbackPrompt();
            rescueReason = "geometry";
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
                            minimumRoutePointCountForRescue(raceType),
                            raceType
                    );
            if (!plausibilityVerdict.plausible()) {
                rescuePrompt = buildPlausibilityRescuePrompt(plausibilityVerdict, raceType, distanceKm);
                rescueReason = plausibilityVerdict.reason();
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
                buildAlignmentPrompt(raceName, city, country, latitude, longitude, distanceKm, true, raceType, rescuePrompt),
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
                        minimumRoutePointCountForRescue(raceType),
                        raceType
                );
        double originalScore = scoreAlignmentCandidate(alignment, latitude, longitude, distanceKm, raceType);
        double correctedScore = scoreAlignmentCandidate(corrected, latitude, longitude, distanceKm, raceType);
        if (!correctedPlausibility.plausible()) {
            if (isUsableLowerDensityCorrectiveRoute(corrected, correctedPlausibility.reason(), distanceKm)
                    && correctedScore > originalScore) {
                scanWatcher.record("qwen.rescue_lower_density_accepted", "completed", "Corrective Qwen pass improved the route but remained below the dense-route point target.", Map.of(
                        "routePoints", corrected.routePoints() == null ? 0 : corrected.routePoints().size(),
                        "reason", correctedPlausibility.reason() == null ? "" : correctedPlausibility.reason(),
                        "originalScore", Math.round(originalScore * 100.0) / 100.0,
                        "correctedScore", Math.round(correctedScore * 100.0) / 100.0
                ));
                return corrected;
            }
            if (isUsableLowerDensityCorrectiveRoute(alignment, rescueReason, distanceKm)
                    && originalScore > correctedScore) {
                scanWatcher.record("qwen.rescue_original_preserved", "completed", "Corrective Qwen pass regressed, so Hermes kept the lower-density original route.", Map.of(
                        "routePoints", alignment.routePoints() == null ? 0 : alignment.routePoints().size(),
                        "reason", rescueReason == null ? "" : rescueReason,
                        "originalScore", Math.round(originalScore * 100.0) / 100.0,
                        "correctedScore", Math.round(correctedScore * 100.0) / 100.0
                ));
                return alignment;
            }
            scanWatcher.record("qwen.rescue_rejected", "failed", "Corrective Qwen pass still failed route plausibility checks.", Map.of(
                "routePoints", corrected.routePoints() == null ? 0 : corrected.routePoints().size(),
                "reason", correctedPlausibility.reason() == null ? "" : correctedPlausibility.reason()
            ));
            return null;
        }
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

    private String buildAlignmentPrompt(
            String raceName,
            String city,
            String country,
            Double latitude,
            Double longitude,
            Double distanceKm,
            boolean forceRouteExtraction,
            RaceCourseMapService.PromptRaceType raceType,
            String correctiveFeedback
    ) {
        String locationContext = """
                Race location: %s, %s.
                Approximate race-area coordinates: %s, %s.
                Key landmarks near course: city center, main roads, bridges, parks, waterfront if applicable.
                %s
                """.formatted(
                safePromptValue(city),
                safePromptValue(country),
                latitude == null ? "unknown" : String.format(Locale.ROOT, "%.6f", latitude),
                longitude == null ? "unknown" : String.format(Locale.ROOT, "%.6f", longitude),
                forceRouteExtraction
                        ? "You must identify the race route even if the course map is stylized, partially visible, or embedded in a poster layout."
                        : "Prefer official course geometry over decorative page art whenever both appear."
        );
        String raceTypeInstructions = switch (raceType) {
            case OUT_AND_BACK -> """
                    Race type: out-and-back.
                    Total distance: %s km.
                    This is an out-and-back course. The map shows two parallel lines (outbound + return).
                    Trace ONLY the outbound direction (start -> turnaround).
                    The return path is a mirror - do not include it.
                    Reported distance should be HALF the total race distance.
                    """.formatted(formatDistanceKm(distanceKm));
            case LOOP -> """
                    Race type: loop.
                    Total distance: %s km.
                    Trace the entire loop, not just one neighborhood or the finish approach.
                    """.formatted(formatDistanceKm(distanceKm));
            case POINT_TO_POINT -> """
                    Race type: point-to-point.
                    Total distance: %s km.
                    Trace the FULL route from the distant start to the finish.
                    Do NOT focus only on the final downtown segment or one city section near the finish.
                    If multiple towns or districts are labeled along the course, use those labels to spread route points across the full route.
                    """.formatted(formatDistanceKm(distanceKm));
        };
        String knownCourseGuidance = knownCourseGuidance(raceName, city, country);
        String routePointCountRule = distanceKm != null && distanceKm >= 40.0 && raceType != RaceCourseMapService.PromptRaceType.OUT_AND_BACK
                ? "Return 16 to 24 routePoints total for full marathons, using widely spaced checkpoints across the entire course."
                : "Return 8 to 14 routePoints total.";
        String correctiveFeedbackBlock = correctiveFeedback == null || correctiveFeedback.isBlank()
                ? ""
                : "Correction request:\n- " + correctiveFeedback.trim() + "\n";
        return """
                You are aligning a road-race course map image to the real world.
                Scan every plausible route-bearing course-map picture before rejecting it, including printed, scanned, photographed, screenshot, PDF-rendered, raster, compressed, official poster, and social/share images.
                Decide if the image contains an actual course map for the race, not merely a medal, hero banner, sponsor graphic, or elevation-only chart.
                Do not reject solely because the map is stylized, rasterized, compressed, low-resolution, surrounded by legends/sponsor art, or embedded in a poster layout.
                Poster-style official race graphics still count as course maps when they visibly include a route line over a city map, landmarks, district labels, mile markers, aid stations, or a start/finish course diagram.
                If it is a course map, infer an approximate real-world route and map bounds from the visible labels, landmarks, districts, bridges, parks, coastline, and race context.
                Think at the highest level first: identify the overall city geography and major landmarks before tracing the route details.
                %s

                Race metadata:
                - raceName: %s
                - city: %s
                - country: %s
                - cityCenterLat: %s
                - cityCenterLng: %s
                - distanceKm: %s
                - raceType: %s

                 Route-tracing context:
                 %s
                 %s
                 If multiple lines appear close together, trace only ONE continuous directed path.
                 If the map legend or poster shows multiple named routes, prefer the official race route that best matches raceName and distanceKm.
                 Ignore shorter side events, companion community runs, and alternate promotional routes that do not match the target race.
                 Follow course arrows, timing mat markers, or directional cones if visible.
                 Do NOT zigzag between parallel lines - commit to one side.
                 %s

                Output ONLY JSON with this shape:
                {
                  "isCourseMap": true,
                  "confidence": 0,
                  "summary": "short plain summary",
                  "overlayBounds": { "north": 0, "south": 0, "east": 0, "west": 0 },
                  "routePoints": [
                    { "lat": 0, "lng": 0, "label": "Start" }
                  ],
                  "startLabel": "optional",
                  "finishLabel": "optional"
                }

                Rules:
                - confidence is an integer from 0 to 100. Use 90+ only for strongly anchored map evidence; use <=25 for non-course-map images.
                - If the image is not a course map, return isCourseMap=false, confidence<=25, overlayBounds=null, routePoints=[].
                - Only return routePoints when the route can be anchored to real-world evidence such as street labels, mile markers, landmarks, neighborhoods, water, parks, or coastline.
                - If the image proves the city/race map but cannot support a trustworthy route trace, keep isCourseMap=true with low confidence, summarize it as city-level reference only, and return routePoints=[].
                - Never fill routePoints with cityCenterLat/cityCenterLng unless that exact checkpoint is visibly anchored there.
                - Never repeat the same coordinate or a tiny city-center cluster to satisfy the requested point count.
                - If you cannot identify distinct ordered checkpoints across the real route, return routePoints=[] instead of invented coordinates.
                - Do not turn decorative route-like art into a distance-accurate overlay.
                - Output routePoints as an ordered array from START to FINISH.
                - Each point must be strictly further along the course than the previous.
                - Never backtrack unless this is an explicit out-and-back race.
                - %s
                - For routes with overlapping or parallel segments, return 14 to 24 routePoints total.
                - Prefer widely spaced points across the full route rather than many dense points from one local segment.
                - Place extra points only at major junctions where two lines diverge or merge.
                - Keep points approximate but geographically plausible.
                - overlayBounds must cover the visible course-map canvas, not only the route line.
                - Do not invent extreme precision. If unsure, lower confidence instead of hallucinating.
                - Prefer official city geography implied by the image labels and race metadata.
                - Ensure the route points roughly match the distanceKm provided.

                """.formatted(
                locationContext,
                safePromptValue(raceName),
                safePromptValue(city),
                safePromptValue(country),
                latitude == null ? "unknown" : String.format(Locale.ROOT, "%.6f", latitude),
                longitude == null ? "unknown" : String.format(Locale.ROOT, "%.6f", longitude),
                distanceKm == null ? "unknown" : String.format(Locale.ROOT, "%.3f", distanceKm),
                raceType.promptValue(),
                raceTypeInstructions,
                knownCourseGuidance,
                correctiveFeedbackBlock,
                routePointCountRule
        );
    }

    private String knownCourseGuidance(String raceName, String city, String country) {
        String combined = String.join(" ", safePromptValue(raceName), safePromptValue(city), safePromptValue(country)).toLowerCase(Locale.ROOT);
        if (combined.contains("boston marathon")) {
            return "Known Boston Marathon corridor: trace west-to-east from Hopkinton through Ashland, Framingham, Natick, Wellesley, Newton, Brookline, and into Boston/Copley. Do NOT focus only on the final downtown Boston segment.";
        }
        if (combined.contains("chicago marathon") || combined.contains("bank of america chicago marathon")) {
            return "Known Chicago Marathon corridor: start/finish in Grant Park, then spread points north through River North, Lincoln Park, Lakeview/Sheridan, back through Old Town and the Loop, west toward Greektown/United Center, south through Pilsen, Chinatown, Bridgeport, Bronzeville, and north on Michigan/Indiana to Grant Park. Do NOT reuse the Chicago city center as every checkpoint.";
        }
        return "";
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

    private String safePromptValue(String value) {
        return value == null || value.isBlank() ? "unknown" : value.trim();
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

    private String formatDistanceKm(Double distanceKm) {
        return distanceKm == null ? "unknown" : String.format(Locale.ROOT, "%.3f", distanceKm);
    }

    private int minimumRoutePointCountForRescue(RaceCourseMapService.PromptRaceType raceType) {
        return raceType == RaceCourseMapService.PromptRaceType.OUT_AND_BACK ? 5 : 12;
    }

    private String buildPlausibilityRescuePrompt(
            RaceCourseMapGeometryService.AlignmentPlausibilityVerdict plausibilityVerdict,
            RaceCourseMapService.PromptRaceType raceType,
            Double distanceKm
    ) {
        String distanceHint = distanceKm == null ? "the target race" : String.format(Locale.ROOT, "%.1f km", distanceKm);
        String routeShapeHint = raceType == RaceCourseMapService.PromptRaceType.POINT_TO_POINT
                ? "For point-to-point marathons, do not trace only the downtown finish area or one city segment. Trace the full route from the distant start location to the finish."
                : raceType == RaceCourseMapService.PromptRaceType.LOOP
                    ? "For loop races, trace the entire loop, not just one neighborhood or the finish approach."
                    : "For out-and-back races, trace the full outbound section to the true turnaround, not a small local segment.";
        return """
                The previous route hypothesis failed plausibility checks: %s
                %s
                Re-read the full map canvas, including distant towns, mile markers, start labels, and the full highlighted route line.
                The returned route should cover the full %s route, not a short local fragment.
                Do not reuse the city center, start, or finish coordinate as filler points. If the map cannot support distinct real-world checkpoints across the full route, return routePoints=[] with low confidence instead of a collapsed route.
                """.formatted(plausibilityVerdict.reason(), routeShapeHint, distanceHint).trim();
    }

}
