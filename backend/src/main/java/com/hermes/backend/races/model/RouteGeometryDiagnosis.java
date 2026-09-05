package com.hermes.backend.races.model;

public record RouteGeometryDiagnosis(int selfIntersectionCount, int allowedSelfIntersections, int startDistanceBacktrackCount, String feedbackPrompt) {
    public boolean needsCorrectionPrompt() { return feedbackPrompt != null && !feedbackPrompt.isBlank(); }
    public double selfIntersectionPenalty() { return Math.max(0, selfIntersectionCount - allowedSelfIntersections) * 12.0; }
    public double startDistanceBacktrackPenalty() { return startDistanceBacktrackCount * 4.0; }
}
