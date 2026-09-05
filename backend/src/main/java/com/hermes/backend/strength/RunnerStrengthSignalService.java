package com.hermes.backend.strength;

import com.hermes.backend.coaching.AutomatedCoachService;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class RunnerStrengthSignalService {

    public RunnerStrengthSignals normalize(
            LocalDate today,
            MuscleTrainingPreference preference,
            MuscleTrainingMetricsService.PlanMetrics metrics,
            List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule,
            TodayCheckInDto checkIn,
            String sorenessLevel,
            String injuryRisk,
            LocalDate targetRaceDate,
            boolean recoveryDataPresent
    ) {
        Objects.requireNonNull(today, "today is required");
        Objects.requireNonNull(preference, "preference is required");
        Objects.requireNonNull(metrics, "metrics are required");

        List<AutomatedCoachService.CoachScheduledWorkoutDto> providedSchedule =
                schedule == null ? List.of() : schedule;
        Map<LocalDate, AutomatedCoachService.CoachScheduledWorkoutDto> scheduleByDate = indexSchedule(providedSchedule);
        List<String> missingSignals = missingSignals(today, providedSchedule, metrics, recoveryDataPresent);
        List<RunnerStrengthSignals.RunDaySignal> normalizedSchedule = new ArrayList<>(28);

        for (int offset = 0; offset < 28; offset++) {
            LocalDate date = today.plusDays(offset);
            AutomatedCoachService.CoachScheduledWorkoutDto workout = scheduleByDate.get(date);
            String workoutType = workout == null || workout.workoutType() == null || workout.workoutType().isBlank()
                    ? "UNSCHEDULED"
                    : workout.workoutType();
            normalizedSchedule.add(new RunnerStrengthSignals.RunDaySignal(
                    date,
                    workoutType,
                    isKeyRun(workoutType),
                    "LONG_RUN".equals(workoutType),
                    date.equals(targetRaceDate)
            ));
        }

        return new RunnerStrengthSignals(
                today,
                preference.getCycleStartDate(),
                preference.getExperienceLevel(),
                preference.getEquipmentLevel(),
                preference.getNoisePreference(),
                preference.getSessionMinutes(),
                Set.copyOf(preference.getPreferredStrengthDays() == null ? Set.<DayOfWeek>of() : preference.getPreferredStrengthDays()),
                List.copyOf(normalizedSchedule),
                metrics.volumeKm7d(),
                metrics.volumeKm28d(),
                metrics.recentHardRunCount7d(),
                metrics.recoveryGate(),
                sorenessLevel,
                injuryRisk,
                metrics.raceWeek(),
                metrics.conservativeMode(),
                metrics.recommendedSessionsPerWeek() <= 0,
                checkIn != null,
                checkIn == null || checkIn.strengthFocus() == null
                        ? RunnerStrengthSignals.StrengthFocus.COACH_PICK
                        : RunnerStrengthSignals.StrengthFocus.valueOf(checkIn.strengthFocus()),
                checkIn == null || checkIn.strengthDose() == null
                        ? RunnerStrengthSignals.StrengthDose.STANDARD
                        : RunnerStrengthSignals.StrengthDose.valueOf(checkIn.strengthDose()),
                List.copyOf(missingSignals)
        );
    }

    private Map<LocalDate, AutomatedCoachService.CoachScheduledWorkoutDto> indexSchedule(
            List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule
    ) {
        Map<LocalDate, AutomatedCoachService.CoachScheduledWorkoutDto> byDate = new LinkedHashMap<>();
        for (AutomatedCoachService.CoachScheduledWorkoutDto workout : schedule) {
            if (workout != null && workout.scheduledDate() != null) {
                byDate.putIfAbsent(workout.scheduledDate(), workout);
            }
        }
        return byDate;
    }

    private List<String> missingSignals(
            LocalDate today,
            List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule,
            MuscleTrainingMetricsService.PlanMetrics metrics,
            boolean recoveryDataPresent
    ) {
        List<String> missing = new ArrayList<>();
        if (!hasCompleteScheduleHorizon(today, schedule)) {
            missing.add("RUN_SCHEDULE");
        }
        if (!recoveryDataPresent) {
            missing.add("RECOVERY");
        }
        if (metrics.conservativeMode()) {
            missing.add("RUN_HISTORY");
        }
        return missing;
    }

    private boolean hasCompleteScheduleHorizon(
            LocalDate today,
            List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule
    ) {
        Set<LocalDate> expectedDates = java.util.stream.IntStream.range(0, 28)
                .mapToObj(today::plusDays)
                .collect(java.util.stream.Collectors.toSet());
        Set<LocalDate> scheduledDates = schedule.stream()
                .filter(Objects::nonNull)
                .map(AutomatedCoachService.CoachScheduledWorkoutDto::scheduledDate)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        return scheduledDates.equals(expectedDates);
    }

    private boolean isKeyRun(String workoutType) {
        return "QUALITY".equals(workoutType)
                || "THRESHOLD".equals(workoutType)
                || "TEMPO".equals(workoutType)
                || "INTERVALS".equals(workoutType);
    }
}
