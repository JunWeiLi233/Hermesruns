package com.hermes.backend;

import java.time.LocalDate;

public record MuscleDayPlanDto(
        LocalDate date,
        String dayLabel,
        RunPlanDto run,
        StrengthAssignmentDto strength,
        String noStrengthReasonCode
) {}
