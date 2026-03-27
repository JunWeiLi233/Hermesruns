package com.hermes.backend;

/**
 * Planned workout categories for the automated polarized coach.
 * Easy / recovery map to Seiler "low intensity"; threshold+ map to "high intensity" for 80/20 auditing.
 */
public enum CoachWorkoutType {
    REST,
    /** Zone 1–2 conversational */
    EASY,
    /** Deliberately very easy after load */
    RECOVERY,
    /** Tempo / steady state */
    TEMPO,
    /** Threshold / cruise intervals */
    THRESHOLD,
    /** Short reps / VO₂-style */
    INTERVALS,
    /** Aerobic long run, may include race-pace blocks */
    LONG_RUN,
    /** Non-running option when readiness is poor */
    CROSS_TRAIN
}
