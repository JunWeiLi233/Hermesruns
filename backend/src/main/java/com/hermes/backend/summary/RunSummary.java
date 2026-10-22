package com.hermes.backend.summary;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * What can be said about one run, as findings rather than sentences: each says what it found (an id and a variant), carries
 * the numbers it was worked out from and the thresholds of the rule that decided it. The browser words it, in the runner's
 * language and distance unit, and shows the numbers and the rule when asked. Nothing here is stored.
 *
 * @param state  {@code ready} when there is a headline, or {@code none} when there is nothing to say ({@code reason} says why)
 * @param reason {@code too_short} for a run too short to read anything from; null when ready
 * @param day    the runner's day for the run
 * @param findings the headline first, then the lines, the most worth saying first
 */
public record RunSummary(Long runId, String state, String reason, LocalDate day, List<Finding> findings) {

    public static final String READY = "ready";
    public static final String NONE = "none";
    public static final String TOO_SHORT = "too_short";

    /**
     * @param id         what kind of finding: character, effort, pace, shape, drift, form, climb, longest
     * @param variant    which way it came out, e.g. faster, slower, similar
     * @param tone       positive, neutral or caution: how to colour it, never a verdict
     * @param weight     how much it is worth saying; the headline is always first whatever its weight
     * @param facts      the numbers it was worked out from, in the units stored (seconds per km, km, seconds, percent)
     * @param thresholds the numbers of the rule that decided it
     */
    public record Finding(String id, String variant, String tone, int weight, Map<String, Object> facts, Map<String, Object> thresholds) {
    }

    static RunSummary none(Long runId, LocalDate day, String reason) {
        return new RunSummary(runId, NONE, reason, day, List.of());
    }

    static RunSummary ready(Long runId, LocalDate day, List<Finding> findings) {
        return new RunSummary(runId, READY, null, day, findings);
    }
}
