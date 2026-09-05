package com.hermes.backend.routing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.activity.ActivityPointRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import com.hermes.backend.runner.Runner;
import java.time.Clock;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RouteHeatmapAnchorServiceTests {

    @Test
    void selectAnchorPrefersTheCellVisitedByMoreDistinctRuns() {
        RouteHeatmapAnchorService.RouteAnchor anchor = RouteHeatmapAnchorService.selectAnchor(List.of(
                point(1L, 40.71241, -74.00641),
                point(1L, 40.71242, -74.00642),
                point(2L, 40.71243, -74.00643),
                point(3L, 40.71244, -74.00644),
                point(9L, 40.73041, -73.99041),
                point(9L, 40.73042, -73.99042),
                point(9L, 40.73043, -73.99043),
                point(9L, 40.73044, -73.99044),
                point(9L, 40.73045, -73.99045)
        ));

        assertThat(anchor).isNotNull();
        assertThat(anchor.activityCount()).isEqualTo(3);
        assertThat(anchor.pointCount()).isEqualTo(4);
        assertThat(anchor.startLat()).isBetween(40.7124, 40.7125);
        assertThat(anchor.startLng()).isBetween(-74.0065, -74.0064);
    }

    @Test
    void selectAnchorIgnoresInvalidCoordinates() {
        RouteHeatmapAnchorService.RouteAnchor anchor = RouteHeatmapAnchorService.selectAnchor(List.of(
                point(1L, 91.0, -74.0),
                point(2L, 40.7, -181.0),
                point(3L, Double.NaN, -74.0)
        ));

        assertThat(anchor).isNull();
    }

    @Test
    void findAnchorServesSecondCallFromCacheWithoutRequeryingEveryGpsPoint() {
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        TtlCacheStore cacheStore = TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC());
        RouteHeatmapAnchorService service = new RouteHeatmapAnchorService(activityPointRepository, cacheStore);

        Runner runner = new Runner();
        runner.setId(7L);
        when(activityPointRepository.findAllHeatmapPointsByRunnerAndType(7L, ActivityType.RUN.name()))
                .thenReturn(List.of(
                        point(1L, 40.71241, -74.00641),
                        point(1L, 40.71242, -74.00642),
                        point(2L, 40.71243, -74.00643)
                ));

        RouteHeatmapAnchorService.RouteAnchor first = service.findAnchor(runner);
        RouteHeatmapAnchorService.RouteAnchor second = service.findAnchor(runner);

        assertThat(first).isNotNull();
        assertThat(second).isNotNull();
        assertThat(second.startLat()).isEqualTo(first.startLat());
        assertThat(second.startLng()).isEqualTo(first.startLng());
        assertThat(second.activityCount()).isEqualTo(first.activityCount());
        assertThat(second.pointCount()).isEqualTo(first.pointCount());
        // The whole-history GPS aggregation runs once; the repeat read is cache-served.
        verify(activityPointRepository, times(1))
                .findAllHeatmapPointsByRunnerAndType(7L, ActivityType.RUN.name());
    }

    @Test
    void findAnchorCacheKeysAreScopedPerRunner() {
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        TtlCacheStore cacheStore = TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC());
        RouteHeatmapAnchorService service = new RouteHeatmapAnchorService(activityPointRepository, cacheStore);

        Runner runnerA = new Runner();
        runnerA.setId(7L);
        Runner runnerB = new Runner();
        runnerB.setId(8L);
        when(activityPointRepository.findAllHeatmapPointsByRunnerAndType(7L, ActivityType.RUN.name()))
                .thenReturn(List.<Object[]>of(point(1L, 40.71241, -74.00641)));
        when(activityPointRepository.findAllHeatmapPointsByRunnerAndType(8L, ActivityType.RUN.name()))
                .thenReturn(List.<Object[]>of(point(2L, 41.81241, -87.62641)));

        RouteHeatmapAnchorService.RouteAnchor firstA = service.findAnchor(runnerA);
        RouteHeatmapAnchorService.RouteAnchor firstB = service.findAnchor(runnerB);
        RouteHeatmapAnchorService.RouteAnchor secondA = service.findAnchor(runnerA);
        RouteHeatmapAnchorService.RouteAnchor secondB = service.findAnchor(runnerB);

        // Each runner keeps seeing their own anchor on every (cached) call.
        assertThat(firstA.startLat()).isEqualTo(secondA.startLat()).isCloseTo(40.71241, org.assertj.core.data.Offset.offset(1e-9));
        assertThat(firstB.startLat()).isEqualTo(secondB.startLat()).isCloseTo(41.81241, org.assertj.core.data.Offset.offset(1e-9));
        // Two runners -> two full-history scans total, one per runner.
        verify(activityPointRepository, times(1))
                .findAllHeatmapPointsByRunnerAndType(7L, ActivityType.RUN.name());
        verify(activityPointRepository, times(1))
                .findAllHeatmapPointsByRunnerAndType(8L, ActivityType.RUN.name());
    }

    @Test
    void findAnchorDoesNotCacheEmptyResult() {
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        TtlCacheStore cacheStore = TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC());
        RouteHeatmapAnchorService service = new RouteHeatmapAnchorService(activityPointRepository, cacheStore);

        Runner runner = new Runner();
        runner.setId(7L);
        when(activityPointRepository.findAllHeatmapPointsByRunnerAndType(7L, ActivityType.RUN.name()))
                .thenReturn(List.of());

        assertThat(service.findAnchor(runner)).isNull();
        assertThat(service.findAnchor(runner)).isNull();
        // A null (no-data) result is not cached: every call must re-check the source.
        verify(activityPointRepository, times(2))
                .findAllHeatmapPointsByRunnerAndType(7L, ActivityType.RUN.name());
    }

    private static Object[] point(long activityId, double latitude, double longitude) {
        return new Object[]{activityId, latitude, longitude, null, null};
    }
}
