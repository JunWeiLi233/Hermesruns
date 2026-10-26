package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RunHistoryBrowseService {
    private final RunHistoryReadRepository repository;
    private final Clock clock;

    @Autowired
    public RunHistoryBrowseService(RunHistoryReadRepository repository) { this(repository, Clock.systemUTC()); }
    RunHistoryBrowseService(RunHistoryReadRepository repository, Clock clock) {
        this.repository = repository; this.clock = clock;
    }

    public record Summary(long count, double distanceKm, long movingTimeSeconds, int activeDays,
                          Map<String, Object> longestRun, Map<String, Object> fastestRun) {}
    public record MonthSummary(String month, long count, double distanceKm, long movingTimeSeconds) {}
    public record WeekDistance(String weekStart, double distanceKm) {}
    public record BrowsePage(List<Map<String, Object>> items, String nextCursor, boolean hasMore,
                             long totalCount, Summary summary, List<Integer> years,
                             Map<String, List<Integer>> monthsByYear, List<MonthSummary> monthSummaries,
                             List<WeekDistance> weeklyDistance) {}
    private record Row(long id, String name, String dateKey, long wallTime, Long instant,
                       double km, int seconds, double groupingKm, String signature) {}
    private record Continuation(String revision, int offset) {}

    @Transactional(readOnly = true)
    public BrowsePage browse(Runner runner, int limit, String cursor, String sort, Integer year,
                             Integer month, String day, String search, String defaultName) {
        if (!Set.of("date", "distance", "pace").contains(sort)) throw invalid("Invalid history sort.");
        if (year != null && (year < 1 || year > 9999)) throw invalid("Invalid year.");
        if (month != null && (month < 1 || month > 12 || year == null)) throw invalid("Month requires a valid year.");
        LocalDate exactDay = null;
        try { if (day != null && !day.isBlank()) exactDay = LocalDate.parse(day); }
        catch (DateTimeException ex) { throw invalid("Invalid calendar date."); }
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        String unnamed = defaultName == null || defaultName.isBlank() ? "Run" : defaultName;
        if (query.length() > 256 || unnamed.length() > 256) throw invalid("Search text is too long.");
        Continuation continuation = decodeCursor(cursor);
        int size = Math.max(1, Math.min(limit, 500));
        ZoneId zone = ActivityLocalDates.zoneOf(runner);
        LocalDate today = LocalDate.now(clock.withZone(zone));
        List<Row> all = repository.findHistoryIndex(runner).stream().map(value -> row(value, zone)).toList();
        String revision = revision(runner, zone, today, sort, year, month, day, query, unnamed, all);
        if (continuation != null && !revision.equals(continuation.revision())) throw changed();
        final LocalDate selectedDay = exactDay;
        List<Row> matching = new ArrayList<>(all.stream().filter(row -> {
            if (!query.isEmpty() && !(row.name() == null || row.name().isEmpty() ? unnamed : row.name())
                    .toLowerCase(Locale.ROOT).contains(query)) return false;
            if (year == null && month == null && selectedDay == null) return true;
            if (row.dateKey() == null) return false;
            LocalDate date = LocalDate.parse(row.dateKey());
            return (year == null || date.getYear() == year) && (month == null || date.getMonthValue() == month)
                    && (selectedDay == null || date.equals(selectedDay));
        }).toList());
        boolean allInstants = matching.stream().allMatch(row -> row.instant() != null);
        Comparator<Row> order = switch (sort) {
            case "distance" -> Comparator.comparingDouble(Row::km).reversed();
            case "pace" -> Comparator.comparingDouble(RunHistoryBrowseService::pace);
            default -> Comparator.comparingLong((Row row) -> allInstants ? row.instant() : row.wallTime()).reversed();
        };
        matching.sort(order.thenComparing(Comparator.comparingLong(Row::id).reversed()));
        int offset = continuation == null ? 0 : continuation.offset();
        if (offset > matching.size()) throw invalid("History cursor is outside the result set.");
        int end = Math.min(matching.size(), offset + size);
        List<Row> selected = matching.subList(offset, end);
        Row longest = null; Row fastest = null;
        double km = 0; long seconds = 0;
        Set<String> days = new LinkedHashSet<>();
        Map<String, double[]> months = new TreeMap<>(Comparator.reverseOrder());
        for (Row row : matching) {
            km += row.km(); seconds += row.seconds();
            if (row.km() > 0 && (longest == null || row.km() > longest.km())) longest = row;
            if (Double.isFinite(pace(row)) && (fastest == null || pace(row) < pace(fastest))) fastest = row;
            if (row.dateKey() != null) {
                days.add(row.dateKey());
                double[] total = months.computeIfAbsent(row.dateKey().substring(0, 7), ignored -> new double[3]);
                total[0]++; total[1] += row.groupingKm(); total[2] += row.seconds();
            }
        }
        Set<Long> ids = new LinkedHashSet<>(); selected.forEach(row -> ids.add(row.id()));
        if (longest != null) ids.add(longest.id());
        if (fastest != null) ids.add(fastest.id());
        Map<Long, Map<String, Object>> feed = new LinkedHashMap<>();
        if (!ids.isEmpty()) for (Activity item : repository.findPageItems(runner, ids)) {
            feed.put(item.getId(), ActivityRoutePreviewHelper.toRunFeedItem(item, runner));
        }
        if (!feed.keySet().containsAll(ids)) throw changed();
        Map<String, List<Integer>> facets = new TreeMap<>(Comparator.reverseOrder());
        LocalDate currentWeek = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        double[] weeklyKm = new double[12];
        for (Row row : all) if (row.dateKey() != null) {
            LocalDate date = LocalDate.parse(row.dateKey());
            List<Integer> values = facets.computeIfAbsent(String.valueOf(date.getYear()), ignored -> new ArrayList<>());
            if (!values.contains(date.getMonthValue())) values.add(date.getMonthValue());
            long week = java.time.temporal.ChronoUnit.WEEKS.between(
                    date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)), currentWeek);
            if (!date.isAfter(today) && week >= 0 && week < 12 && row.km() > 0) {
                weeklyKm[11 - (int) week] += row.km();
            }
        }
        facets.values().forEach(values -> values.sort(Integer::compareTo));
        List<WeekDistance> weeks = new ArrayList<>();
        for (int i = 11; i >= 0; i--) {
            LocalDate start = currentWeek.minusWeeks(i);
            weeks.add(new WeekDistance(start.toString(), weeklyKm[11 - i]));
        }
        List<MonthSummary> groups = months.entrySet().stream().map(entry -> new MonthSummary(entry.getKey(),
                (long) entry.getValue()[0], entry.getValue()[1], (long) entry.getValue()[2])).toList();
        boolean more = end < matching.size();
        return new BrowsePage(selected.stream().map(row -> feed.get(row.id())).toList(),
                more ? encodeCursor(revision, end) : null, more, all.size(),
                new Summary(matching.size(), km, seconds, days.size(), longest == null ? null : feed.get(longest.id()),
                        fastest == null ? null : feed.get(fastest.id())),
                facets.keySet().stream().map(Integer::valueOf).toList(), facets, groups, weeks);
    }

    private static Row row(RunHistoryReadRepository.HistoryIndex value, ZoneId zone) {
        LocalDateTime start = value.getStartTime();
        boolean strava = Boolean.TRUE.equals(value.getStravaApiSourced());
        LocalDateTime local = ActivityLocalDates.localStart(start, strava, zone);
        if (local == null) {
            String text = value.getStartDate();
            if (text != null && text.length() >= 10) try {
                local = text.length() >= 19 ? LocalDateTime.parse(text.substring(0, 19))
                        : LocalDate.parse(text.substring(0, 10)).atStartOfDay();
            } catch (DateTimeException ignored) { /* Unknown historic date; use the same created-at fallback as the UI. */ }
            if (local == null) local = value.getCreatedAt();
        }
        String dateKey = local == null ? null : local.toLocalDate().toString();
        double km = finite(value.getDistanceKm());
        int seconds = value.getMovingTimeSeconds() == null ? 0 : value.getMovingTimeSeconds();
        double groupingKm = km != 0 ? km : Math.max(0, finite(value.getDistanceMeters()) / 1000);
        String signature = value.getId() + ":" + Objects.toString(value.getName(), "") + ":" + start + ":"
                + value.getStartDate() + ":" + value.getCreatedAt() + ":" + strava + ":" + km + ":" + seconds + ":" + groupingKm;
        return new Row(value.getId(), value.getName(), dateKey,
                local == null ? Long.MIN_VALUE : local.toInstant(ZoneOffset.UTC).toEpochMilli(),
                start == null || strava ? null : start.toInstant(ZoneOffset.UTC).toEpochMilli(),
                km, seconds, groupingKm, signature);
    }

    private static double pace(Row row) {
        return row.km() > 0 && row.seconds() > 0 ? row.seconds() / row.km() : Double.POSITIVE_INFINITY;
    }

    private static double finite(Double value) { return value != null && Double.isFinite(value) ? value : 0; }
    private static String revision(Runner runner, ZoneId zone, LocalDate today, String sort, Integer year,
                                   Integer month, String day, String query, String unnamed, List<Row> rows) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (Object part : new Object[]{runner.getId(), zone, today, sort, year, month, day, query, unnamed}) update(digest, Objects.toString(part, ""));
            rows.stream().sorted(Comparator.comparingLong(Row::id)).forEach(row -> update(digest, row.signature()));
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
    private static void update(MessageDigest digest, String value) {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        digest.update((bytes.length + ":").getBytes(StandardCharsets.UTF_8)); digest.update(bytes);
    }
    private static String encodeCursor(String revision, int offset) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString((revision + "." + offset).getBytes(StandardCharsets.US_ASCII));
    }
    private static Continuation decodeCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) return null;
        if (cursor.length() > 128) throw invalid("Invalid history cursor.");
        try {
            String[] parts = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.US_ASCII).split("\\.", -1);
            if (parts.length != 2 || !parts[0].matches("[a-f0-9]{64}")) throw new IllegalArgumentException();
            int offset = Integer.parseInt(parts[1]);
            if (offset < 1) throw new IllegalArgumentException();
            return new Continuation(parts[0], offset);
        } catch (IllegalArgumentException ex) { throw invalid("Invalid history cursor."); }
    }
    private static ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private static ResponseStatusException changed() { return new ResponseStatusException(HttpStatus.CONFLICT, "HISTORY_CHANGED"); }
}
