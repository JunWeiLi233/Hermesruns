package com.hermes.backend.goals;

import com.hermes.backend.activity.ActivityLocalDates;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.coaching.TrainingLogRepository;
import com.hermes.backend.runner.Runner;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A runner's goals and how far along each is (see docs/README-ANALYSIS.md, "Goals"). A goal is stored; its progress never
 * is: it is added up from the runner's runs each time, on the runner's own calendar, so it follows a run that is added,
 * deleted or moved to another day without anything to keep in step.
 *
 * <p>One query reads the runs from the start of the period before the oldest period any goal needs (so each goal can say
 * how the last period went) to today. Only the runner's own runs are ever read.</p>
 */
@Service
public class GoalService {

    /**
     * @param periodStart  first day of the period the goal is being judged over now
     * @param thisRun      what the run the request named adds to this goal, null when it adds nothing (another period, or no run named)
     */
    public record GoalView(Long id, String period, String metric, String unit, double target, LocalDateTime createdAt,
                           LocalDateTime updatedAt, LocalDate periodStart, LocalDate periodEnd, int daysTotal, int daysLeft,
                           double progress, double remaining, int percent, boolean reached, Double neededPerDay,
                           double expectedByNow, double doneByNow, String status, GoalMath.Previous previous, Double thisRun) {
    }

    public record GoalsResponse(LocalDate today, String timeZone, List<GoalView> goals, List<String> periods,
                                List<String> metrics, Map<String, Double> maxTarget) {
    }

    /**
     * @param enough true when there is enough recent running to suggest anything; false tells the card to say it needs a few weeks
     *               of running first, which is not the same as having every suggested goal already
     */
    public record SuggestionsResponse(LocalDate today, String timeZone, boolean enough, List<GoalSuggestions.Suggestion> suggestions) {
    }

    /** A goal for that period and metric already exists. */
    public static class GoalConflictException extends RuntimeException {
        GoalConflictException(String message) {
            super(message);
        }
    }

    /** No goal of this runner has that id; says nothing about whether another runner has one. */
    public static class GoalNotFoundException extends RuntimeException {
        GoalNotFoundException() {
            super("Goal not found.");
        }
    }

    private final GoalRepository goals;
    private final TrainingLogRepository runs;
    private final Clock clock;

    @Autowired
    public GoalService(GoalRepository goals, TrainingLogRepository runs) {
        this(goals, runs, Clock.systemUTC());
    }

    GoalService(GoalRepository goals, TrainingLogRepository runs, Clock clock) {
        this.goals = goals;
        this.runs = runs;
        this.clock = clock;
    }

    /**
     * @param runId a run of the runner's: each goal then says what that run adds to it (nothing, if the run is not in the
     *              period the goal is being judged over). A run that is not the runner's, or does not exist, is ignored.
     */
    @Transactional(readOnly = true)
    public GoalsResponse list(Runner runner, Long runId) {
        return respond(runner, runId);
    }

    /** Goals worth setting, from the runner's last weeks of running; see {@link GoalSuggestions}. */
    @Transactional(readOnly = true)
    public SuggestionsResponse suggest(Runner runner) {
        ZoneId zone = ActivityLocalDates.zoneOf(runner);
        LocalDate today = LocalDate.now(clock.withZone(zone));
        Set<String> existing = new LinkedHashSet<>();
        for (Goal goal : goals.findByRunnerIdOrderByIdAsc(runner.getId())) {
            existing.add(goal.getPeriod() + "/" + goal.getMetric());
        }
        LocalDate from = today.minusDays(GoalSuggestions.YEAR_DAYS + 7L);
        // A day more at each end, as for the goals themselves.
        List<TrainingLogRepository.LogRunRow> rows = runs.findRows(runner.getId(), ActivityType.RUN,
                from.minusDays(1).atStartOfDay(), today.plusDays(2).atStartOfDay());
        Map<LocalDate, double[]> byDay = new HashMap<>();
        for (TrainingLogRepository.LogRunRow row : rows) {
            LocalDate day = ActivityLocalDates.placed(row.getLocalDate(), row.getStartTime(), row.getCreatedAt(), row.getStravaApiSourced(), zone);
            if (day.isBefore(from) || day.isAfter(today)) {
                continue;
            }
            double[] sum = byDay.computeIfAbsent(day, key -> new double[4]);
            sum[0] += GoalMetrics.of(GoalMetrics.DISTANCE, row);
            sum[1] += GoalMetrics.of(GoalMetrics.TIME, row);
            sum[2] += 1;
            sum[3] += GoalMetrics.of(GoalMetrics.ELEVATION, row);
        }
        List<GoalSuggestions.Day> days = new ArrayList<>();
        byDay.forEach((day, sum) -> days.add(new GoalSuggestions.Day(day, sum[0], sum[1], (int) sum[2], sum[3])));
        return new SuggestionsResponse(today, zone.getId(), GoalSuggestions.enoughRunning(days, today),
                GoalSuggestions.suggest(days, today, existing));
    }

    /** @throws IllegalArgumentException when a value is refused; {@link GoalConflictException} when the goal exists already */
    @Transactional
    public GoalsResponse create(Runner runner, String period, String metric, Object target) {
        if (!GoalPeriods.isValid(period)) {
            throw new IllegalArgumentException("A goal covers a week, a month or a year.");
        }
        if (!GoalMetrics.isValid(metric)) {
            throw new IllegalArgumentException("A goal is about distance, time, number of runs or climb.");
        }
        double clean = GoalMetrics.cleanTarget(metric, target);
        if (goals.existsByRunnerIdAndPeriodAndMetric(runner.getId(), period, metric)) {
            throw new GoalConflictException("You already have this goal. Change its target instead.");
        }
        try {
            goals.saveAndFlush(new Goal(runner, period, metric, clean));
        } catch (DataIntegrityViolationException twoAtOnce) {
            throw new GoalConflictException("You already have this goal. Change its target instead.");
        }
        return respond(runner, null);
    }

    /** @throws GoalNotFoundException when the runner has no goal with that id */
    @Transactional
    public GoalsResponse changeTarget(Runner runner, Long id, Object target) {
        Goal goal = goals.findByIdAndRunnerId(id, runner.getId()).orElseThrow(GoalNotFoundException::new);
        goal.changeTarget(GoalMetrics.cleanTarget(goal.getMetric(), target));
        goals.saveAndFlush(goal);
        return respond(runner, null);
    }

    /** @throws GoalNotFoundException when the runner has no goal with that id */
    @Transactional
    public GoalsResponse delete(Runner runner, Long id) {
        Goal goal = goals.findByIdAndRunnerId(id, runner.getId()).orElseThrow(GoalNotFoundException::new);
        goals.delete(goal);
        goals.flush();
        return respond(runner, null);
    }

    private GoalsResponse respond(Runner runner, Long runId) {
        ZoneId zone = ActivityLocalDates.zoneOf(runner);
        LocalDate today = LocalDate.now(clock.withZone(zone));
        List<Goal> stored = goals.findByRunnerIdOrderByIdAsc(runner.getId());
        List<GoalView> views = List.of();
        if (!stored.isEmpty()) {
            views = viewsOf(runner, stored, today, zone, runId);
        }
        return new GoalsResponse(today, zone.getId(), views, GoalPeriods.ALL, GoalMetrics.ALL, GoalMetrics.MAX_TARGET);
    }

    private List<GoalView> viewsOf(Runner runner, List<Goal> stored, LocalDate today, ZoneId zone, Long runId) {
        LocalDate windowStart = stored.stream().map(goal -> GoalPeriods.previousStart(goal.getPeriod(), today)).min(LocalDate::compareTo).orElse(today);
        // A day more at each end: a run's recorded time can sit a day either side of the runner's calendar (see the training log).
        List<TrainingLogRepository.LogRunRow> rows = runs.findRows(runner.getId(), ActivityType.RUN,
                windowStart.minusDays(1).atStartOfDay(), today.plusDays(2).atStartOfDay());

        Map<Long, LocalDate> dayOf = new HashMap<>();
        for (TrainingLogRepository.LogRunRow row : rows) {
            dayOf.put(row.getId(), ActivityLocalDates.placed(row.getLocalDate(), row.getStartTime(), row.getCreatedAt(),
                    row.getStravaApiSourced(), zone));
        }
        // Each metric once, however many goals use it: two goals about distance must not add every run twice.
        Set<String> needed = new LinkedHashSet<>();
        for (Goal goal : stored) {
            needed.add(goal.getMetric());
        }
        Map<String, Map<LocalDate, Double>> byMetric = new HashMap<>();
        TrainingLogRepository.LogRunRow named = null;
        for (TrainingLogRepository.LogRunRow row : rows) {
            if (row.getId().equals(runId)) {
                named = row;
            }
            LocalDate day = dayOf.get(row.getId());
            if (day.isBefore(windowStart) || day.isAfter(today)) {
                continue;
            }
            for (String metric : needed) {
                double value = GoalMetrics.of(metric, row);
                if (value > 0) {
                    byMetric.computeIfAbsent(metric, key -> new LinkedHashMap<>()).merge(day, value, Double::sum);
                }
            }
        }

        List<GoalView> views = new ArrayList<>();
        for (Goal goal : stored) {
            GoalMath.Assessment now = GoalMath.assess(goal.getPeriod(), goal.getTarget(), today,
                    byMetric.getOrDefault(goal.getMetric(), Map.of()));
            Double thisRun = null;
            if (named != null) {
                LocalDate day = dayOf.get(named.getId());
                double value = GoalMetrics.of(goal.getMetric(), named);
                if (value > 0 && !day.isBefore(now.start()) && !day.isAfter(now.end()) && !day.isAfter(today)) {
                    thisRun = round(value);
                }
            }
            views.add(new GoalView(goal.getId(), goal.getPeriod(), goal.getMetric(), GoalMetrics.unit(goal.getMetric()),
                    goal.getTarget(), goal.getCreatedAt(), goal.getUpdatedAt(), now.start(), now.end(), now.daysTotal(),
                    now.daysLeft(), round(now.progress()), round(now.remaining()), now.percent(), now.reached(),
                    now.neededPerDay() == null ? null : round(now.neededPerDay()), round(now.expectedByNow()),
                    round(now.doneByNow()), now.status(),
                    new GoalMath.Previous(now.previous().start(), now.previous().end(), round(now.previous().progress()),
                            now.previous().reached()),
                    thisRun));
        }
        return views;
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
