package com.hermes.backend.activity.analysis;

import java.util.*;
import static com.hermes.backend.activity.analysis.SessionAnalysisMeasurements.*;

/** Relative pace estimates, never source labels or persisted runner declarations. */
final class SessionIntervalDetection {
    private SessionIntervalDetection() {}
    private record Bin(int start, int end, double speed) {}
    private record Candidate(int start, int end, int fastSeconds, int firstFast) {}
    record Span(String kind, int start, int end) {}

    static List<Span> detect(List<Sample> samples) {
        var bins = new ArrayList<Bin>();
        Sample anchor = null, previous = null;
        for (Sample sample : samples) {
            if (sample.seconds() == null || sample.seconds() < 0 || sample.distanceMeters() == null
                    || !Double.isFinite(sample.distanceMeters()) || sample.distanceMeters() < 0) {
                anchor = null; previous = null; continue;
            }
            if (previous != null) {
                int dt = sample.seconds() - previous.seconds();
                double distance = sample.distanceMeters() - previous.distanceMeters();
                // A reset, conflicting duplicate or implausible jump cannot support classifications.
                if (dt < 0 || distance < 0 || (dt == 0 && distance != 0) || (dt > 0 && distance / dt > 12)) return List.of();
                if (dt > MAX_INTEGRATED_GAP_SECONDS) anchor = null;
            }
            if (anchor == null) anchor = sample;
            if (sample.seconds() - anchor.seconds() >= 20) {
                bins.add(new Bin(anchor.seconds(), sample.seconds(),
                    (sample.distanceMeters() - anchor.distanceMeters()) / (sample.seconds() - anchor.seconds())));
                anchor = sample;
            }
            previous = sample;
        }
        if (anchor != null && previous != null && previous.seconds() > anchor.seconds())
            bins.add(new Bin(anchor.seconds(), previous.seconds(),
                (previous.distanceMeters() - anchor.distanceMeters()) / (previous.seconds() - anchor.seconds())));
        var moving = bins.stream().filter(b -> b.speed >= 1.5 && b.speed <= 8).mapToDouble(Bin::speed).sorted().toArray();
        if (moving.length < 15) return List.of();
        double baseline = moving[(int)Math.floor((moving.length - 1) * .35)];
        double median = moving[moving.length / 2];
        // Both contrast and an absolute difference are required. Stops do not set the baseline.
        double enter = Math.max(Math.max(baseline * 1.18, baseline + .35), median * 1.10);
        double exit = Math.max(baseline * 1.10, median * 1.03);
        var candidates = new ArrayList<Candidate>();
        for (int i = 0; i < bins.size();) {
            Bin first = bins.get(i);
            if (first.speed < exit) { i++; continue; }
            int end = first.end, fastSeconds = first.speed >= enter ? first.end - first.start : 0;
            int firstFast = fastSeconds > 0 ? first.start : -1; i++;
            while (i < bins.size() && bins.get(i).start == end && bins.get(i).speed >= exit) {
                Bin bin = bins.get(i++); end = bin.end;
                if (bin.speed >= enter) {
                    fastSeconds += bin.end - bin.start;
                    if (firstFast < 0) firstFast = bin.start;
                }
            }
            Candidate candidate = new Candidate(first.start, end, fastSeconds, firstFast);
            if (!candidates.isEmpty()) {
                Candidate previousCandidate = candidates.get(candidates.size() - 1);
                if (continuesEffort(samples, bins, previousCandidate, candidate)) {
                    candidates.set(candidates.size() - 1, join(previousCandidate, candidate));
                    continue;
                }
            }
            candidates.add(candidate);
        }
        var efforts = new ArrayList<Candidate>();
        for (Candidate candidate : candidates) {
            // A lone fast window needs a measured HR rise to support the surrounding effort.
            if (candidate.fastSeconds >= 20 && candidate.end - candidate.start >= 60
                    && (candidate.fastSeconds >= 40 || supportsEffort(samples, candidate))) {
                // Unseeded windows between two supported efforts must not hide a shallow connecting dip.
                if (!efforts.isEmpty() && continuesEffort(samples, bins, efforts.get(efforts.size() - 1), candidate))
                    efforts.set(efforts.size() - 1, join(efforts.get(efforts.size() - 1), candidate));
                else efforts.add(candidate);
            }
        }
        var work = efforts.stream().map(e -> new Span("work", e.start, e.end)).toList();
        if (work.isEmpty() || (work.size() == 1 && work.get(0).end - work.get(0).start < 120)) return List.of();
        int extent = samples.stream().filter(s -> s.seconds() != null).mapToInt(Sample::seconds).max().orElse(0);
        int workSeconds = work.stream().mapToInt(w -> w.end - w.start).sum();
        if (workSeconds > extent * .8 || work.size() > 60) return List.of();
        var result = new ArrayList<Span>(); int cursor = 0;
        for (Span effort : work) {
            appendSlower(result, bins, cursor, effort.start, cursor == 0 ? "warmup" : "recovery");
            append(result, effort); cursor = effort.end;
        }
        appendSlower(result, bins, cursor, extent, "cooldown");
        return List.copyOf(result);
    }
    private static boolean continuesEffort(List<Sample> samples, List<Bin> bins, Candidate before, Candidate after) {
        int gap = after.start - before.end;
        if (gap <= 0 || gap > 120) return false;
        // Only a prefix with its own HR rise may extend a faster window. A later HR rise cannot
        // retrospectively turn normal running into work, and unseeded tails cannot chain indefinitely.
        if (after.fastSeconds == 0) return false;
        if (before.fastSeconds == 0 && (after.firstFast - before.start > 180 || !supportsEffort(samples, before))) return false;
        double slowerSpeed = movingSpeed(bins, before.end, after.start);
        double flankSpeed = Math.min(movingSpeed(bins, before.start, before.end), movingSpeed(bins, after.start, after.end));
        if (!Double.isFinite(slowerSpeed) || !Double.isFinite(flankSpeed) || slowerSpeed < flankSpeed * .9) return false;
        // A shallow pace dip can still be recovery when sufficiently covered HR declines.
        Double priorHr = heartRate(samples, Math.max(before.start, before.end - 30), before.end);
        Double lateHr = heartRate(samples, Math.max(before.end, after.start - 30), after.start);
        return !(gap >= 40 && priorHr != null && lateHr != null && priorHr - lateHr >= 5);
    }
    private static Candidate join(Candidate before, Candidate after) {
        return new Candidate(before.start, after.end, before.fastSeconds + after.fastSeconds,
                before.firstFast >= 0 ? before.firstFast : after.firstFast);
    }
    private static double movingSpeed(List<Bin> bins, int start, int end) {
        int covered = 0; double distance = 0;
        for (Bin bin : bins) if (bin.start >= start && bin.end <= end) {
            if (bin.speed < 1.2) return Double.NaN;
            covered += bin.end - bin.start; distance += bin.speed * (bin.end - bin.start);
        }
        return covered == end - start && covered > 0 ? distance / covered : Double.NaN;
    }
    private static boolean supportsEffort(List<Sample> samples, Candidate candidate) {
        Double before = heartRate(samples, Math.max(0, candidate.start - 120), candidate.start);
        Double during = heartRate(samples, candidate.start, candidate.end);
        return before != null && during != null && during - before >= 5;
    }
    private static Double heartRate(List<Sample> samples, int start, int end) {
        Measurement measurement = measure(samples, start, end, null, null, "derived-stream");
        return measurement.hrCoverageFraction() >= .8 ? measurement.averageHeartRate() : null;
    }
    private static void appendSlower(List<Span> result, List<Bin> bins, int start, int end, String kind) {
        // A short edge fragment cannot establish a warm-up or cool-down phase.
        if (!"recovery".equals(kind) && end - start < 60) kind = "unknown";
        int cursor = start;
        for (Bin bin : bins) {
            if (bin.end <= start || bin.start >= end) continue;
            int from = Math.max(start, bin.start), to = Math.min(end, bin.end);
            if (from > cursor) append(result, new Span("unknown", cursor, from));
            append(result, new Span(bin.speed >= 1.2 ? kind : "unknown", from, to)); cursor = to;
        }
        if (cursor < end) append(result, new Span("unknown", cursor, end));
    }
    private static void append(List<Span> result, Span span) {
        if (span.end <= span.start) return;
        if (!result.isEmpty()) {
            Span last = result.get(result.size() - 1);
            if (last.kind.equals(span.kind) && last.end == span.start) {
                result.set(result.size() - 1, new Span(last.kind, last.start, span.end)); return;
            }
        }
        result.add(span);
    }
}
