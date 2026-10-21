package com.hermes.backend.activity.analysis;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.activity.*;
import com.hermes.backend.runner.Runner;
import java.time.Clock;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static com.hermes.backend.activity.analysis.SessionAnalysisMeasurements.*;

@Service
public class SessionAnalysisService {
    private static final List<String> DIMENSIONS = List.of("workout", "recovery", "route", "terrain", "surface", "weather");
    private static final Set<String> KINDS = Set.of("work", "recovery", "warmup", "cooldown", "unknown");
    private final ActivityRepository activities;
    private final ActivityPointRepository points;
    private final SessionAnalysisActivityRepository lockedActivities;
    private final ObjectMapper json;
    private final Clock clock;
    public SessionAnalysisService(ActivityRepository activities, ActivityPointRepository points,
            SessionAnalysisActivityRepository lockedActivities, ObjectMapper json, Clock clock) {
        this.activities = activities; this.points = points; this.lockedActivities = lockedActivities; this.json = json; this.clock = clock;
    }
    public record Segment(String id, String kind, Integer startSeconds, Integer endSeconds, String label,
            Double targetPaceSecondsPerKm, String provenance, Measurement measurements) {}
    public record Declaration(String id, String kind, Integer startSeconds, Integer endSeconds, String label, Double targetPaceSecondsPerKm) {}
    public record Declarations(List<Declaration> segments, Map<String, String> comparison) {}
    public record Value(Object value, String provenance) {}

    @Transactional(readOnly = true)
    public Map<String, Object> read(Long id, Runner owner) { return state(owned(id, owner), owner); }

    @Transactional
    public Map<String, Object> save(Long id, Runner owner, Map<String, Object> request) {
        Activity activity = lockedActivities.findOwnedForUpdate(id, owner).filter(a -> a.getActivityType() == ActivityType.RUN)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Declarations previous = declarations(activity);
        JsonNode body = json.valueToTree(request);
        if (body == null || !body.isObject() || body.size() == 0) throw invalid("Supply segments or comparison.");
        body.fieldNames().forEachRemaining(key -> { if (!Set.of("segments", "comparison").contains(key)) throw invalid("Unknown declaration field: " + key); });
        List<Declaration> segments = previous.segments();
        if (body.has("segments")) segments = validateSegments(body.get("segments"), bound(activity, samples(activity)));
        Map<String, String> comparison = previous.comparison();
        if (body.has("comparison")) comparison = validateComparison(body.get("comparison"));
        Declarations next = new Declarations(segments, comparison);
        String encoded = encode(next);
        if (!encoded.equals(encode(previous))) {
            activity.setSessionAnalysisDeclarationsJson(encoded);
            activity.setSessionAnalysisUpdatedAt(clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MICROS));
            activities.saveAndFlush(activity);
        }
        return state(activity, owner);
    }

    private Activity owned(Long id, Runner owner) {
        return activities.findByIdAndRunner(id, owner).filter(a -> a.getActivityType() == ActivityType.RUN)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    private List<Sample> samples(Activity activity) {
        // All callers reach here only after findByIdAndRunner / the locked owner gate above.
        return points.findAnalyticsSamplesByActivityIdOrdered(activity.getId()).stream().map(row -> new Sample(
                row[2] == null ? null : ((Number)row[2]).intValue(), finite(row[3]),
                row[5] == null ? null : ((Number)row[5]).intValue(), row[6] == null ? null : ((Number)row[6]).intValue())).toList();
    }
    private Map<String, Object> state(Activity activity, Runner owner) {
        List<Sample> samples = samples(activity);
        List<SessionAnalysisSources.Lap> laps = SessionAnalysisSources.decode(activity.getSourceImportedLapsJson());
        // A timer-only fallback bounds explicit declarations; it is never an observed elapsed extent.
        Integer elapsed = knownElapsed(samples, laps);
        Declarations declarations = declarations(activity);
        List<Segment> source = laps.stream().map(lap -> new Segment(lap.id(), lap.kind(), lap.startSeconds(), lap.endSeconds(), lap.label(), null,
                "imported", measure(samples, lap.startSeconds(), lap.endSeconds(), lap.durationSeconds(), lap.distanceMeters(), "source-lap"))).toList();
        List<Segment> effective;
        if (declarations.segments() != null) effective = declarations.segments().stream().map(d -> new Segment(d.id(), d.kind(), d.startSeconds(), d.endSeconds(), d.label(), d.targetPaceSecondsPerKm(),
                "runner-declared", measure(samples, d.startSeconds(), d.endSeconds(), (double)(d.endSeconds() - d.startSeconds()),
                boundaryDistance(samples, d.startSeconds(), d.endSeconds()), "derived-stream"))).toList();
        else {
            // Explicit source roles are authoritative; generic auto-laps can be refined from telemetry.
            var detected = source.stream().anyMatch(s -> !"unknown".equals(s.kind()))
                    ? List.<SessionIntervalDetection.Span>of() : SessionIntervalDetection.detect(samples);
            if (!detected.isEmpty()) effective = detected.stream().map(d -> new Segment(
                    "detected-" + d.start() + "-" + d.end(), d.kind(), d.start(), d.end(), null, null,
                    "auto-detected", measure(samples, d.start(), d.end(), (double)(d.end() - d.start()),
                    boundaryDistance(samples, d.start(), d.end()), "derived-stream"))).toList();
            else if (!source.isEmpty()) effective = source;
            else effective = elapsed != null && elapsed > 0 ? List.of(new Segment("session", "unknown", 0, elapsed, null, null, "unknown",
                    measure(samples, 0, elapsed, sourceDuration(activity), sourceDistance(activity), "source-summary"))) : List.of();
        }
        var output = new LinkedHashMap<String, Object>();
        output.put("activityId", activity.getId()); output.put("name", activity.getName());
        output.put("startTime", activity.getStartTime() == null ? null : activity.getStartTime().toString()); output.put("startDate", activity.getStartDate());
        Map<String, Object> time = ActivityLocalDates.responseFields(activity.getStartTime(), activity.isStravaApiSourced(), owner);
        output.putAll(time); output.put("startLocalDate", time.get("accountLocalDate"));
        output.put("startTimeUtc", time.get("activityInstant")); output.put("timeProvenance", time.get("timeRepresentation"));
        var sourceInfo = new LinkedHashMap<String, Object>(); sourceInfo.put("provider", activity.getProvider());
        sourceInfo.put("distanceMeters", sourceDistance(activity)); sourceInfo.put("durationSeconds", sourceDuration(activity));
        sourceInfo.put("movingTimeSeconds", activity.getMovingTimeSeconds()); sourceInfo.put("elapsedDurationSeconds", knownElapsed(samples, laps));
        sourceInfo.put("importedLapsSupported", !laps.isEmpty()); output.put("source", sourceInfo);
        output.put("declarations", declarations); output.put("sourceSegments", source); output.put("segments", effective);
        output.put("measurements", measure(samples, elapsed == null ? null : 0, elapsed, sourceDuration(activity), sourceDistance(activity), "source-summary"));
        var conditions = new LinkedHashMap<String, Value>(); DIMENSIONS.forEach(key -> conditions.put(key, new Value(null, "unavailable")));
        Integer rpe = activity.getPerceivedExertion();
        output.put("recorded", Map.of("rpe", new Value(rpe, rpe == null ? "unavailable" : "recorded"), "conditions", conditions));
        output.put("measurementRules", Map.of("heartRateIntegration", "trapezoid-adjacent-valid-endpoints", "maximumIntegratedGapSeconds", MAX_INTEGRATED_GAP_SECONDS,
                "coverageDenominator", "elapsed-boundary-span", "segmentDistance", "exact-cumulative-boundaries", "sourcePace", "source-timer-duration-per-distance"));
        output.put("updatedAt", activity.getSessionAnalysisUpdatedAt() == null ? null : activity.getSessionAnalysisUpdatedAt().toString());
        return output;
    }
    private List<Declaration> validateSegments(JsonNode node, int bound) {
        if (node == null || node.isNull()) return null;
        if (!node.isArray() || node.size() > 200) throw invalid("Supply at most 200 ordered intervals.");
        List<Declaration> result = new ArrayList<>(); Set<String> ids = new HashSet<>(); int previousEnd = 0;
        for (JsonNode segment : node) {
            if (!segment.isObject()) throw invalid("Invalid interval.");
            String id = string(segment.get("id"), 80), kind = string(segment.get("kind"), 20);
            if (id == null || !ids.add(id)) throw invalid("Interval ids must be nonempty and unique.");
            if (!KINDS.contains(kind == null ? "" : kind)) throw invalid("Unknown interval kind.");
            int start = integer(segment.get("startSeconds")), end = integer(segment.get("endSeconds"));
            if (start < previousEnd || end <= start || end > bound) throw invalid("Intervals must be ordered, nonoverlapping, and within the source extent.");
            previousEnd = end;
            String label = string(segment.get("label"), 160);
            JsonNode target = segment.get("targetPaceSecondsPerKm"); Double pace = null;
            if (target != null && !target.isNull()) {
                if (!target.isNumber() || !Double.isFinite(target.asDouble()) || target.asDouble() <= 0) throw invalid("Target pace must be positive seconds per kilometre.");
                pace = target.asDouble();
            }
            result.add(new Declaration(id, kind, start, end, label, pace));
        }
        return List.copyOf(result);
    }
    private Map<String, String> validateComparison(JsonNode node) {
        if (node != null && !node.isNull() && !node.isObject()) throw invalid("Comparison must be an object or null.");
        if (node != null && node.isObject()) node.fieldNames().forEachRemaining(key -> { if (!DIMENSIONS.contains(key)) throw invalid("Unknown comparison dimension: " + key); });
        var result = new LinkedHashMap<String, String>();
        for (String key : DIMENSIONS) result.put(key, string(node == null ? null : node.get(key), 240));
        return result;
    }
    private Declarations declarations(Activity activity) {
        String encoded = activity.getSessionAnalysisDeclarationsJson();
        if (encoded == null) return new Declarations(null, validateComparison(null));
        try { return json.readValue(encoded, Declarations.class); }
        catch (Exception invalid) { throw new IllegalStateException("Invalid stored session declarations", invalid); }
    }
    private String encode(Declarations declarations) {
        try { return json.writeValueAsString(declarations); }
        catch (Exception invalid) { throw new IllegalStateException("Cannot encode declarations", invalid); }
    }
    private int bound(Activity activity, List<Sample> samples) {
        Integer elapsed = knownElapsed(samples, SessionAnalysisSources.decode(activity.getSourceImportedLapsJson()));
        if (elapsed != null) return elapsed;
        Double duration = sourceDuration(activity); return duration == null ? 0 : (int)Math.min(Integer.MAX_VALUE, duration);
    }
    private static Integer knownElapsed(List<Sample> samples, List<SessionAnalysisSources.Lap> laps) {
        Integer end = null;
        for (Sample sample : samples) if (sample.seconds() != null && sample.seconds() >= 0) end = end == null ? sample.seconds() : Math.max(end, sample.seconds());
        for (var lap : laps) if (lap.endSeconds() != null) end = end == null ? lap.endSeconds() : Math.max(end, lap.endSeconds());
        return end;
    }
    private static Double sourceDuration(Activity activity) {
        return activity.getDurationSeconds() != null && activity.getDurationSeconds() >= 0 ? activity.getDurationSeconds().doubleValue()
                : activity.getMovingTimeSeconds() > 0 ? (double)activity.getMovingTimeSeconds() : null;
    }
    private static Double sourceDistance(Activity activity) {
        Double distance = finite(activity.getDistanceMeters());
        return distance != null ? distance : activity.getDistanceKm() > 0 ? finite(activity.getDistanceKm() * 1000) : null;
    }
    private static Double finite(Object value) {
        if (!(value instanceof Number number)) return null;
        double d = number.doubleValue(); return Double.isFinite(d) && d >= 0 ? d : null;
    }
    private static int integer(JsonNode value) {
        if (value == null || !value.isIntegralNumber() || !value.canConvertToInt() || value.asInt() < 0) throw invalid("Boundaries must be nonnegative integer seconds.");
        return value.asInt();
    }
    private static String string(JsonNode value, int max) {
        if (value == null || value.isNull()) return null;
        if (!value.isTextual() || value.asText().length() > max) throw invalid("Invalid or too long declaration text.");
        String text = value.asText().trim(); return text.isEmpty() ? null : text;
    }
    private static IllegalArgumentException invalid(String message) { return new IllegalArgumentException(message); }
}
