package com.hermes.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class RaceCourseMapAiService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final RaceCourseMapGeometryService geometryService;

    @Value("${app.ai.api-key:}")
    private String aiApiKey;

    @Value("${app.ai.model:gemini-2.0-flash}")
    private String aiModel;

    @Value("${app.ai.provider:gemini}")
    private String aiProvider;

    public RaceCourseMapAiService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            RaceCourseMapGeometryService geometryService
    ) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.geometryService = geometryService;
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
        if (alignment == null) return null;
        RaceCourseMapService.RouteGeometryDiagnosis diagnosis = geometryService.diagnoseRouteGeometry(alignment.routePoints(), raceType, distanceKm);
        if (!diagnosis.needsCorrectionPrompt()) {
            return alignment;
        }
        RaceCourseMapService.CourseMapAlignment corrected = requestAlignment(
                imageBytes,
                mediaType,
                buildAlignmentPrompt(raceName, city, country, latitude, longitude, distanceKm, true, raceType, diagnosis.feedbackPrompt()),
                latitude,
                longitude,
                distanceKm,
                raceType
        );
        if (corrected == null) {
            return alignment;
        }
        double originalScore = scoreAlignmentCandidate(alignment, latitude, longitude, distanceKm, raceType);
        double correctedScore = scoreAlignmentCandidate(corrected, latitude, longitude, distanceKm, raceType);
        return correctedScore >= originalScore ? corrected : alignment;
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
        String text = "claude".equalsIgnoreCase(aiProvider)
                ? callClaude(imageBytes, mediaType, prompt)
                : callGemini(imageBytes, mediaType, prompt);
        if (text == null || text.isBlank()) return null;
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
                    """.formatted(formatDistanceKm(distanceKm));
            case POINT_TO_POINT -> """
                    Race type: point-to-point.
                    Total distance: %s km.
                    """.formatted(formatDistanceKm(distanceKm));
        };
        String correctiveFeedbackBlock = correctiveFeedback == null || correctiveFeedback.isBlank()
                ? ""
                : "Correction request:\n- " + correctiveFeedback.trim() + "\n";
        return """
                You are aligning a road-race course map image to the real world.
                Decide if the image is an actual course map for the race, not a medal, hero banner, sponsor graphic, or elevation-only chart.
                Poster-style official race graphics still count as course maps when they visibly include a route line over a city map, landmarks, district labels, or a start/finish course diagram.
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
                If multiple lines appear close together, trace only ONE continuous directed path.
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
                  "finishLabel": "optional",
                  "candidateAlignments": [
                    {
                      "confidence": 0,
                      "summary": "optional alternate hypothesis",
                      "overlayBounds": { "north": 0, "south": 0, "east": 0, "west": 0 },
                      "routePoints": [
                        { "lat": 0, "lng": 0, "label": "Start" }
                      ],
                      "startLabel": "optional",
                      "finishLabel": "optional"
                    }
                  ]
                }

                Rules:
                - If the image is not a course map, return isCourseMap=false, confidence<=25, overlayBounds=null, routePoints=[].
                - Output routePoints as an ordered array from START to FINISH.
                - Each point must be strictly further along the course than the previous.
                - Never backtrack unless this is an explicit out-and-back race.
                - Use 24 to 48 route points when the map supports it.
                - Provide 48 to 96 route points for courses with overlapping or parallel segments.
                - Place extra points at every junction where two lines diverge or merge.
                - Keep points approximate but geographically plausible.
                - overlayBounds must cover the visible course-map canvas, not only the route line.
                - Do not invent extreme precision. If unsure, lower confidence instead of hallucinating.
                - Prefer official city geography implied by the image labels and race metadata.
                - Ensure the route points roughly match the distanceKm provided.
                - When multiple interpretations are plausible, include 2 to 3 candidateAlignments ordered best-first and repeat the single best hypothesis in the top-level fields.

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
                correctiveFeedbackBlock
        );
    }

    private String callGemini(byte[] imageBytes, String mediaType, String prompt) {
        Map<String, Object> request = Map.of(
                "contents", List.of(Map.of(
                        "parts", List.of(
                                Map.of("inline_data", Map.of(
                                        "mime_type", mediaType,
                                        "data", Base64.getEncoder().encodeToString(imageBytes)
                                )),
                                Map.of("text", prompt)
                        )
                ))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + aiModel + ":generateContent?key=" + aiApiKey;

        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(request, headers), Map.class);
        Map<?, ?> body = response.getBody();
        if (body == null) return null;
        Object candidates = body.get("candidates");
        if (!(candidates instanceof List<?> list) || list.isEmpty() || !(list.get(0) instanceof Map<?, ?> first)) return null;
        Object content = first.get("content");
        if (!(content instanceof Map<?, ?> contentMap)) return null;
        Object parts = contentMap.get("parts");
        if (!(parts instanceof List<?> partList) || partList.isEmpty() || !(partList.get(0) instanceof Map<?, ?> partMap)) return null;
        Object text = partMap.get("text");
        return text instanceof String value ? value : null;
    }

    private String callClaude(byte[] imageBytes, String mediaType, String prompt) {
        Map<String, Object> request = Map.of(
                "model", aiModel,
                "max_tokens", 2048,
                "messages", List.of(Map.of(
                        "role", "user",
                        "content", List.of(
                                Map.of("type", "image",
                                        "source", Map.of(
                                                "type", "base64",
                                                "media_type", mediaType,
                                                "data", Base64.getEncoder().encodeToString(imageBytes)
                                        )),
                                Map.of("type", "text", "text", prompt)
                        )
                ))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", aiApiKey);
        headers.set("anthropic-version", "2023-06-01");

        ResponseEntity<Map> response = restTemplate.exchange(
                "https://api.anthropic.com/v1/messages",
                HttpMethod.POST,
                new HttpEntity<>(request, headers),
                Map.class
        );
        Map<?, ?> body = response.getBody();
        if (body == null) return null;
        Object content = body.get("content");
        if (!(content instanceof List<?> list) || list.isEmpty() || !(list.get(0) instanceof Map<?, ?> first)) return null;
        Object text = first.get("text");
        return text instanceof String value ? value : null;
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
                return null;
            }
            return chooseBestAlignment(alignments, latitude, longitude, distanceKm, raceType);
        } catch (Exception ignored) {
            return null;
        }
    }

    private RaceCourseMapService.CourseMapAlignment parseAlignmentCandidate(Object raw, boolean defaultIsCourseMap, RaceCourseMapService.PromptRaceType raceType) {
        if (!(raw instanceof Map<?, ?> map)) return null;
        boolean isCourseMap = map.containsKey("isCourseMap")
                ? Boolean.TRUE.equals(map.get("isCourseMap"))
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

    private int clampConfidence(Object value) {
        Double parsed = asDouble(value);
        if (parsed == null) return 0;
        return Math.max(0, Math.min(100, (int) Math.round(parsed)));
    }

    private String formatDistanceKm(Double distanceKm) {
        return distanceKm == null ? "unknown" : String.format(Locale.ROOT, "%.3f", distanceKm);
    }
}
