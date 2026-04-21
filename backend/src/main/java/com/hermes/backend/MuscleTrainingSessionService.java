package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class MuscleTrainingSessionService {

    public List<SessionDefinitionDto> buildAllSessionDefinitions(
            MuscleTrainingPreference preference,
            MuscleTrainingMetricsService.PlanMetrics metrics
    ) {
        List<SessionDefinitionDto> list = new ArrayList<>();
        list.add(buildSessionDefinition("FOUNDATION_STRENGTH", preference, metrics));
        list.add(buildSessionDefinition("RESILIENCE_CAPACITY", preference, metrics));
        list.add(buildSessionDefinition("OPTIONAL_ELASTICITY", preference, metrics));
        return list;
    }

    public SessionDefinitionDto buildSessionDefinition(
            String sessionType,
            MuscleTrainingPreference preference,
            MuscleTrainingMetricsService.PlanMetrics metrics
    ) {
        int targetRpe = targetRpe(preference, sessionType, metrics);
        int duration = sessionDurationMinutes(preference, sessionType, metrics);
        boolean shortSession = duration <= 25;

        List<BlockDto> blocks = switch (sessionType) {
            case "FOUNDATION_STRENGTH" -> buildFoundationBlocks(preference, targetRpe, shortSession);
            case "RESILIENCE_CAPACITY" -> buildResilienceBlocks(preference, targetRpe, shortSession);
            case "OPTIONAL_ELASTICITY" -> buildElasticityBlocks(preference, targetRpe);
            default -> List.of();
        };

        return new SessionDefinitionDto(
                sessionType,
                titleForSession(sessionType),
                emphasisForSession(sessionType, preference, metrics),
                duration,
                targetRpe,
                "OPTIONAL_ELASTICITY".equals(sessionType) || "PROTECT_ACWR_SPIKE".equals(metrics.recoveryGate()) || metrics.raceWeek(),
                blocks
        );
    }

    private String titleForSession(String sessionType) {
        return switch (sessionType) {
            case "FOUNDATION_STRENGTH" -> "Foundation strength";
            case "RESILIENCE_CAPACITY" -> "Resilience capacity";
            case "OPTIONAL_ELASTICITY" -> "Optional elasticity";
            default -> "Strength session";
        };
    }

    private String emphasisForSession(String sessionType, MuscleTrainingPreference preference, MuscleTrainingMetricsService.PlanMetrics metrics) {   
        return switch (sessionType) {
            case "FOUNDATION_STRENGTH" -> "Single-leg strength, posterior chain, calf resilience";
            case "RESILIENCE_CAPACITY" -> "Tissue capacity, trunk control, and low-cost durability";
            case "OPTIONAL_ELASTICITY" -> preference.getNoisePreference() == MuscleTrainingPreference.NoisePreference.QUIET_ONLY
                    ? "Quiet coordination and fast contacts"
                    : "Elastic return, fast contacts, and stiffness";
            default -> metrics.currentFocus();
        };
    }

    private int sessionDurationMinutes(MuscleTrainingPreference preference, String sessionType, MuscleTrainingMetricsService.PlanMetrics metrics) {  
        int base = switch (sessionType) {
            case "FOUNDATION_STRENGTH" -> Math.min(45, preference.getSessionMinutes());
            case "RESILIENCE_CAPACITY" -> Math.min(35, preference.getSessionMinutes());
            case "OPTIONAL_ELASTICITY" -> Math.min(22, preference.getSessionMinutes());
            default -> preference.getSessionMinutes();
        };

        if (!"OPEN".equals(metrics.recoveryGate()) || metrics.raceWeek()) {
            base = Math.max(18, base - 8);
        }
        return base;
    }

    private int targetRpe(MuscleTrainingPreference preference, String sessionType, MuscleTrainingMetricsService.PlanMetrics metrics) {
        int base = switch (preference.getExperienceLevel()) {
            case BEGINNER -> 6;
            case INTERMEDIATE -> 7;
            case CONSISTENT -> 8;
        };
        if ("RESILIENCE_CAPACITY".equals(sessionType)) base = Math.max(5, base - 1);
        if ("OPTIONAL_ELASTICITY".equals(sessionType)) base = Math.max(5, Math.min(7, base));
        if (!"OPEN".equals(metrics.recoveryGate()) || metrics.raceWeek()) base = Math.max(5, base - 2);
        return base;
    }

    private List<BlockDto> buildFoundationBlocks(MuscleTrainingPreference preference, int targetRpe, boolean shortSession) {
        List<ExerciseDto> warmup = new ArrayList<>(List.of(
                exercise("Hip airplanes", 2, shortSession ? "4/side" : "5/side", 5, "Slow hinge, own the balance", "QUIET", "BODYWEIGHT",
                        "Use fingertip support and shorten the hip rotation.", "Remove support or add a 2-second pause in each open position."),
                exercise("Ankle dorsiflexion rocks", 2, "8/side", 4, "Controlled ankle motion", "QUIET", "BODYWEIGHT",  
                        "Limit range and keep the heel lightly loaded.", "Move the knee further forward while the heel stays planted."),
                exercise("Dead bug", 2, shortSession ? "5/side" : "6/side", 5, "Exhale and keep ribs down", "QUIET", "BODYWEIGHT",
                        "Tap the heel instead of extending the full leg.", "Extend slower or hold the reach for 2 seconds.")
        ));

        List<ExerciseDto> main = new ArrayList<>(List.of(
                exercise("Split squat", strengthSets(preference, shortSession), repsForStrength(preference, shortSession), targetRpe, "3-1-1 tempo", "QUIET", equipmentLabel(preference),
                        "Use bodyweight and shorten depth until the front knee tracks cleanly.", "Add load or add a 2-second pause at the bottom."),
                exercise("Single-leg Romanian deadlift", strengthSets(preference, shortSession), repsForStrength(preference, shortSession), targetRpe, "Reach long, hinge from the hips", "QUIET", equipmentLabel(preference),
                        "Use a kickstand or light wall support.", "Add load or increase the forward reach without losing hip control."),
                exercise("Standing calf raise", strengthSets(preference, shortSession), shortSession ? "10" : "12", targetRpe, "2 up / 2 down with full pause", "QUIET", "BODYWEIGHT",
                        "Use both legs and reduce the pause length.", "Bias one leg at a time or add load when the top position stays crisp.")
        ));

        if (preference.getEquipmentLevel() == MuscleTrainingPreference.EquipmentLevel.BAND
                || preference.getEquipmentLevel() == MuscleTrainingPreference.EquipmentLevel.GYM) {
            main.add(exercise("Pallof press", 2 + strengthSetBonus(preference), shortSession ? "8/side" : "10/side", Math.max(5, targetRpe - 1), "Brace, press, resist rotation", "QUIET", "BAND",
                    "Shorten the press range or step closer to the anchor.", "Step further from the anchor or hold the press for 2 seconds."));
        } else {
            main.add(exercise("Side plank", 2 + strengthSetBonus(preference), shortSession ? "20s/side" : "25s/side", Math.max(5, targetRpe - 1), "Stack ribs over pelvis", "QUIET", "BODYWEIGHT",
                    "Bend the bottom knee for extra support.", "Lift the top leg or extend the hold if you stay stable."));
        }

        List<BlockDto> blocks = new ArrayList<>();
        blocks.add(new BlockDto("Prep", warmup));
        blocks.add(new BlockDto("Main", main));

        if (!shortSession) {
            List<ExerciseDto> accessory = new ArrayList<>(List.of(
                    exercise("Glute bridge (pause at top)", 2, "10", Math.max(5, targetRpe - 1), "Drive up, 2-second pause", "QUIET", "BODYWEIGHT",
                            "Use a shorter range and keep both feet close to the hips.", "March from the bridge or load the hips once the pause is stable."),
                    exercise("Tibialis wall raise", 2, "15", 5, "Smooth up, controlled down", "QUIET", "BODYWEIGHT",    
                            "Stand more upright with less shin angle.", "Lean further back or add a longer lower phase.")
            ));
            if (preference.getEquipmentLevel() == MuscleTrainingPreference.EquipmentLevel.GYM) {
                accessory.add(exercise("Hamstring curl (slider or machine)", 2, "8-10", Math.max(5, targetRpe - 1), "Smooth curl, slow return", "QUIET", "GYM",
                        "Use a reduced range or keep the hips lower.", "Add a bridge hold or progress to slower eccentrics."));
            }
            blocks.add(new BlockDto("Accessory", accessory));
        }

        return blocks;
    }

    private List<BlockDto> buildResilienceBlocks(MuscleTrainingPreference preference, int targetRpe, boolean shortSession) {
        List<ExerciseDto> prep = new ArrayList<>(List.of(
                exercise("World's greatest stretch", 2, "4/side", 4, "Move slowly and breathe", "QUIET", "BODYWEIGHT",
                        "Reduce the rotation and keep the back knee down.", "Pause at end-range for 2 breaths."),       
                exercise("Ankle dorsiflexion rocks", 2, "10/side", 4, "Own the end range", "QUIET", "BODYWEIGHT",       
                        "Use a smaller rock and hold onto support.", "Drive further forward without losing the heel.")  
        ));

        List<ExerciseDto> main = new ArrayList<>(List.of(
                exercise("Step-down (knee tracking)", 2 + strengthSetBonus(preference), shortSession ? "6/side" : "8/side", Math.max(5, targetRpe - 1), "Slow lower, clean knee path", "QUIET", "BODYWEIGHT",
                        "Use a lower step or limit the touch depth.", "Increase step height or add load when control stays clean.")
        ));

        if (preference.getEquipmentLevel() == MuscleTrainingPreference.EquipmentLevel.BODYWEIGHT) {
            main.add(exercise("Glute bridge (pause at top)", 2, "10", Math.max(5, targetRpe - 1), "2-second pause every rep", "QUIET", "BODYWEIGHT",
                    "Use a short bridge with both heels closer in.", "Progress to single-leg emphasis or longer pauses."));
            main.add(exercise("Side plank", 2, shortSession ? "20s/side" : "25s/side", Math.max(5, targetRpe - 1), "Quiet trunk, steady breath", "QUIET", "BODYWEIGHT",
                    "Bend the bottom knee for support.", "Lift the top leg or extend the duration."));
        } else {
            main.add(exercise("Hamstring curl (slider or machine)", 2 + strengthSetBonus(preference), shortSession ? "8" : "10", Math.max(5, targetRpe - 1), "Control the eccentric", "QUIET", equipmentLabel(preference),
                    "Reduce the range and keep hips slightly lower.", "Add a bridge hold or slow the return."));        
            main.add(exercise("Pallof press", 2 + strengthSetBonus(preference), shortSession ? "8/side" : "10/side", Math.max(5, targetRpe - 1), "Press and resist rotation", "QUIET", "BAND",
                    "Shorten the lever by keeping hands closer to the chest.", "Step away from the anchor or extend the hold."));
        }

        main.add(exercise("Tibialis wall raise", 2, "15", 5, "Full toe lift each rep", "QUIET", "BODYWEIGHT",
                "Stand more upright against the wall.", "Increase lean and keep the lowering slower."));

        return List.of(
                new BlockDto("Prep", prep),
                new BlockDto("Main", main)
        );
    }

    private List<BlockDto> buildElasticityBlocks(MuscleTrainingPreference preference, int targetRpe) {
        List<ExerciseDto> prep = new ArrayList<>(List.of(
                exercise("Pogo hops", 2, "10", Math.max(5, targetRpe - 1), "Short, light, springy contacts", "SOUND", "BODYWEIGHT",
                        "Turn it into rapid calf raises without leaving the ground.", "Increase rebound stiffness, not jump height."),
                exercise("Skipping A-drill", 2, "15m", Math.max(5, targetRpe - 1), "Rhythm first, then height", "SOUND", "BODYWEIGHT",
                        "March the pattern instead of skipping.", "Increase speed while keeping the contacts crisp.")   
        ));

        List<ExerciseDto> main = new ArrayList<>(List.of(
                exercise("Box step-up (explosive)", 3, "5/side", targetRpe, "Fast up, soft down", "SOUND", equipmentLabel(preference),
                        "Use a lower step and control the drive.", "Use a higher step or add light load without stomping."),
                exercise("Single-leg hop (low amplitude)", 3, "5/side", targetRpe, "Quick elastic contacts", "SOUND", "BODYWEIGHT",
                        "Use double-leg pogo contacts instead.", "Increase the number of crisp contacts, not the height.")
        ));

        return List.of(
                new BlockDto("Prep", prep),
                new BlockDto("Main", main)
        );
    }

    private ExerciseDto exercise(
            String name,
            int sets,
            String repsOrDuration,
            int targetRpe,
            String tempoOrIntent,
            String noiseLevel,
            String equipmentNeeded,
            String regression,
            String progression
    ) {
        return new ExerciseDto(name, sets, repsOrDuration, targetRpe, tempoOrIntent, noiseLevel, equipmentNeeded, regression, progression);
    }

    private int strengthSets(MuscleTrainingPreference preference, boolean shortSession) {
        int base = switch (preference.getExperienceLevel()) {
            case BEGINNER -> 2;
            case INTERMEDIATE, CONSISTENT -> 3;
        };
        return shortSession ? Math.max(2, base - 1) : base;
    }

    private int strengthSetBonus(MuscleTrainingPreference preference) {
        return preference.getExperienceLevel() == MuscleTrainingPreference.ExperienceLevel.CONSISTENT ? 1 : 0;
    }

    private String repsForStrength(MuscleTrainingPreference preference, boolean shortSession) {
        return switch (preference.getExperienceLevel()) {
            case BEGINNER -> shortSession ? "6/side" : "7/side";
            case INTERMEDIATE -> shortSession ? "6/side" : "8/side";
            case CONSISTENT -> shortSession ? "7/side" : "8/side";
        };
    }

    private String equipmentLabel(MuscleTrainingPreference preference) {
        return switch (preference.getEquipmentLevel()) {
            case BODYWEIGHT -> "BODYWEIGHT";
            case BAND -> "BAND";
            case DUMBBELL -> "DUMBBELL";
            case GYM -> "GYM";
        };
    }
}
