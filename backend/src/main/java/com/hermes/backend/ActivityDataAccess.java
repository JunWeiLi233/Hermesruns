package com.hermes.backend;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class ActivityDataAccess {

    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;

    public ActivityDataAccess(ActivityRepository activityRepository, ActivityPointRepository activityPointRepository) {
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
    }

    public List<Activity> findRunsForRunner(Runner runner) {
        return activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN);
    }

    public List<Activity> findActivitiesByIdsForRunner(List<Long> ids, Runner runner) {
        return activityRepository.findByIdInAndRunner(ids, runner);
    }

    public Optional<Activity> findActivityForRunner(Long id, Runner runner) {
        return activityRepository.findByIdAndRunner(id, runner);
    }

    public List<ActivityRepository.AnalysisActivitySummaryProjection> findAnalysisSummaries(Runner runner, int boundedLimit) {
        if (boundedLimit > 0) {
            return activityRepository.findAnalysisSummariesByRunnerAndActivityType(
                    runner,
                    ActivityType.RUN,
                    PageRequest.of(0, boundedLimit)
            );
        }
        return activityRepository.findAnalysisSummariesByRunnerAndActivityType(runner, ActivityType.RUN);
    }

    public Page<Activity> findRecentRunsInDistanceBucket(
            Runner runner,
            LocalDateTime beforeTime,
            double minKm,
            double maxKm,
            PageRequest pageRequest
    ) {
        return activityRepository.findRecentRunsInDistanceBucket(
                runner,
                ActivityType.RUN,
                beforeTime,
                minKm,
                maxKm,
                pageRequest
        );
    }

    public void save(Activity activity) {
        activityRepository.save(activity);
    }

    public void saveAll(List<Activity> activities) {
        activityRepository.saveAll(activities);
    }

    public List<Object[]> findRoutePreviewSamplesByActivityIds(List<Long> activityIds, int limit) {
        return activityPointRepository.findRoutePreviewSamplesByActivityIds(activityIds, limit);
    }

    public List<Object[]> findRoutePreviewBboxesByActivityIds(List<Long> activityIds) {
        return activityPointRepository.findRoutePreviewBboxesByActivityIds(activityIds);
    }

    public List<Object[]> findHeatmapCoordsByRunnerAndYear(
            Runner runner,
            LocalDateTime yearStart,
            LocalDateTime yearEnd,
            String startDatePrefix
    ) {
        return activityPointRepository.findHeatmapCoordsByRunnerAndTypeAndYear(
                runner,
                ActivityType.RUN,
                yearStart,
                yearEnd,
                startDatePrefix
        );
    }

    public List<Object[]> findHeatmapCoordsByRunner(Runner runner) {
        return activityPointRepository.findHeatmapCoordsByRunnerAndType(runner, ActivityType.RUN);
    }

    public boolean hasPoints(Activity activity) {
        return activityPointRepository.existsByActivity(activity);
    }

    public List<Object[]> findAnalyticsSamplesByActivityId(Long activityId) {
        return activityPointRepository.findAnalyticsSamplesByActivityIdOrdered(activityId);
    }

    public List<Object[]> findHrSamplesByActivityId(Long activityId) {
        return activityPointRepository.findHrSamplesByActivityIdOrdered(activityId);
    }

    public List<Object[]> findLatLngByActivityId(Long activityId) {
        return activityPointRepository.findLatLngByActivityIdOrdered(activityId);
    }

    public void savePoints(List<ActivityPoint> points) {
        activityPointRepository.saveAll(points);
        activityPointRepository.flush();
    }
}
