package com.hermes.backend.activity.analysis;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;

/** Source-only import payload. No inferred labels, timestamps, or runner edits. */
public final class SessionAnalysisSources {
    private static final ObjectMapper JSON = new ObjectMapper();
    private SessionAnalysisSources() {}
    public record Lap(String id, String kind, Integer startSeconds, Integer endSeconds,
                      Double durationSeconds, Double distanceMeters, String label) {}
    public static String encode(List<Lap> laps) {
        if (laps == null || laps.isEmpty()) return null;
        try { return JSON.writeValueAsString(laps); }
        catch (Exception invalid) { throw new IllegalStateException("Cannot encode imported laps", invalid); }
    }
    public static List<Lap> decode(String encoded) {
        if (encoded == null || encoded.isBlank()) return List.of();
        try { return JSON.readValue(encoded, new TypeReference<List<Lap>>() {}); }
        catch (Exception invalid) { throw new IllegalStateException("Cannot decode imported laps", invalid); }
    }
}
