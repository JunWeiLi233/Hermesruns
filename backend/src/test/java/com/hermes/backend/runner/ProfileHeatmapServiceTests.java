package com.hermes.backend.runner;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.activity.ActivityPointRepository;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.imports.ActivityNormalizationService;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import com.hermes.backend.runner.ProfileModels.HeatPoint;
import com.hermes.backend.runner.ProfileModels.HeatmapResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProfileHeatmapServiceTests {
    @Test
    void viewportCarriesExactCoordinatesVisitCountsAndPointSpeed() {
        ActivityPointRepository points = mock(ActivityPointRepository.class);
        when(points.findHeatmapSpatialPointsByRunnerAndType(anyLong(), eq("RUN"), anyDouble(), anyDouble(), anyDouble(),
                anyDouble(), anyDouble(), anyDouble(), eq(6000), eq(12000))).thenReturn(List.of(
                new Object[]{1L, 40.01, -73.01, 100.0, 30, 10, 25L, 2.0},
                new Object[]{2L, 40.02, -73.02, 200.0, 40, 20, 1L, 5.0}
        ));
        ProfileHeatmapService service = new ProfileHeatmapService(mock(ActivityRepository.class), points,
                mock(ActivityNormalizationService.class), mock(TtlCacheStore.class));
        Runner runner = new Runner(); runner.setId(1L);
        var result = service.viewport(runner, 40, -74, 41, -73, 14);
        assertThat(result.points()).extracting(HeatPoint::latitude).containsExactly(40.01, 40.02);
        assertThat(result.points()).extracting(HeatPoint::longitude).containsExactly(-73.01, -73.02);
        assertThat(result.points()).extracting(HeatPoint::visitCount).containsExactly(25L, 1L);
        assertThat(result.points().get(0).speedRatio()).isLessThan(result.points().get(1).speedRatio());
    }

    @Test
    void rejectsInvalidViewportBeforeQueryingGps() {
        ActivityPointRepository points = mock(ActivityPointRepository.class);
        ProfileHeatmapService service = new ProfileHeatmapService(mock(ActivityRepository.class), points,
                mock(ActivityNormalizationService.class), mock(TtlCacheStore.class));
        Runner runner = new Runner(); runner.setId(1L);
        assertThatThrownBy(() -> service.viewport(runner, Double.NaN, -74, 41, -73, 14)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.viewport(runner, 42, -74, 41, -73, 14)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.viewport(runner, 40, -181, 41, -73, 14)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.viewport(runner, 40, -74, 41, -73, 21)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(points);
    }

    @Test
    void heatPointKeepsCompactAndLegacyArrayRoundTrips() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        HeatPoint point = new HeatPoint(12L, 40.0, -73.0, 1.0, 0.75);

        String json = mapper.writeValueAsString(point);

        assertThat(json).isEqualTo("[12,40.0,-73.0,0.75]");
        assertThat(mapper.readValue(json, HeatPoint.class)).isEqualTo(new HeatPoint(12L, 40.0, -73.0, 0.0, 0.75));
        assertThat(mapper.readValue("[12,40.0,-73.0,1.0,0.75]", HeatPoint.class)).isEqualTo(point);
        HeatPoint visitedPoint = new HeatPoint(12L, 40.0, -73.0, 1.0, 0.75, 25);
        assertThat(mapper.readValue(mapper.writeValueAsString(visitedPoint), HeatPoint.class)).isEqualTo(visitedPoint);
    }

    @Test
    void emptyHeatmapKeepsNamespaceVersionAndFiveMinuteTtl() {
        Clock clock = mock(Clock.class);
        Instant now = Instant.parse("2026-09-04T00:00:00Z");
        when(clock.instant()).thenReturn(now);
        TtlCacheStore cacheStore = spy(TtlCacheStore.inMemoryForTests(new ObjectMapper(), clock));
        ProfileHeatmapService service = new ProfileHeatmapService(mock(ActivityRepository.class),
                mock(ActivityPointRepository.class), mock(ActivityNormalizationService.class), cacheStore);
        Runner runner = new Runner();
        runner.setId(1L);

        HeatmapResponse response = service.heatmap(runner, null, null, null, null);

        assertThat(response.points()).isEqualTo(List.of());
        verify(cacheStore).put(eq("profile-heatmap"), eq("all-points-paged-v4:1"),
                any(HeatmapResponse.class), eq(Duration.ofMinutes(5)));
        when(clock.instant()).thenReturn(now.plusSeconds(299));
        assertThat(cacheStore.get("profile-heatmap", "all-points-paged-v4:1", HeatmapResponse.class)).contains(response);
        when(clock.instant()).thenReturn(now.plusSeconds(301));
        assertThat(cacheStore.get("profile-heatmap", "all-points-paged-v4:1", HeatmapResponse.class)).isEmpty();
    }
}
