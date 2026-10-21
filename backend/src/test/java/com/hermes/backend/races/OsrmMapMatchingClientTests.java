package com.hermes.backend.races;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OsrmMapMatchingClientTests {

    @Test
    void matchOrderedBreadcrumbsAdaptsToLowerServerLimitsWithoutDroppingPoints() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        List<Integer> sizes = new java.util.ArrayList<>();
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class)))
                .thenAnswer(invocation -> {
                    String url = invocation.getArgument(0);
                    String[] coordinates = url.split("/driving/")[1].split("\\?")[0].split(";");
                    sizes.add(coordinates.length);
                    if (coordinates.length > 25) {
                        throw HttpClientErrorException.create(HttpStatus.BAD_REQUEST, "Bad Request", null,
                                "{\"code\":\"TooBig\",\"message\":\"Too many trace coordinates\"}"
                                        .getBytes(java.nio.charset.StandardCharsets.UTF_8),
                                java.nio.charset.StandardCharsets.UTF_8);
                    }
                    return ResponseEntity.ok(Map.of("code", "Ok", "tracepoints", java.util.Arrays.stream(coordinates)
                            .map(coordinate -> {
                                String[] pair = coordinate.split(",");
                                return Map.of("location", List.of(Double.valueOf(pair[0]), Double.valueOf(pair[1])));
                            }).toList()));
                });
        List<RawBreadcrumbPointDTO> input = java.util.stream.IntStream.range(0, 60)
                .mapToObj(index -> new RawBreadcrumbPointDTO(35.68 + index * 0.00001, 139.76 + index * 0.00001))
                .toList();

        List<MatchedBreadcrumbPointDTO> result = new OsrmMapMatchingClient(restTemplate).matchOrderedBreadcrumbs(input);

        assertThat(sizes).containsExactly(60, 50, 25, 25, 12);
        assertThat(result).hasSameSizeAs(input);
        for (int index = 0; index < input.size(); index++) {
            assertThat(result.get(index).latitude()).isEqualTo(input.get(index).latitude());
            assertThat(result.get(index).longitude()).isEqualTo(input.get(index).longitude());
        }
    }

    @Test
    void matchOrderedBreadcrumbsBatchesDenseRoutesAndPreservesEveryPointOnce() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        List<List<String>> requests = new java.util.ArrayList<>();
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class)))
                .thenAnswer(invocation -> {
                    String url = invocation.getArgument(0);
                    List<String> coordinates = List.of(url.split("/driving/")[1].split("\\?")[0].split(";"));
                    assertThat(coordinates.size()).isBetween(2, 100);
                    assertThat(url.length()).isLessThan(8000);
                    requests.add(coordinates);
                    return ResponseEntity.ok(Map.of("code", "Ok", "tracepoints", coordinates.stream()
                            .map(coordinate -> {
                                String[] pair = coordinate.split(",");
                                return Map.of("location", List.of(Double.valueOf(pair[0]), Double.valueOf(pair[1])));
                            }).toList()));
                });
        List<RawBreadcrumbPointDTO> input = java.util.stream.IntStream.range(0, 205)
                .mapToObj(index -> new RawBreadcrumbPointDTO(35.68 + index * 0.00001, 139.76 + index * 0.00001))
                .toList();

        List<MatchedBreadcrumbPointDTO> result = new OsrmMapMatchingClient(restTemplate).matchOrderedBreadcrumbs(input);

        assertThat(requests).extracting(List::size).containsExactly(100, 100, 7);
        assertThat(requests.get(1).get(0)).isEqualTo(requests.get(0).get(99));
        assertThat(requests.get(2).get(0)).isEqualTo(requests.get(1).get(99));
        assertThat(result).hasSameSizeAs(input);
        for (int index = 0; index < input.size(); index++) {
            assertThat(result.get(index).latitude()).isEqualTo(input.get(index).latitude());
            assertThat(result.get(index).longitude()).isEqualTo(input.get(index).longitude());
        }
    }

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
