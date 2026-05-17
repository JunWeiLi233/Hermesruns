package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class GoogleGeocodingClientTests {

    @Test
    void geocodeAnchorPointsBuildsOrderedContextualQueriesAndReturnsFourResults() {
        RestTemplate restTemplate = mock(RestTemplate.class);

        String[] urlHolder = new String[4];
        int[] invocationCount = new int[1];
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class)))
                .thenAnswer(invocation -> {
                    int index = invocationCount[0]++;
                    urlHolder[index] = invocation.getArgument(0);
                    return ResponseEntity.ok(Map.of(
                            "status", "OK",
                            "results", List.of(Map.of(
                                    "formatted_address", "Address " + (index + 1),
                                    "geometry", Map.of(
                                            "location", Map.of(
                                                    "lat", 42.30 + index,
                                                    "lng", -71.10 - index
                                            )
                                    )
                            ))
                    ));
                });

        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);
        ReflectionTestUtils.setField(client, "apiKey", "test-key");
        ReflectionTestUtils.setField(client, "geocodingUrl", "https://maps.googleapis.com/maps/api/geocode/json");

        List<GeocodedAnchorPointDTO> result = client.geocodeAnchorPoints(
                "Berlin Marathon",
                "Berlin",
                "Germany",
                List.of("Start Line", "River Crossing", "Downtown Turn", "Finish Arch")
        );

        assertThat(result)
                .extracting(GeocodedAnchorPointDTO::label, GeocodedAnchorPointDTO::formattedAddress)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("Start Line", "Address 1"),
                        org.assertj.core.groups.Tuple.tuple("River Crossing", "Address 2"),
                        org.assertj.core.groups.Tuple.tuple("Downtown Turn", "Address 3"),
                        org.assertj.core.groups.Tuple.tuple("Finish Arch", "Address 4")
                );
        assertThat(result)
                .extracting(GeocodedAnchorPointDTO::latitude, GeocodedAnchorPointDTO::longitude)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(42.30, -71.10),
                        org.assertj.core.groups.Tuple.tuple(43.30, -72.10),
                        org.assertj.core.groups.Tuple.tuple(44.30, -73.10),
                        org.assertj.core.groups.Tuple.tuple(45.30, -74.10)
                );

        assertThat(extractAddressQuery(urlHolder[0])).isEqualTo("Start Line, Berlin Marathon, Berlin, Germany");
        assertThat(extractAddressQuery(urlHolder[1])).isEqualTo("River Crossing, Berlin Marathon, Berlin, Germany");
        assertThat(extractAddressQuery(urlHolder[2])).isEqualTo("Downtown Turn, Berlin Marathon, Berlin, Germany");
        assertThat(extractAddressQuery(urlHolder[3])).isEqualTo("Finish Arch, Berlin Marathon, Berlin, Germany");
        assertThat(urlHolder[0]).contains("key=test-key");
    }

    @Test
    void geocodeAnchorPointsRejectsFewerThanFourLabels() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));
        ReflectionTestUtils.setField(client, "apiKey", "test-key");

        assertThatThrownBy(() -> client.geocodeAnchorPoints(
                "Boston Marathon",
                "Boston",
                "United States",
                List.of("Start", "Turn", "Finish")
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("between 4 and 10");
    }

    @Test
    void geocodeAnchorPointsRaisesHelpfulErrorWhenGoogleReturnsNoStableMatch() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of(
                        "status", "OK",
                        "results", List.of(Map.of(
                                "formatted_address", "Address 1",
                                "geometry", Map.of(
                                        "location", Map.of(
                                                "lat", 42.30,
                                                "lng", -71.10
                                        )
                                )
                        ))
                )))
                .thenReturn(ResponseEntity.ok(Map.of(
                        "status", "ZERO_RESULTS",
                        "results", List.of()
                )));

        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);
        ReflectionTestUtils.setField(client, "apiKey", "test-key");

        assertThatThrownBy(() -> client.geocodeAnchorPoints(
                "Boston Marathon",
                "Boston",
                "United States",
                List.of("Start Line", "River Crossing", "Downtown Turn", "Finish Arch")
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("River Crossing")
                .hasMessageContaining("ZERO_RESULTS");
    }

    @Test
    void geocodeAnchorPointsResolvesBostonCourseTownAnchorsLocallyBeforeGoogle() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);
        ReflectionTestUtils.setField(client, "apiKey", "test-key");

        List<GeocodedAnchorPointDTO> result = client.geocodeAnchorPoints(
                "Boston Marathon",
                "Boston",
                "United States",
                List.of("Start", "Ashland", "Wellesley", "Finish")
        );

        assertThat(result)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsExactly(
                        "Boston Marathon start line, Hopkinton, MA, United States",
                        "Ashland, MA, United States",
                        "Wellesley, MA, United States",
                        "Boston Marathon finish, Boylston Street, Boston, MA, United States"
                );
        assertThat(result.get(1).latitude()).isBetween(42.20, 42.30);
        assertThat(result.get(1).longitude()).isBetween(-71.50, -71.40);
        verifyNoInteractions(restTemplate);
    }

    @Test
    void geocodeAnchorPointsResolvesSixBostonCourseTownAnchorsLocallyBeforeGoogle() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);
        ReflectionTestUtils.setField(client, "apiKey", "test-key");

        List<GeocodedAnchorPointDTO> result = client.geocodeAnchorPoints(
                "Boston Marathon",
                "Boston",
                "United States",
                List.of("Start", "Ashland", "Framingham", "Wellesley", "Newton", "Finish")
        );

        assertThat(result)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsExactly(
                        "Boston Marathon start line, Hopkinton, MA, United States",
                        "Ashland, MA, United States",
                        "Framingham, MA, United States",
                        "Wellesley, MA, United States",
                        "Newton Hills, Newton, MA, United States",
                        "Boston Marathon finish, Boylston Street, Boston, MA, United States"
                );
        verifyNoInteractions(restTemplate);
    }

    @Test
    void localRouteBoundsAnchorsIncludesBostonMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Boston Marathon",
                "Boston",
                "United States"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Boston Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .anySatisfy(latitude -> assertThat(latitude).isGreaterThan(42.34))
                .anySatisfy(latitude -> assertThat(latitude).isLessThan(42.23));
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .anySatisfy(longitude -> assertThat(longitude).isLessThan(-71.50))
                .anySatisfy(longitude -> assertThat(longitude).isGreaterThan(-71.09));
    }

    private String extractAddressQuery(String url) {
        String encoded = UriComponentsBuilder.fromUriString(url)
                .build(true)
                .getQueryParams()
                .getFirst("address");
        return encoded == null ? null : URLDecoder.decode(encoded, StandardCharsets.UTF_8);
    }
}
