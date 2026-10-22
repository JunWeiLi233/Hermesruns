package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RunHistoryBrowseServiceTests {
    final RunHistoryReadRepository repository = mock(RunHistoryReadRepository.class);
    final Runner runner = new Runner();
    final Clock clock = Clock.fixed(Instant.parse("2026-10-21T12:00:00Z"), ZoneOffset.UTC);
    final RunHistoryBrowseService service = new RunHistoryBrowseService(repository, clock);

    RunHistoryBrowseServiceTests() {
        runner.setId(7L); runner.setTimeZone("America/New_York");
        when(repository.findPageItems(eq(runner), anyCollection())).thenAnswer(invocation -> {
            var ids = (java.util.Collection<Long>) invocation.getArgument(1);
            return ids.stream().map(id -> { Activity activity = new Activity(); activity.setId(id);
                activity.setRunner(runner); activity.setName("Run " + id); return activity; }).toList();
        });
    }

    @Test void pagesMoreThanFiveHundredWithoutTruncatingStatsOrUsingImportIdOrder() {
        List<RunHistoryReadRepository.HistoryIndex> rows = new ArrayList<>();
        for (int i = 1; i <= 605; i++) rows.add(row(i, "Run " + i, "2026-01-01T12:00:00", false, i, 300));
        rows.add(row(999, "Old late import", "2020-01-01T12:00:00", false, 1, 300));
        when(repository.findHistoryIndex(runner)).thenReturn(rows);
        var page = browse(60, null, "date", null, null, null, "");
        assertThat(page.items()).hasSize(60);
        assertThat(page.items().get(0).get("id")).isEqualTo(605L);
        assertThat(page.totalCount()).isEqualTo(606);
        assertThat(page.summary().count()).isEqualTo(606);
        assertThat(page.summary().distanceKm()).isEqualTo(605d * 606 / 2 + 1);
        assertThat(page.years()).containsExactly(2026, 2020);
        List<Long> found = new ArrayList<>();
        while (true) {
            page.items().forEach(item -> found.add((Long) item.get("id")));
            if (!page.hasMore()) break;
            page = browse(60, page.nextCursor(), "date", null, null, null, "");
        }
        assertThat(found).hasSize(606).doesNotHaveDuplicates();
        assertThat(found.get(found.size() - 1)).isEqualTo(999L);
        verify(repository, atLeastOnce()).findPageItems(eq(runner), argThat(ids -> ids.size() <= 62));
    }

    @Test void filtersWholeHistoryButFacetsAndWeeklyBarsRemainGlobal() {
        history(
                row(1, "Morning", "2026-10-20T12:00:00", false, 10, 3600),
                row(2, "Trail", "2024-02-01T12:00:00", false, 25, 7200),
                row(3, "Future", "2026-10-22T12:00:00", false, 99, 999));
        var page = browse(1, null, "distance", 2024, 2, null, "TRAIL");
        assertThat(page.summary().count()).isEqualTo(1);
        assertThat(page.summary().distanceKm()).isEqualTo(25);
        assertThat(page.summary().activeDays()).isEqualTo(1);
        assertThat(page.items().get(0).get("id")).isEqualTo(2L);
        assertThat(page.totalCount()).isEqualTo(3);
        assertThat(page.monthsByYear().get("2024")).containsExactly(2);
        assertThat(page.weeklyDistance()).hasSize(12);
        assertThat(page.weeklyDistance().get(11).distanceKm()).isEqualTo(10);
        assertThat(page.monthSummaries().get(0).count()).isEqualTo(1);
    }

    @Test void dayFiltersRespectUtcVersusLegacyStravaWallTime() {
        history(
                row(1, "UTC evening", "2026-10-21T01:00:00", false, 5, 1500),
                row(2, "Local morning", "2026-10-21T01:00:00", true, 6, 1800));
        assertThat(browse(60, null, "date", null, null, "2026-10-20", "").items())
                .extracting(item -> item.get("id")).containsExactly(1L);
        assertThat(browse(60, null, "date", null, null, "2026-10-21", "").items())
                .extracting(item -> item.get("id")).containsExactly(2L);
    }

    @Test void distanceAndPaceSortUseEntireMatchingHistoryWithDeterministicTies() {
        history(
                row(1, "A", "2026-10-20T10:00:00", false, 5, 1000),
                row(2, "B", "2026-10-19T10:00:00", false, 10, 3000),
                row(3, "C", "2026-10-18T10:00:00", false, 10, 3000));
        assertThat(browse(1, null, "distance", null, null, null, "").items().get(0).get("id")).isEqualTo(3L);
        assertThat(browse(1, null, "pace", null, null, null, "").items().get(0).get("id")).isEqualTo(1L);
    }

    @Test void paceSortUsesRealDistanceAndKeepsUntimedRunsBehindMeasuredPacesAcrossPages() {
        history(
                row(1, "Untimed route", "2026-10-20T10:00:00", false, 10, 0),
                row(2, "Sixty metre scrap", "2026-10-19T10:00:00", false, .06, 22),
                row(3, "Measured fast run", "2026-10-18T10:00:00", false, 10, 2700),
                row(4, "No distance", "2026-10-17T10:00:00", false, 0, 100),
                row(5, "Invalid time", "2026-10-16T10:00:00", false, 5, -10));
        var page = browse(1, null, "pace", null, null, null, "");
        assertThat(page.summary().fastestRun().get("id")).isEqualTo(3L);
        List<Long> found = new ArrayList<>();
        while (true) {
            page.items().forEach(item -> found.add((Long) item.get("id")));
            if (!page.hasMore()) break;
            page = browse(1, page.nextCursor(), "pace", null, null, null, "");
        }
        assertThat(found).containsExactly(3L, 2L, 5L, 4L, 1L);
    }

    @Test void historyWithoutMeasuredPacesStillPagesDeterministicallyWithoutAFastestClaim() {
        history(
                row(1, "Untimed", "2026-10-20T10:00:00", false, 5, 0),
                row(2, "Zero distance", "2026-10-19T10:00:00", false, 0, 300),
                row(3, "Invalid distance", "2026-10-18T10:00:00", false, Double.NaN, 300));
        var page = browse(60, null, "pace", null, null, null, "");
        assertThat(page.items()).extracting(item -> item.get("id")).containsExactly(3L, 2L, 1L);
        assertThat(page.summary().fastestRun()).isNull();
    }

    @Test void changedHistoryOrCriteriaCannotReuseAnOldCursor() {
        var one = row(1, "A", "2026-10-20T10:00:00", false, 5, 1000);
        var two = row(2, "B", "2026-10-19T10:00:00", false, 10, 3000);
        when(repository.findHistoryIndex(runner)).thenReturn(List.of(one, two));
        String cursor = browse(1, null, "date", null, null, null, "").nextCursor();
        assertThatThrownBy(() -> browse(1, cursor, "distance", null, null, null, ""))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex -> assertThat(ex.getStatusCode().value()).isEqualTo(409));
        when(repository.findHistoryIndex(runner)).thenReturn(List.of(one));
        assertThatThrownBy(() -> browse(1, cursor, "date", null, null, null, ""))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex -> assertThat(ex.getStatusCode().value()).isEqualTo(409));
    }

    @Test void zeroDistanceHistoryHasNoMisleadingLongestOrFastestRun() {
        history(row(1, "No distance", "2026-10-20T10:00:00", false, 0, 0));
        var page = browse(60, null, "date", null, null, null, "");
        assertThat(page.summary().longestRun()).isNull();
        assertThat(page.summary().fastestRun()).isNull();
    }

    @Test void malformedFiltersAndCursorFailBeforeReadingData() {
        assertThatThrownBy(() -> browse(60, null, "unknown", null, null, null, "")).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> browse(60, null, "date", 2026, 13, null, "")).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> browse(60, null, "date", null, null, "2026-02-31", "")).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> browse(60, "not-a-cursor", "date", null, null, null, "")).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(repository);
    }

    private RunHistoryBrowseService.BrowsePage browse(int limit, String cursor, String sort, Integer year, Integer month, String day, String search) {
        return service.browse(runner, limit, cursor, sort, year, month, day, search, "Run");
    }

    private void history(RunHistoryReadRepository.HistoryIndex... rows) {
        when(repository.findHistoryIndex(runner)).thenReturn(List.of(rows));
    }

    private RunHistoryReadRepository.HistoryIndex row(long id, String name, String start, boolean strava, double km, int seconds) {
        var row = mock(RunHistoryReadRepository.HistoryIndex.class);
        when(row.getId()).thenReturn(id); when(row.getName()).thenReturn(name);
        when(row.getStartTime()).thenReturn(LocalDateTime.parse(start)); when(row.getStravaApiSourced()).thenReturn(strava);
        when(row.getDistanceKm()).thenReturn(km); when(row.getMovingTimeSeconds()).thenReturn(seconds);
        return row;
    }
}
