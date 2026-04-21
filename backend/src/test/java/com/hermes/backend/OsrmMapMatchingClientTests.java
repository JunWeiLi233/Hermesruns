package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OsrmMapMatchingClientTests {

    @Test
    void matchOrderedBreadcrumbsBuildsOsrmMatchRequestAndReturnsOrderedSnappedPoints() {
        RestTemplate restTemplate = mock(RestTemplate.class);

        @SuppressWarnings("unchecked")
        String[] urlHolder = new String[1];
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class)))
                .thenAnswer(invocation -> {
                    urlHolder[0] = invocation.getArgument(0);
                    return ResponseEntity.ok(Map.of(
                            "code", "Ok",
                            "tracepoints", List.of(
                                    Map.of("location", List.of(-71.0585, 42.3605)),
                                    Map.of("location", List.of(-71.0578, 42.3611)),
                                    Map.of("location", List.of(-71.0562, 42.3624))
                            )
                    ));
                });

        OsrmMapMatchingClient client = new OsrmMapMatchingClient(restTemplate);
        ReflectionTestUtils.setField(client, "osrmBaseUrl", "https://router.project-osrm.org");
        ReflectionTestUtils.setField(client, "osrmProfile", "driving");

        List<MatchedBreadcrumbPointDTO> result = client.matchOrderedBreadcrumbs(List.of(
                new RawBreadcrumbPointDTO(42.3601, -71.0589),
                new RawBreadcrumbPointDTO(42.3608, -71.0580),
                new RawBreadcrumbPointDTO(42.3620, -71.0568)
        ));

        assertThat(result)
                .extracting(MatchedBreadcrumbPointDTO::latitude, MatchedBreadcrumbPointDTO::longitude)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(42.3605, -71.0585),
                        org.assertj.core.groups.Tuple.tuple(42.3611, -71.0578),
                        org.assertj.core.groups.Tuple.tuple(42.3624, -71.0562)
                );
        assertThat(urlHolder[0])
                .contains("/match/v1/driving/-71.0589,42.3601;-71.058,42.3608;-71.0568,42.362")
                .contains("annotations=false")
                .contains("geometries=geojson");
    }

    @Test
    void matchOrderedBreadcrumbsRejectsAnythingSmallerThanTwoPoints() {
        OsrmMapMatchingClient client = new OsrmMapMatchingClient(mock(RestTemplate.class));

        assertThatThrownBy(() -> client.matchOrderedBreadcrumbs(List.of(
                new RawBreadcrumbPointDTO(42.3601, -71.0589)
        )))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least 2");
    }

    @Test
    void matchOrderedBreadcrumbsRaisesHelpfulErrorWhenOsrmLeavesABreadcrumbUnmatched() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of(
                        "code", "Ok",
                        "tracepoints", java.util.Arrays.asList(
                                Map.of("location", List.of(-71.0585, 42.3605)),
                                null,
                                Map.of("location", List.of(-71.0562, 42.3624))
                        )
                )));

        OsrmMapMatchingClient client = new OsrmMapMatchingClient(restTemplate);

        assertThatThrownBy(() -> client.matchOrderedBreadcrumbs(List.of(
                new RawBreadcrumbPointDTO(42.3601, -71.0589),
                new RawBreadcrumbPointDTO(42.3608, -71.0580),
                new RawBreadcrumbPointDTO(42.3620, -71.0568)
        )))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("breadcrumb 1")
                .hasMessageContaining("walking semantics");
    }

    @Test
    void matchingSemanticsNoteExplainsDrivingScaffoldAndOverridePath() {
        OsrmMapMatchingClient client = new OsrmMapMatchingClient(mock(RestTemplate.class));
        ReflectionTestUtils.setField(client, "osrmProfile", "driving");

        assertThat(client.matchingSemanticsNote())
                .contains("driving")
                .contains("APP_ROUTE_MATCHING_OSRM_BASE_URL")
                .contains("APP_ROUTE_MATCHING_OSRM_PROFILE")
                .contains("walking semantics");
    }
}
