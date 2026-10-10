package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityLocalDates;
import com.hermes.backend.activity.ActivityTagRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.RunLabelService;
import com.hermes.backend.activity.RunTypes;
import com.hermes.backend.runner.Runner;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

/**
 * The training log: a runner's runs laid out by week and day, so a week or a month can be seen at a glance, with each run's
 * distance, time, effort, run type and tags, and the totals of each week. Weeks run Monday to Sunday on the runner's own
 * calendar (see "The runner's day" in docs/README-ANALYSIS.md), newest first.
 *
 * <p>A request asks for a number of weeks ending with the week of a day (today unless it says another), so earlier weeks are
 * the next request with a day before the oldest week it got. Runs can be filtered by run type and by tags (a run must carry
 * every tag asked for). Only the runner's own runs are ever read: every query is keyed by the runner.</p>
 */
@Service
public class TrainingLogService {

    public static final int DEFAULT_WEEKS = 12;
    public static final int MAX_WEEKS = 26;
    /** How many of the runner's tags the filter lists. */
    public static final int TAGS_LISTED = 30;
    /** How far back, in runs, the log looks to tell whether there is anything older. */
    private static final int OLDER_SCAN = 5000;

    public record LogRun(Long id, String name, LocalDateTime startTime, double distanceKm, int movingSeconds,
                         Double paceSecPerKm, Double effort, String effortSource, Double elevationGainM,
                         String runType, List<String> tags) {
    }

    public record LogDay(LocalDate date, List<LogRun> runs) {
    }

    /** @param days only the days that had a run, oldest first */
    public record LogWeek(LocalDate start, LocalDate end, int runs, double distanceKm, long movingSeconds,
                          double effort, double elevationGainM, List<LogDay> days) {
    }

    /**
     * @param weeks      newest week first, every week of the window even if it had no run
     * @param olderRuns  whether the runner has a run (that passes the filters) before the first week
     * @param runTypes   the run types the runner has used, for the filter
     * @param tags       the runner's most used tags, for the filter
     */
    public record LogResponse(LocalDate today, String timeZone, LocalDate from, LocalDate to, List<LogWeek> weeks,
                              boolean olderRuns, List<String> runTypes, List<RunLabelService.TagUse> tags) {
    }

    private final TrainingLogRepository rows;
    private final ActivityTagRepository tags;
    private final RunLabelService labels;
    private final Clock clock;

    @Autowired
    public TrainingLogService(TrainingLogRepository rows, ActivityTagRepository tags, RunLabelService labels) {
        this(rows, tags, labels, Clock.systemUTC());
    }

    TrainingLogService(TrainingLogRepository rows, ActivityTagRepository tags, RunLabelService labels, Clock clock) {
        this.rows = rows;
        this.tags = tags;
        this.labels = labels;
        this.clock = clock;
    }

    /**
     * @param to       the day the newest week is the week of; null or after today means today
     * @param weeks    how many weeks, 1 to {@link #MAX_WEEKS}; null for {@link #DEFAULT_WEEKS}
     * @param runType  keep only runs of this type (see {@link RunTypes}); null for all
     * @param tagWords keep only runs that carry every one of these tags; null or empty for all
     * @throws IllegalArgumentException when a value is refused
     */
    public LogResponse log(Runner runner, LocalDate to, Integer weeks, String runType, List<String> tagWords) {
        int count = weeks == null ? DEFAULT_WEEKS : weeks;
        if (count < 1 || count > MAX_WEEKS) {
            throw new IllegalArgumentException("Ask for 1 to " + MAX_WEEKS + " weeks.");
        }
        if (runType != null && !RunTypes.isValid(runType)) {
            throw new IllegalArgumentException("A run type is one of " + String.join(", ", RunTypes.ALL) + ".");
        }
        Set<String> wanted = wantedTagKeys(tagWords);

        ZoneId zone = ActivityLocalDates.zoneOf(runner);
        LocalDate today = LocalDate.now(clock.withZone(zone));
        LocalDate lastDay = to == null || to.isAfter(today) ? today : to;
        LocalDate newestStart = WeeklyEffortModel.weekStart(lastDay);
        LocalDate oldestStart = newestStart.minusWeeks(count - 1L);
        LocalDate from = oldestStart;
        LocalDate until = newestStart.plusDays(6);

        // The recorded clock can differ from the runner's calendar by up to a day either way, so read a day more at each end.
        LocalDateTime readFrom = from.minusDays(1).atStartOfDay();
        LocalDateTime readTo = until.plusDays(2).atStartOfDay();
        List<TrainingLogRepository.LogRunRow> found = rows.findRows(runner.getId(), ActivityType.RUN, readFrom, readTo);

        List<TrainingLogRepository.LogRunRow> inWindow = new ArrayList<>();
        Map<Long, LocalDate> dayOf = new LinkedHashMap<>();
        for (TrainingLogRepository.LogRunRow row : found) {
            LocalDate day = dayOf(row, zone);
            if (!day.isBefore(from) && !day.isAfter(until)) {
                inWindow.add(row);
                dayOf.put(row.getId(), day);
            }
        }
        Map<Long, List<String>> tagsOf = tagsByRun(inWindow.stream().map(TrainingLogRepository.LogRunRow::getId).toList());

        Map<LocalDate, Map<LocalDate, List<LogRun>>> byWeek = new TreeMap<>(Collections.reverseOrder());
        for (int i = 0; i < count; i++) {
            byWeek.put(newestStart.minusWeeks(i), new TreeMap<>());
        }
        for (TrainingLogRepository.LogRunRow row : inWindow) {
            List<String> runTags = tagsOf.getOrDefault(row.getId(), List.of());
            if (!passes(row.getRunType(), runTags, runType, wanted)) {
                continue;
            }
            LocalDate day = dayOf.get(row.getId());
            byWeek.get(WeeklyEffortModel.weekStart(day)).computeIfAbsent(day, d -> new ArrayList<>()).add(toRun(row, runTags));
        }

        List<LogWeek> weekRows = new ArrayList<>();
        for (Map.Entry<LocalDate, Map<LocalDate, List<LogRun>>> week : byWeek.entrySet()) {
            weekRows.add(toWeek(week.getKey(), week.getValue()));
        }
        boolean older = hasOlder(runner.getId(), from, zone, runType, wanted);
        return new LogResponse(today, zone.getId(), from, until, weekRows, older, usedRunTypes(runner.getId()),
                labels.usage(runner.getId(), TAGS_LISTED));
    }

    private boolean passes(String actualType, List<String> runTags, String wantedType, Set<String> wantedTags) {
        if (wantedType != null && !wantedType.equals(actualType)) {
            return false;
        }
        if (wantedTags.isEmpty()) {
            return true;
        }
        Set<String> have = new HashSet<>();
        for (String tag : runTags) {
            have.add(tag.toLowerCase(Locale.ROOT));
        }
        return have.containsAll(wantedTags);
    }

    private static Set<String> wantedTagKeys(List<String> words) {
        Set<String> keys = new HashSet<>();
        if (words == null) {
            return keys;
        }
        for (String word : words) {
            if (word != null && !word.isBlank()) {
                keys.add(word.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT));
            }
        }
        return keys;
    }

    private Map<Long, List<String>> tagsByRun(List<Long> ids) {
        Map<Long, List<String>> byRun = new LinkedHashMap<>();
        if (ids.isEmpty()) {
            return byRun;
        }
        for (Object[] row : tags.findLabels(ids)) {
            byRun.computeIfAbsent((Long) row[0], id -> new ArrayList<>()).add((String) row[1]);
        }
        return byRun;
    }

    /**
     * Whether the runner has a run, passing the filters, on a day before the first one shown. Runs that started a day or
     * more before it are certainly earlier on any calendar, but the ones in between are placed on the runner's calendar first.
     */
    private boolean hasOlder(Long runnerId, LocalDate from, ZoneId zone, String runType, Set<String> wantedTags) {
        List<TrainingLogRepository.OlderRunRow> earlier =
                rows.findBefore(runnerId, ActivityType.RUN, from.plusDays(1).atStartOfDay(), PageRequest.of(0, OLDER_SCAN));
        List<Long> candidates = new ArrayList<>();
        for (TrainingLogRepository.OlderRunRow row : earlier) {
            if ((runType == null || runType.equals(row.getRunType()))
                    && dayOf(row.getLocalDate(), row.getStartTime(), row.getCreatedAt(), row.getStravaApiSourced(), zone).isBefore(from)) {
                candidates.add(row.getId());
            }
        }
        if (candidates.isEmpty() || wantedTags.isEmpty()) {
            return !candidates.isEmpty();
        }
        Map<Long, List<String>> tagged = tagsByRun(candidates);
        for (Long id : candidates) {
            Set<String> have = new HashSet<>();
            for (String tag : tagged.getOrDefault(id, List.of())) {
                have.add(tag.toLowerCase(Locale.ROOT));
            }
            if (have.containsAll(wantedTags)) {
                return true;
            }
        }
        return false;
    }

    private List<String> usedRunTypes(Long runnerId) {
        Set<String> used = new HashSet<>(rows.findRunTypesUsed(runnerId));
        return RunTypes.ALL.stream().filter(used::contains).toList();
    }

    private static LocalDate dayOf(TrainingLogRepository.LogRunRow row, ZoneId zone) {
        return dayOf(row.getLocalDate(), row.getStartTime(), row.getCreatedAt(), row.getStravaApiSourced(), zone);
    }

    /** The runner's day for a run: the one its effort row says, else worked out the way {@link ActivityLocalDates} does. */
    private static LocalDate dayOf(LocalDate filedUnder, LocalDateTime start, LocalDateTime createdAt, Boolean stravaApiSourced,
                                   ZoneId zone) {
        if (filedUnder != null) {
            return filedUnder;
        }
        if (start == null) {
            return createdAt == null ? LocalDate.now() : createdAt.toLocalDate();
        }
        if (Boolean.TRUE.equals(stravaApiSourced)) {
            return start.toLocalDate();
        }
        return start.atOffset(ZoneOffset.UTC).atZoneSameInstant(zone).toLocalDate();
    }

    private static LogRun toRun(TrainingLogRepository.LogRunRow row, List<String> runTags) {
        int moving = row.getMovingTimeSeconds() != null && row.getMovingTimeSeconds() > 0 ? row.getMovingTimeSeconds()
                : row.getDurationSeconds() != null && row.getDurationSeconds() > 0 ? row.getDurationSeconds().intValue() : 0;
        double km = row.getDistanceKm() != null && row.getDistanceKm() > 0 ? row.getDistanceKm()
                : row.getDistanceMeters() != null && row.getDistanceMeters() > 0 ? row.getDistanceMeters() / 1000.0 : 0;
        Double pace = km > 0 && moving > 0 ? round1(moving / km) : null;
        return new LogRun(row.getId(), row.getName(), row.getStartTime(), round2(km), moving, pace,
                row.getEffortScore() == null ? null : round1(row.getEffortScore()), row.getEffortSource(),
                row.getElevationGain() == null ? null : round1(row.getElevationGain()), row.getRunType(), runTags);
    }

    private static LogWeek toWeek(LocalDate start, Map<LocalDate, List<LogRun>> days) {
        int runs = 0;
        double km = 0;
        long seconds = 0;
        double effort = 0;
        double climb = 0;
        List<LogDay> dayRows = new ArrayList<>();
        for (Map.Entry<LocalDate, List<LogRun>> day : days.entrySet()) {
            dayRows.add(new LogDay(day.getKey(), day.getValue()));
            for (LogRun run : day.getValue()) {
                runs++;
                km += run.distanceKm();
                seconds += run.movingSeconds();
                effort += run.effort() == null ? 0 : run.effort();
                climb += run.elevationGainM() == null ? 0 : run.elevationGainM();
            }
        }
        return new LogWeek(start, start.plusDays(6), runs, round2(km), seconds, round1(effort), round1(climb), dayRows);
    }

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
