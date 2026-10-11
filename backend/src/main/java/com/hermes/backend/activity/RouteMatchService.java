package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.OptionalDouble;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Puts a run into the group of runs that took the same route (see {@link RouteMatcher}), and reads a group back as the
 * runs the run page compares with. A run joins the nearest group of its runner it fits, or starts a new one.
 */
@Service
public class RouteMatchService {

    /** The most runs of a group sent to the browser; a commute run for years has more. The newest are kept. */
    static final int MAX_RUNS = 500;

    private final RouteMatchGroupRepository groups;
    private final ActivityRecordsRepository records;
    private final ActivityRepository activities;
    private final RouteMatcher.Tolerances tolerances;

    public RouteMatchService(RouteMatchGroupRepository groups,
                             ActivityRecordsRepository records,
                             ActivityRepository activities,
                             @Value("${app.records.match.endpoint-tolerance-m:150}") double endpointToleranceMeters,
                             @Value("${app.records.match.distance-tolerance-pct:5}") double distanceTolerancePercent) {
        this.groups = groups;
        this.records = records;
        this.activities = activities;
        this.tolerances = new RouteMatcher.Tolerances(Math.max(1.0, endpointToleranceMeters), Math.max(0.0, distanceTolerancePercent) / 100.0);
    }

    // ----- writing, inside the coordinator's transaction -----

    /**
     * Sets the group of a run from its positions, creating a group when none fits.
     *
     * @param latLngs the run's positions in order, each {@code [latitude, longitude]}
     */
    void assign(Activity activity, Runner runner, List<double[]> latLngs) {
        RouteMatcher.Route route = RouteMatcher.of(latLngs, BestEffortService.runMeters(activity), tolerances);
        if (route == null) {
            activity.setRouteMatchGroupId(null);
            return;
        }
        RouteMatchGroup nearest = null;
        double nearestFit = Double.POSITIVE_INFINITY;
        for (RouteMatchGroup group : groups.findByRunnerId(runner.getId())) {
            OptionalDouble fit = RouteMatcher.fit(group.route(), route, tolerances);
            if (fit.isPresent() && fit.getAsDouble() < nearestFit) {
                nearest = group;
                nearestFit = fit.getAsDouble();
            }
        }
        if (nearest == null) {
            nearest = groups.save(new RouteMatchGroup(runner, route));
        }
        activity.setRouteMatchGroupId(nearest.getId());
    }

    /** Removes the groups no run points at any more. */
    public int removeEmptyGroups() {
        return groups.deleteAllEmpty();
    }

    // ----- reading -----

    /**
     * One run of a route.
     *
     * @param current true for the run the screen is about; @param fastest true for the run with the best pace
     */
    public record MatchRun(Long activityId, String name, LocalDateTime startTime, LocalDate date, int year,
                           double distanceMeters, double movingSeconds, double paceSecPerKm, boolean current, boolean fastest) {
    }

    /**
     * The runs of the route a run belongs to; {@code runs} is empty when it is the only one.
     *
     * @param groupId the group, or null when the run has none
     * @param count   how many runs the route has
     */
    public record Matches(Long groupId, int count, boolean loop, double distanceMeters, List<MatchRun> runs) {
    }

    /** The route of one of the runner's runs; empty when it is not the runner's run. */
    @Transactional(readOnly = true)
    public Optional<Matches> matchesOf(Runner runner, Long activityId) {
        Optional<Activity> found = activities.findByIdAndRunner(activityId, runner);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        Long groupId = found.get().getRouteMatchGroupId();
        if (groupId == null) {
            return Optional.of(new Matches(null, 0, false, 0.0, List.of()));
        }
        RouteMatchGroup group = groups.findById(groupId).orElse(null);
        List<Activity> members = new ArrayList<>(records.findGroupRuns(runner.getId(), groupId, ActivityType.RUN, PageRequest.of(0, MAX_RUNS)));
        if (members.stream().noneMatch(member -> member.getId().equals(activityId))) {
            members.add(found.get());
        }
        List<MatchRun> runs = new ArrayList<>();
        for (Activity member : members) {
            double meters = BestEffortService.runMeters(member);
            int moving = BestEffortService.movingSeconds(member);
            if (meters <= 0 || moving <= 0) {
                continue;
            }
            LocalDate day = ActivityLocalDates.of(member, runner);
            runs.add(new MatchRun(member.getId(), member.getName(), ActivityLocalDates.startTimeOf(member, ActivityLocalDates.zoneOf(runner)), day, day.getYear(), meters, moving,
                    Math.round(moving / (meters / 1000.0) * 10.0) / 10.0, member.getId().equals(activityId), false));
        }
        if (runs.size() < 2) {
            return Optional.of(new Matches(groupId, runs.size(), group != null && group.isLoop(),
                    group == null ? 0.0 : group.getDistanceMeters(), List.of()));
        }
        // Oldest first, so that when two runs share the best pace it is the earlier one that is the fastest.
        runs.sort(Comparator.comparing(MatchRun::date).thenComparing(MatchRun::activityId));
        double fastestPace = runs.stream().mapToDouble(MatchRun::paceSecPerKm).min().orElse(0.0);
        boolean fastestMarked = false;
        List<MatchRun> flagged = new ArrayList<>();
        for (MatchRun run : runs) {
            boolean fastest = !fastestMarked && run.paceSecPerKm() == fastestPace;
            fastestMarked = fastestMarked || fastest;
            flagged.add(new MatchRun(run.activityId(), run.name(), run.startTime(), run.date(), run.year(), run.distanceMeters(),
                    run.movingSeconds(), run.paceSecPerKm(), run.current(), fastest));
        }
        return Optional.of(new Matches(groupId, flagged.size(), group != null && group.isLoop(),
                group == null ? 0.0 : group.getDistanceMeters(), flagged));
    }
}
