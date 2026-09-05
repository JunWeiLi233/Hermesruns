package com.hermes.backend.shoes;

/** Known merge outcomes are normal returns; infrastructure failures must still propagate. */
public record ShoeMergeResult(Outcome outcome, Long keepShoeId, String error) {
    public enum Outcome { MERGED, NOT_FOUND, NO_TARGETS }

    public static ShoeMergeResult merged(Long keepShoeId) {
        return new ShoeMergeResult(Outcome.MERGED, keepShoeId, null);
    }

    public static ShoeMergeResult notFound(String error) {
        return new ShoeMergeResult(Outcome.NOT_FOUND, null, error);
    }

    public static ShoeMergeResult noTargets() {
        return new ShoeMergeResult(Outcome.NO_TARGETS, null, "No merge targets");
    }
}
