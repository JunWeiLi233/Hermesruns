package com.hermes.backend;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ActivityNormalizationService {
    private final ActivityRepository activityRepository;

    public ActivityNormalizationService(ActivityRepository activityRepository) {
        this.activityRepository = activityRepository;
    }

    @Transactional
    public List<Activity> backfillActivityTypes(Runner runner) {
        List<Activity> activities = activityRepository.findByRunnerOrderByIdDesc(runner);
        List<Activity> dirtyActivities = new ArrayList<>();

        for (Activity activity : activities) {
            if (activity.getActivityType() != null) {
                continue;
            }

            ActivityType inferredType = ActivityTypeResolver.inferStoredActivityType(activity);
            if (inferredType == ActivityType.UNKNOWN) {
                continue;
            }

            activity.setActivityType(inferredType);
            dirtyActivities.add(activity);
        }

        if (!dirtyActivities.isEmpty()) {
            activityRepository.saveAll(dirtyActivities);
        }

        return activities;
    }

    @Transactional
    public List<ActivityRunSummary> findRunSummaries(Runner runner) {
        return backfillActivityTypes(runner).stream()
                .map(ActivityRunSummary::from)
                .filter(summary -> summary.activityType() == ActivityType.RUN)
                .sorted((left, right) -> {
                    if (left.startTime() == null && right.startTime() == null) {
                        return Long.compare(right.id(), left.id());
                    }
                    if (left.startTime() == null) {
                        return 1;
                    }
                    if (right.startTime() == null) {
                        return -1;
                    }

                    int byTime = right.startTime().compareTo(left.startTime());
                    if (byTime != 0) {
                        return byTime;
                    }

                    return Long.compare(right.id(), left.id());
                })
                .collect(Collectors.toList());
    }
}
