package com.hermes.backend.strength;

public record ExerciseDto(
        String name,
        int sets,
        String repsOrDuration,
        int targetRpe,
        String tempoOrIntent,
        String noiseLevel,
        String equipmentNeeded,
        String regression,
        String progression
) {}
