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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProfileHeatmapServiceTests {
    @Test
    void heatPointKeepsCompactAndLegacyArrayRoundTrips() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        HeatPoint point = new HeatPoint(12L, 40.0, -73.0, 1.0, 0.75);

        String json = mapper.writeValueAsString(point);

        assertThat(json).isEqualTo("[12,40.0,-73.0,0.75]");
        assertThat(mapper.readValue(json, HeatPoint.class)).isEqualTo(new HeatPoint(12L, 40.0, -73.0, 0.0, 0.75));
        assertThat(mapper.readValue("[12,40.0,-73.0,1.0,0.75]", HeatPoint.class)).isEqualTo(point);
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
