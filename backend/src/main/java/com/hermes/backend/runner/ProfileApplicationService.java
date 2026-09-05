package com.hermes.backend.runner;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.coaching.AutomatedCoachService;
import com.hermes.backend.races.RaceEvent;
import com.hermes.backend.races.RaceEventRepository;
import com.hermes.backend.races.RaceRegistrationStatus;
import com.hermes.backend.runner.ProfileModels.LinkedActivitySummary;
import com.hermes.backend.runner.ProfileModels.ProfileDashboardResponse;
import com.hermes.backend.runner.ProfileModels.ProfilePreferencesResponse;
import com.hermes.backend.runner.ProfileModels.ProfileResponse;
import com.hermes.backend.runner.ProfileModels.RaceEventResponse;
import com.hermes.backend.runner.ProfileModels.TodayDashboardResponse;
import com.hermes.backend.shoes.Shoe;
import com.hermes.backend.shoes.ShoeRepository;
import com.hermes.backend.weather.AcclimatizationService;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
public class ProfileApplicationService {
    private static final int PROFILE_DASHBOARD_INITIAL_RUN_LIMIT = 180;

    private final RunnerRepository runnerRepository;
    private final ActivityRepository activityRepository;
    private final AutomatedCoachService automatedCoachService;
    private final RaceEventRepository raceEventRepository;
    private final AcclimatizationService acclimatizationService;
    private final ShoeRepository shoeRepository;
    private final ProfileAvatarService avatarService;

    public ProfileApplicationService(
            RunnerRepository runnerRepository,
            ActivityRepository activityRepository,
            AutomatedCoachService automatedCoachService,
            RaceEventRepository raceEventRepository,
            AcclimatizationService acclimatizationService,
            ShoeRepository shoeRepository,
            ProfileAvatarService avatarService
    ) {
        this.runnerRepository = runnerRepository;
        this.activityRepository = activityRepository;
        this.automatedCoachService = automatedCoachService;
        this.raceEventRepository = raceEventRepository;
        this.acclimatizationService = acclimatizationService;
        this.shoeRepository = shoeRepository;
        this.avatarService = avatarService;
    }

    public ProfileResponse updateDisplayName(Runner runner, String displayName) {
        runner.setDisplayName(displayName);
        runnerRepository.save(runner);
        return profile(runner);
    }

    public ProfilePreferencesResponse updatePreferences(Runner runner, String mantra, boolean weeklyDigestEnabled) {
        runner.setSettingsMantra(mantra);
        runner.setWeeklyDigestEnabled(weeklyDigestEnabled);
        runnerRepository.save(runner);
        return preferences(runner);
    }

    public ProfileResponse profile(Runner runner) {
        boolean stravaLinked = runner.getStravaAthleteId() != null
                && runner.getStravaRefreshToken() != null
                && !runner.getStravaRefreshToken().isBlank();
        boolean showLanguageSettingsHint = runner.getCreatedAt() != null
                && runner.getCreatedAt().isAfter(LocalDateTime.now().minusHours(24));
        return new ProfileResponse(
                runner.getEmail(),
                runner.getDisplayName(),
                avatarService.avatarDataUrl(runner),
                stravaLinked,
                showLanguageSettingsHint
        );
    }

    public ProfilePreferencesResponse preferences(Runner runner) {
        return new ProfilePreferencesResponse(
                runner.getSettingsMantra() == null ? "" : runner.getSettingsMantra(),
                runner.isWeeklyDigestEnabled()
        );
    }

    public ProfileDashboardResponse profileDashboard(Runner runner) {
        // Keep first paint bounded to the data the Profile route needs to
        // render. Coach, PR, race, muscle, and quota widgets lazy-load behind
        // deferredEnrichment so intermittent slow dependencies do not hold the
        // whole dashboard response open.
        List<ActivityRepository.AnalysisActivitySummaryProjection> activitySummaries = findRunnerRunSummaries(runner);

        return new ProfileDashboardResponse(
                profile(runner),
                toRunSummaryFeedItems(activitySummaries),
                null,
                null,
                null,
                List.of(),
                null,
                Map.of(),
                true
        );
    }

    public TodayDashboardResponse todayDashboard(Runner runner) {
        List<ActivityRepository.AnalysisActivitySummaryProjection> activitySummaries = findRunnerRunSummaries(runner);
        return new TodayDashboardResponse(
                profile(runner),
                toRunSummaryFeedItems(activitySummaries),
                safeValue(() -> automatedCoachService.getTodayWithReadiness(runner), null),
                safeValue(() -> acclimatizationService.buildContext(runner), null),
                safeValue(() -> findRunnerRaces(runner), List.of()),
                safeValue(() -> findRunnerShoes(runner), List.of())
        );
    }

    private List<Activity> findRunnerRuns(Runner runner) {
        if (runner == null) {
            return List.of();
        }
        return safeValue(
                () -> activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN),
                List.of()
        );
    }

    private List<ActivityRepository.AnalysisActivitySummaryProjection> findRunnerRunSummaries(Runner runner) {
        if (runner == null) {
            return List.of();
        }
        return safeValue(
                () -> activityRepository.findAnalysisSummariesByRunnerAndActivityType(
                        runner,
                        ActivityType.RUN,
                        PageRequest.of(0, PROFILE_DASHBOARD_INITIAL_RUN_LIMIT)
                ),
                List.of()
        );
    }

    private List<Map<String, Object>> toRunSummaryFeedItems(
            List<ActivityRepository.AnalysisActivitySummaryProjection> activities
    ) {
        if (activities == null || activities.isEmpty()) {
            return List.of();
        }
        return activities.stream().map(this::toRunSummaryFeedItem).toList();
    }

    private Map<String, Object> toRunSummaryFeedItem(ActivityRepository.AnalysisActivitySummaryProjection activity) {
        Map<String, Object> body = new HashMap<>();
        body.put("id", activity.getId());
        body.put("name", activity.getName());
        body.put("distanceKm", activity.getDistanceKm());
        body.put("movingTimeSeconds", activity.getMovingTimeSeconds());
        body.put("startDate", activity.getStartDate());
        body.put("startTime", activity.getStartTime());
        body.put("distanceMeters", activity.getDistanceMeters());
        body.put("durationSeconds", activity.getDurationSeconds());
        body.put("averageHeartRate", activity.getAverageHeartRate());
        body.put("maxHeartRate", activity.getMaxHeartRate());
        body.put("totalElevationGain", activity.getTotalElevationGain());
        body.put("averageCadence", activity.getAverageCadence());
        body.put("maxSpeedMps", activity.getMaxSpeedMps());
        body.put("pacePenaltySecPerKm", activity.getPacePenaltySecPerKm());
        body.put("weatherAdjusted", activity.getWeatherAdjusted());
        body.put("shoeId", activity.getShoeId());
        body.put("shoeName", formatShoeName(activity.getShoeBrand(), activity.getShoeModel(), activity.getShoeNickname()));
        return body;
    }

    private String formatShoeName(String brand, String model, String nickname) {
        String safeBrand = brand == null ? "" : brand;
        String safeModel = model == null ? "" : model;
        String combined = (safeBrand + " " + safeModel).trim();
        return combined.isEmpty() ? nickname : combined;
    }

    private List<RaceEventResponse> findRunnerRaces(Runner runner) {
        if (runner == null) {
            return List.of();
        }
        List<RaceEvent> races = raceEventRepository.findByRunnerOrderByEventDateAsc(runner);
        if (races == null || races.isEmpty()) {
            return List.of();
        }
        List<Activity> activities = findRunnerRuns(runner);
        return races.stream().map(race -> toRaceResponse(race, activities)).toList();
    }

    private RaceEventResponse toRaceResponse(RaceEvent raceEvent, List<Activity> runActivities) {
        Activity matchedActivity = resolveMatchedActivity(raceEvent, runActivities);
        boolean completed = matchedActivity != null
                || raceEvent.getRegistrationStatus() == RaceRegistrationStatus.COMPLETED;
        long countdownDays = raceEvent.getEventDate() == null
                ? 0
                : java.time.temporal.ChronoUnit.DAYS.between(java.time.LocalDate.now(), raceEvent.getEventDate());

        return new RaceEventResponse(
                raceEvent.getId(),
                raceEvent.getName(),
                raceEvent.getOrganization(),
                raceEvent.getLocation(),
                raceEvent.getEventDate(),
                raceEvent.getDistanceKm(),
                raceEvent.getRegistrationStatus() == null ? null : raceEvent.getRegistrationStatus().name(),
                raceEvent.getGoalTimeSeconds(),
                raceEvent.getNotes(),
                raceEvent.isNyrrNinePlusOneEligible(),
                raceEvent.getCompletedActivityId(),
                completed,
                countdownDays,
                matchedActivity == null ? null : new LinkedActivitySummary(
                        matchedActivity.getId(),
                        matchedActivity.getName(),
                        matchedActivity.getStartTime(),
                        matchedActivity.getStartDate(),
                        matchedActivity.getDistanceKm(),
                        matchedActivity.getMovingTimeSeconds()
                )
        );
    }

    private Activity resolveMatchedActivity(RaceEvent raceEvent, List<Activity> runActivities) {
        if (raceEvent == null || runActivities == null || runActivities.isEmpty()) {
            return null;
        }

        if (raceEvent.getCompletedActivityId() != null) {
            for (Activity activity : runActivities) {
                if (raceEvent.getCompletedActivityId().equals(activity.getId())) {
                    return activity;
                }
            }
        }

        if (raceEvent.getEventDate() == null) {
            return null;
        }

        Activity best = null;
        long bestDayDelta = Long.MAX_VALUE;
        double bestDistanceDelta = Double.MAX_VALUE;
        for (Activity activity : runActivities) {
            java.time.LocalDate activityDate = extractActivityDate(activity);
            if (activityDate == null) {
                continue;
            }

            long dayDelta = Math.abs(java.time.temporal.ChronoUnit.DAYS.between(raceEvent.getEventDate(), activityDate));
            if (dayDelta > 2) {
                continue;
            }

            double activityKm = resolveDistanceKm(activity);
            if (activityKm <= 0) {
                continue;
            }

            double distanceDelta = Math.abs(activityKm - Optional.ofNullable(raceEvent.getDistanceKm()).orElse(activityKm));
            if (raceEvent.getDistanceKm() != null && raceEvent.getDistanceKm() > 0) {
                double toleranceKm = Math.max(1.5, raceEvent.getDistanceKm() * 0.15);
                if (distanceDelta > toleranceKm) {
                    continue;
                }
            }

            if (dayDelta < bestDayDelta || (dayDelta == bestDayDelta && distanceDelta < bestDistanceDelta)) {
                best = activity;
                bestDayDelta = dayDelta;
                bestDistanceDelta = distanceDelta;
            }
        }
        return best;
    }

    private java.time.LocalDate extractActivityDate(Activity activity) {
        if (activity.getStartTime() != null) {
            return activity.getStartTime().toLocalDate();
        }
        if (activity.getStartDate() != null && !activity.getStartDate().isBlank()) {
            String value = activity.getStartDate();
            if (value.length() >= 10) {
                try {
                    return java.time.LocalDate.parse(value.substring(0, 10));
                } catch (Exception ignored) {
                    return null;
                }
            }
        }
        return null;
    }

    private double resolveDistanceKm(Activity activity) {
        if (activity.getDistanceKm() > 0) {
            return activity.getDistanceKm();
        }
        if (activity.getDistanceMeters() != null && activity.getDistanceMeters() > 0) {
            return activity.getDistanceMeters() / 1000.0;
        }
        return 0;
    }

    private List<Shoe> findRunnerShoes(Runner runner) {
        if (runner == null) {
            return List.of();
        }
        List<Shoe> shoes = shoeRepository.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner);
        if (shoes == null || shoes.isEmpty()) {
            return List.of();
        }
        Map<Long, Double> distanceMap = buildShoeDistanceMap(runner);
        shoes.forEach(shoe -> attachCurrentDistance(shoe, distanceMap));
        return shoes;
    }

    private Map<Long, Double> buildShoeDistanceMap(Runner runner) {
        Map<Long, Double> distanceMap = new HashMap<>();
        List<Object[]> rows = activityRepository.sumDistanceKmByRunner(runner);
        if (rows == null) {
            return distanceMap;
        }
        for (Object[] row : rows) {
            if (row == null || row.length < 2 || !(row[0] instanceof Number id) || !(row[1] instanceof Number distance)) {
                continue;
            }
            distanceMap.put(id.longValue(), distance.doubleValue());
        }
        return distanceMap;
    }

    private void attachCurrentDistance(Shoe shoe, Map<Long, Double> distanceMap) {
        double activityKm = distanceMap.getOrDefault(shoe.getId(), 0.0);
        double initial = shoe.getInitialDistanceKm() != null ? shoe.getInitialDistanceKm() : 0.0;
        shoe.setCurrentDistanceKm(Math.round((activityKm + initial) * 100.0) / 100.0);
    }

    private <T> T safeValue(Supplier<T> supplier, T fallback) {
        try {
            T value = supplier.get();
            return value == null ? fallback : value;
        } catch (Exception ignored) {
            return fallback;
        }
    }
}
