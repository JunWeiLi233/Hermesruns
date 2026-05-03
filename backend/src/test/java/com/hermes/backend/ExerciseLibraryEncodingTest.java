package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regression guard: no exercise name returned from MuscleTrainingSessionService
 * may contain mojibake characters that result from UTF-8 bytes being misread as
 * GBK/CP-936 (or double-encoded variants thereof).
 *
 * Root cause history: defensive aliases were added to MuscleTraining.jsx after
 * observing corrupted apostrophes in exercise names. The Java source in
 * MuscleTrainingSessionService uses plain ASCII apostrophe (U+0027) throughout.
 * If encoding ever regresses (e.g. Windows JVM default charset flip), these
 * tests will fail before the corrupted names reach the frontend.
 *
 * Mojibake fingerprints caught here:
 *   鈥  U+9225 — GBK misread of 0xE2 0x80 (first two UTF-8 bytes of U+2019)
 *   檚  U+6A9A — GBK misread of 0x99 paired with next byte
 *   閳         — double-encoded mojibake variant
 *   ユ  U+30E6 (katakana) appearing in ASCII exercise names — encoding artifact
 *   獨  U+7368 — double-encoded mojibake
 */
@SpringBootTest
class ExerciseLibraryEncodingTest {

    // Mojibake codepoints that must never appear in exercise names.
    private static final Pattern MOJIBAKE_PATTERN =
            Pattern.compile("[鈥檚阳ユ獨�]");

    @Autowired
    private MuscleTrainingSessionService sessionService;

    @Test
    void exerciseNamesContainNoMojibakeCharacters() {
        MuscleTrainingPreference preference = buildDefaultPreference();
        MuscleTrainingMetricsService.PlanMetrics metrics = buildDefaultMetrics();

        List<SessionDefinitionDto> sessions = sessionService.buildAllSessionDefinitions(preference, metrics);

        List<String> violations = new ArrayList<>();
        for (SessionDefinitionDto session : sessions) {
            for (BlockDto block : session.blocks()) {
                for (ExerciseDto exercise : block.exercises()) {
                    String name = exercise.name();
                    if (name != null && MOJIBAKE_PATTERN.matcher(name).find()) {
                        violations.add("Session=" + session.sessionType()
                                + " Block=" + block.title()
                                + " name=" + name);
                    }
                }
            }
        }

        assertThat(violations)
                .as("Exercise names must contain no mojibake characters (UTF-8 bytes misread as GBK)")
                .isEmpty();
    }

    @Test
    void worldsGreatestStretchUsesPlainAsciiApostrophe() {
        // The exact exercise name must use a plain ASCII apostrophe (U+0027).
        // A curly apostrophe (U+2019) or any GBK-mojibake variant would cause
        // the frontend LOCALIZED_EXERCISE_LIBRARY lookup to miss, breaking
        // per-exercise coaching text.
        MuscleTrainingPreference preference = buildDefaultPreference();
        MuscleTrainingMetricsService.PlanMetrics metrics = buildDefaultMetrics();

        List<SessionDefinitionDto> sessions = sessionService.buildAllSessionDefinitions(preference, metrics);

        boolean found = false;
        for (SessionDefinitionDto session : sessions) {
            for (BlockDto block : session.blocks()) {
                for (ExerciseDto exercise : block.exercises()) {
                    String name = exercise.name();
                    if (name != null
                            && name.toLowerCase().contains("world")
                            && name.toLowerCase().contains("greatest")) {
                        found = true;
                        assertThat(name)
                                .as("World's greatest stretch must use plain ASCII apostrophe U+0027")
                                .isEqualTo("World's greatest stretch");
                        int apostropheIdx = name.indexOf('\'');
                        assertThat(apostropheIdx)
                                .as("Plain ASCII apostrophe must be present in the name")
                                .isGreaterThan(0);
                        assertThat((int) name.charAt(apostropheIdx))
                                .as("Apostrophe must be U+0027 (plain ASCII), not U+2019 or mojibake")
                                .isEqualTo(0x0027);
                    }
                }
            }
        }

        assertThat(found)
                .as("Expected 'World's greatest stretch' to appear in at least one session block")
                .isTrue();
    }

    // ---- helpers ----

    private MuscleTrainingPreference buildDefaultPreference() {
        MuscleTrainingPreference p = new MuscleTrainingPreference();
        p.setExperienceLevel(MuscleTrainingPreference.ExperienceLevel.INTERMEDIATE);
        p.setEquipmentLevel(MuscleTrainingPreference.EquipmentLevel.BODYWEIGHT);
        p.setSessionMinutes(40);
        p.setNoisePreference(MuscleTrainingPreference.NoisePreference.NORMAL);
        return p;
    }

    private MuscleTrainingMetricsService.PlanMetrics buildDefaultMetrics() {
        // PlanMetrics record field order (from MuscleTrainingMetricsService):
        // volumeKm7d, volumeKm28d, acwr, highIntensityRatioLast7d,
        // recoveryGate, loadStatus, conservativeMode, raceWeek,
        // recommendedSessionsPerWeek, currentFocus,
        // nextKeyRunDate, nextKeyRunType, nextLongRunDate, nextLongRunKm,
        // recentHardRunCount7d
        return new MuscleTrainingMetricsService.PlanMetrics(
                30.0,      // volumeKm7d
                110.0,     // volumeKm28d
                1.05,      // acwr — inside optimal range, all gates open
                0.15,      // highIntensityRatioLast7d
                "OPEN",    // recoveryGate
                "OPTIMAL", // loadStatus
                false,     // conservativeMode
                false,     // raceWeek
                2,         // recommendedSessionsPerWeek
                "BASE",    // currentFocus
                null,      // nextKeyRunDate
                null,      // nextKeyRunType
                null,      // nextLongRunDate
                null,      // nextLongRunKm
                1          // recentHardRunCount7d
        );
    }
}
