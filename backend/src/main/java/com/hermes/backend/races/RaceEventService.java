package com.hermes.backend.races;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.coaching.AutomatedCoachService;
import com.hermes.backend.infrastructure.web.InputSanitizer;
import com.hermes.backend.races.model.LinkedActivitySummary;
import com.hermes.backend.races.model.RaceEventRequest;
import com.hermes.backend.races.model.RaceEventResponse;
import com.hermes.backend.races.model.SavedRaceStatusResponse;
import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class RaceEventService {
    private final RaceEventRepository raceEventRepository;
    private final ActivityRepository activityRepository;
    private final AutomatedCoachService automatedCoachService;

    public RaceEventService(RaceEventRepository raceEventRepository,
                            ActivityRepository activityRepository,
                            AutomatedCoachService automatedCoachService) {
        this.raceEventRepository = raceEventRepository;
        this.activityRepository = activityRepository;
        this.automatedCoachService = automatedCoachService;
    }

    public List<RaceEventResponse> list(Runner runner) {
        List<Activity> runActivities = activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN);
        return raceEventRepository.findByRunnerOrderByEventDateAsc(runner).stream()
                .map(race -> toResponse(race, runActivities))
                .toList();
    }

    public SavedRaceStatusResponse savedStatus(Runner runner, String normalizedName) {
        Optional<RaceEvent> race = raceEventRepository.findFirstByRunnerAndNameIgnoreCaseOrderByEventDateAsc(runner, normalizedName);
        return new SavedRaceStatusResponse(race.isPresent(), race.map(RaceEvent::getId).orElse(null));
    }

    public SaveResult create(Runner runner, RaceEventRequest request) {
        if (!ownsCompletedActivity(runner, request)) return new SaveResult(SaveOutcome.ACTIVITY_FORBIDDEN, null);
        RaceEvent race = new RaceEvent();
        applyRequest(race, request);
        race.setRunner(runner);
        return save(race, runner);
    }

    public SaveResult update(Long id, Runner runner, RaceEventRequest request) {
        Optional<RaceEvent> race = raceEventRepository.findByIdAndRunner(id, runner);
        if (race.isEmpty()) return new SaveResult(SaveOutcome.RACE_NOT_FOUND, null);
        if (!ownsCompletedActivity(runner, request)) return new SaveResult(SaveOutcome.ACTIVITY_FORBIDDEN, null);
        applyRequest(race.get(), request);
        return save(race.get(), runner);
    }

    public boolean delete(Long id, Runner runner) {
        Optional<RaceEvent> race = raceEventRepository.findByIdAndRunner(id, runner);
        if (race.isEmpty()) return false;
        raceEventRepository.delete(race.get());
        if (automatedCoachService != null) automatedCoachService.replanFutureSchedule(runner);
        return true;
    }

    private boolean ownsCompletedActivity(Runner runner, RaceEventRequest request) {
        return request.completedActivityId() == null
                || activityRepository.findByIdAndRunner(request.completedActivityId(), runner).isPresent();
    }

    private SaveResult save(RaceEvent race, Runner runner) {
        RaceEvent saved = raceEventRepository.save(race);
        if (automatedCoachService != null) automatedCoachService.replanFutureSchedule(runner);
        List<Activity> runs = activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN);
        return new SaveResult(SaveOutcome.SAVED, toResponse(saved, runs));
    }

    private void applyRequest(RaceEvent raceEvent, RaceEventRequest request) {
        raceEvent.setName(request.name().trim());
        raceEvent.setOrganization(InputSanitizer.trimToNull(request.organization()));
        raceEvent.setLocation(InputSanitizer.trimToNull(request.location()));
        raceEvent.setEventDate(request.eventDate());
        raceEvent.setDistanceKm(request.distanceKm());
        raceEvent.setRegistrationStatus(parseStatus(request.registrationStatus()));
        raceEvent.setGoalTimeSeconds(request.goalTimeSeconds());
        raceEvent.setNotes(InputSanitizer.trimToNull(request.notes()));
        raceEvent.setNyrrNinePlusOneEligible(Boolean.TRUE.equals(request.nyrrNinePlusOneEligible()));
        raceEvent.setCompletedActivityId(request.completedActivityId());
    }

    private RaceEventResponse toResponse(RaceEvent raceEvent, List<Activity> runActivities) {
        Activity matchedActivity = resolveMatchedActivity(raceEvent, runActivities);
        boolean completed = matchedActivity != null || raceEvent.getRegistrationStatus() == RaceRegistrationStatus.COMPLETED;
        long countdownDays = ChronoUnit.DAYS.between(LocalDate.now(), raceEvent.getEventDate());
        return new RaceEventResponse(
                raceEvent.getId(), raceEvent.getName(), raceEvent.getOrganization(), raceEvent.getLocation(),
                raceEvent.getEventDate(), raceEvent.getDistanceKm(), raceEvent.getRegistrationStatus().name(),
                raceEvent.getGoalTimeSeconds(), raceEvent.getNotes(), raceEvent.isNyrrNinePlusOneEligible(),
                raceEvent.getCompletedActivityId(), completed, countdownDays,
                matchedActivity == null ? null : new LinkedActivitySummary(
                        matchedActivity.getId(), matchedActivity.getName(), matchedActivity.getStartTime(),
                        matchedActivity.getStartDate(), matchedActivity.getDistanceKm(), matchedActivity.getMovingTimeSeconds())
        );
    }

    private Activity resolveMatchedActivity(RaceEvent raceEvent, List<Activity> runActivities) {
        if (raceEvent.getCompletedActivityId() != null) {
            for (Activity activity : runActivities) {
                if (raceEvent.getCompletedActivityId().equals(activity.getId())) return activity;
            }
        }
        if (raceEvent.getEventDate() == null) return null;
        List<ActivityCandidate> candidates = new ArrayList<>();
        for (Activity activity : runActivities) {
            LocalDate activityDate = extractActivityDate(activity);
            if (activityDate == null) continue;
            long dayDelta = Math.abs(ChronoUnit.DAYS.between(raceEvent.getEventDate(), activityDate));
            if (dayDelta > 2) continue;
            double activityKm = resolveDistanceKm(activity);
            if (activityKm <= 0) continue;
            if (raceEvent.getDistanceKm() != null && raceEvent.getDistanceKm() > 0) {
                double toleranceKm = Math.max(1.5, raceEvent.getDistanceKm() * 0.15);
                if (Math.abs(activityKm - raceEvent.getDistanceKm()) > toleranceKm) continue;
            }
            candidates.add(new ActivityCandidate(activity, dayDelta,
                    Math.abs(activityKm - Optional.ofNullable(raceEvent.getDistanceKm()).orElse(activityKm))));
        }
        return candidates.stream()
                .min(Comparator.comparingLong(ActivityCandidate::dayDelta).thenComparingDouble(ActivityCandidate::distanceDelta))
                .map(ActivityCandidate::activity)
                .orElse(null);
    }

    private LocalDate extractActivityDate(Activity activity) {
        if (activity.getStartTime() != null) return activity.getStartTime().toLocalDate();
        if (activity.getStartDate() != null && !activity.getStartDate().isBlank()) {
            String value = activity.getStartDate();
            if (value.length() >= 10) {
                try {
                    return LocalDate.parse(value.substring(0, 10));
                } catch (Exception ignored) {
                    return null;
                }
            }
        }
        return null;
    }

    private double resolveDistanceKm(Activity activity) {
        if (activity.getDistanceKm() > 0) return activity.getDistanceKm();
        if (activity.getDistanceMeters() != null && activity.getDistanceMeters() > 0) {
            return activity.getDistanceMeters() / 1000.0;
        }
        return 0;
    }

    private RaceRegistrationStatus parseStatus(String value) {
        if (value == null || value.isBlank()) return RaceRegistrationStatus.INTERESTED;
        try {
            return RaceRegistrationStatus.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ignored) {
            return RaceRegistrationStatus.INTERESTED;
        }
    }

    public enum SaveOutcome { SAVED, RACE_NOT_FOUND, ACTIVITY_FORBIDDEN }
    public record SaveResult(SaveOutcome outcome, RaceEventResponse race) {}
    private record ActivityCandidate(Activity activity, long dayDelta, double distanceDelta) {}
}
