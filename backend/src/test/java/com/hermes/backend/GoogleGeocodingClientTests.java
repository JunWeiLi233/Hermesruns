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
    void geocodeAnchorPointsResolvesOsakaCourseAnchorsLocallyBeforeGoogle() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);
        ReflectionTestUtils.setField(client, "apiKey", "");

        List<GeocodedAnchorPointDTO> result = client.geocodeAnchorPoints(
                "Osaka Marathon",
                "Osaka",
                "Japan",
                List.of("Osaka Castle Park", "Osaka City Hall", "Kyocera Dome Osaka", "Nakanoshima Park")
        );

        assertThat(result)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsExactly(
                        "Osaka Castle Park, Osaka, Japan",
                        "Osaka City Hall, Osaka, Japan",
                        "Kyocera Dome Osaka, Osaka, Japan",
                        "Nakanoshima, Osaka, Japan"
                );
        assertThat(result.get(2).latitude()).isBetween(34.66, 34.68);
        assertThat(result.get(2).longitude()).isBetween(135.47, 135.49);
        verifyNoInteractions(restTemplate);
    }

    @Test
    void geocodeAnchorPointsResolvesTokyoCourseAnchorsLocallyBeforeGoogle() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);
        ReflectionTestUtils.setField(client, "apiKey", "");

        List<GeocodedAnchorPointDTO> result = client.geocodeAnchorPoints(
                "Tokyo Marathon",
                "Tokyo",
                "Japan",
                List.of("Start", "Asakusa", "Ginza", "Finish")
        );

        assertThat(result)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsExactly(
                        "Tokyo Metropolitan Government Building, Tokyo, Japan",
                        "Kaminarimon Gate, Asakusa, Tokyo, Japan",
                        "Ginza, Tokyo, Japan",
                        "Tokyo Station / Gyoko-dori Avenue, Tokyo, Japan"
                );
        assertThat(result.get(1).latitude()).isBetween(35.70, 35.72);
        assertThat(result.get(1).longitude()).isBetween(139.79, 139.80);
        verifyNoInteractions(restTemplate);
    }

    @Test
    void geocodeAnchorPointsResolvesAthensCourseAnchorsLocallyBeforeGoogle() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);
        ReflectionTestUtils.setField(client, "apiKey", "");

        List<GeocodedAnchorPointDTO> result = client.geocodeAnchorPoints(
                "Athens Marathon",
                "Athens",
                "Greece",
                List.of("Marathon", "Nea Makri", "Pikermi", "Finish")
        );

        assertThat(result)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsExactly(
                        "Marathonas, Attica, Greece",
                        "Nea Makri, Attica, Greece",
                        "Pikermi, Attica, Greece",
                        "Panathenaic Stadium, Athens, Greece"
                );
        assertThat(result.get(0).latitude()).isBetween(38.14, 38.16);
        assertThat(result.get(3).longitude()).isBetween(23.73, 23.75);
        verifyNoInteractions(restTemplate);
    }

    @Test
    void geocodeAnchorPointsResolvesLosAngelesCourseAnchorsLocallyBeforeGoogle() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);
        ReflectionTestUtils.setField(client, "apiKey", "");

        List<GeocodedAnchorPointDTO> result = client.geocodeAnchorPoints(
                "Los Angeles Marathon",
                "Los Angeles",
                "United States",
                List.of("Dodger Stadium", "Hollywood", "Beverly Hills", "Finish")
        );

        assertThat(result)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsExactly(
                        "Dodger Stadium, Los Angeles, CA, United States",
                        "Hollywood and Vine, Los Angeles, CA, United States",
                        "Beverly Hills City Hall, Beverly Hills, CA, United States",
                        "Century City finish, Los Angeles, CA, United States"
                );
        assertThat(result.get(0).latitude()).isBetween(34.07, 34.08);
        assertThat(result.get(3).longitude()).isBetween(-118.43, -118.41);
        verifyNoInteractions(restTemplate);
    }

    @Test
    void geocodeAnchorPointsResolvesAucklandCourseAnchorsLocallyBeforeGoogle() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);
        ReflectionTestUtils.setField(client, "apiKey", "");

        List<GeocodedAnchorPointDTO> result = client.geocodeAnchorPoints(
                "Auckland Marathon",
                "Auckland",
                "New Zealand",
                List.of("Devonport", "Takapuna", "Auckland Harbour Bridge", "St Heliers", "Finish")
        );

        assertThat(result)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsExactly(
                        "King Edward Parade, Devonport, Auckland, New Zealand",
                        "Takapuna, Auckland, New Zealand",
                        "Auckland Harbour Bridge, Auckland, New Zealand",
                        "St Heliers Bay, Auckland, New Zealand",
                        "Victoria Park, Auckland, New Zealand"
                );
        assertThat(result.get(0).latitude()).isBetween(-36.84, -36.82);
        assertThat(result.get(3).longitude()).isBetween(174.85, 174.87);
        verifyNoInteractions(restTemplate);
    }

    @Test
    void geocodeAnchorPointsResolvesBangkokCourseAnchorsLocallyBeforeGoogle() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);
        ReflectionTestUtils.setField(client, "apiKey", "");

        List<GeocodedAnchorPointDTO> result = client.geocodeAnchorPoints(
                "Bangkok Marathon",
                "Bangkok",
                "Thailand",
                List.of("MBK Center", "Victory Monument", "Rama VIII Bridge", "Finish")
        );

        assertThat(result)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsExactly(
                        "MBK Center, Bangkok, Thailand",
                        "Victory Monument, Bangkok, Thailand",
                        "Rama VIII Bridge, Bangkok, Thailand",
                        "Sanam Luang finish, Bangkok, Thailand"
                );
        assertThat(result.get(0).latitude()).isBetween(13.74, 13.75);
        assertThat(result.get(3).longitude()).isBetween(100.48, 100.50);
        verifyNoInteractions(restTemplate);
    }

    @Test
    void geocodeAnchorPointsResolvesBuenosAiresCourseAnchorsLocallyBeforeGoogle() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);
        ReflectionTestUtils.setField(client, "apiKey", "");

        List<GeocodedAnchorPointDTO> result = client.geocodeAnchorPoints(
                "Buenos Aires Marathon",
                "Buenos Aires",
                "Argentina",
                List.of("Largada", "Ciudad Universitaria", "Obelisco", "Boca Juniors")
        );

        assertThat(result)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsExactly(
                        "Avenida Figueroa Alcorta and Dorrego start/finish, Buenos Aires, Argentina",
                        "Ciudad Universitaria, Buenos Aires, Argentina",
                        "Obelisco, Buenos Aires, Argentina",
                        "Boca Juniors, Buenos Aires, Argentina"
                );
        assertThat(result.get(0).latitude()).isBetween(-34.58, -34.56);
        assertThat(result.get(3).longitude()).isBetween(-58.37, -58.35);
        verifyNoInteractions(restTemplate);
    }

    @Test
    void geocodeAnchorPointsResolvesCapeTownCourseAnchorsLocallyBeforeGoogle() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);
        ReflectionTestUtils.setField(client, "apiKey", "");

        List<GeocodedAnchorPointDTO> result = client.geocodeAnchorPoints(
                "Cape Town Marathon",
                "Cape Town",
                "South Africa",
                List.of("Beach Rd Start", "Salt River", "Rondebosch Common", "Sea Point")
        );

        assertThat(result)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsExactly(
                        "Green Point start area, Cape Town, South Africa",
                        "Salt River and Liesbeek Parkway, Cape Town, South Africa",
                        "Rondebosch Common, Cape Town, South Africa",
                        "Sea Point Beach Road, Cape Town, South Africa"
                );
        assertThat(result.get(0).latitude()).isBetween(-33.91, -33.90);
        assertThat(result.get(2).longitude()).isBetween(18.48, 18.49);
        verifyNoInteractions(restTemplate);
    }

    @Test
    void geocodeAnchorPointsResolvesChengduCourseAnchorsLocallyBeforeGoogle() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);
        ReflectionTestUtils.setField(client, "apiKey", "");

        List<GeocodedAnchorPointDTO> result = client.geocodeAnchorPoints(
                "Chengdu Marathon",
                "Chengdu",
                "China",
                List.of("Jinsha Site Museum", "Tianfu Square", "Sichuan University Museum", "Century City Finish")
        );

        assertThat(result)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsExactly(
                        "Jinsha Site Museum start, Chengdu, China",
                        "Tianfu Square, Chengdu, China",
                        "Sichuan University Museum, Chengdu, China",
                        "Chengdu Century City New International Convention and Exhibition Center finish, Chengdu, China"
                );
        assertThat(result.get(0).latitude()).isBetween(30.68, 30.69);
        assertThat(result.get(3).latitude()).isBetween(30.55, 30.56);
        verifyNoInteractions(restTemplate);
    }

    @Test
    void geocodeAnchorPointsResolvesBigSurCourseAnchorsLocallyBeforeGoogle() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);
        ReflectionTestUtils.setField(client, "apiKey", "");

        List<GeocodedAnchorPointDTO> result = client.geocodeAnchorPoints(
                "Big Sur International Marathon",
                "Big Sur",
                "United States",
                List.of("Big Sur Station", "Andrew Molera St. Park", "Hurricane Point", "Bixby Bridge", "Rio Road")
        );

        assertThat(result)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsExactly(
                        "Big Sur Station, Big Sur, CA, United States",
                        "Andrew Molera State Park, Big Sur, CA, United States",
                        "Hurricane Point, Big Sur, CA, United States",
                        "Bixby Bridge, Big Sur, CA, United States",
                        "Rio Road finish, Carmel, CA, United States"
                );
        assertThat(result.get(0).latitude()).isBetween(36.23, 36.26);
        assertThat(result.get(4).longitude()).isBetween(-121.92, -121.89);
        verifyNoInteractions(restTemplate);
    }

    @Test
    void geocodeAnchorPointsResolvesBeijingCourseAnchorsLocallyBeforeGoogle() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);
        ReflectionTestUtils.setField(client, "apiKey", "");

        List<GeocodedAnchorPointDTO> result = client.geocodeAnchorPoints(
                "Beijing Marathon",
                "Beijing",
                "China",
                List.of("Start", "CCTV Tower", "National Speed Skating Oval", "Finish")
        );

        assertThat(result)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsExactly(
                        "Tiananmen Square start, Beijing, China",
                        "CCTV Tower, Beijing, China",
                        "National Speed Skating Oval, Beijing, China",
                        "Central Landscape Avenue finish, Olympic Park, Beijing, China"
                );
        assertThat(result.get(0).longitude()).isBetween(116.39, 116.41);
        assertThat(result.get(2).latitude()).isBetween(40.01, 40.03);
        verifyNoInteractions(restTemplate);
    }

    @Test
    void geocodeAnchorPointsResolvesBrusselsCourseAnchorsLocallyBeforeGoogle() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);
        ReflectionTestUtils.setField(client, "apiKey", "");

        List<GeocodedAnchorPointDTO> result = client.geocodeAnchorPoints(
                "Brussels Airport Marathon",
                "Brussels",
                "Belgium",
                List.of("Start", "Atomium", "Cinquantenaire Park", "Finish")
        );

        assertThat(result)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsExactly(
                        "Place de Brouckere start, Brussels, Belgium",
                        "Atomium, Brussels, Belgium",
                        "Parc du Cinquantenaire, Brussels, Belgium",
                        "Place des Palais finish, Brussels, Belgium"
                );
        assertThat(result.get(0).latitude()).isBetween(50.84, 50.86);
        assertThat(result.get(1).latitude()).isBetween(50.89, 50.90);
        assertThat(result.get(2).longitude()).isBetween(4.38, 4.40);
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

    @Test
    void localRouteBoundsAnchorsIncludesOsakaMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Osaka Marathon",
                "Osaka",
                "Japan"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Osaka Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .anySatisfy(latitude -> assertThat(latitude).isGreaterThan(34.69))
                .anySatisfy(latitude -> assertThat(latitude).isLessThan(34.65));
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .anySatisfy(longitude -> assertThat(longitude).isLessThan(135.48))
                .anySatisfy(longitude -> assertThat(longitude).isGreaterThan(135.54));
    }

    @Test
    void localRouteBoundsAnchorsIncludesTokyoMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Tokyo Marathon",
                "Tokyo",
                "Japan"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Tokyo Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .anySatisfy(latitude -> assertThat(latitude).isGreaterThan(35.71))
                .anySatisfy(latitude -> assertThat(latitude).isLessThan(35.65));
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .anySatisfy(longitude -> assertThat(longitude).isLessThan(139.69))
                .anySatisfy(longitude -> assertThat(longitude).isGreaterThan(139.80));
    }

    @Test
    void localRouteBoundsAnchorsIncludesAthensMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Athens Marathon",
                "Athens",
                "Greece"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Athens Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .anySatisfy(latitude -> assertThat(latitude).isGreaterThan(38.15))
                .anySatisfy(latitude -> assertThat(latitude).isLessThan(37.97));
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .anySatisfy(longitude -> assertThat(longitude).isLessThan(23.73))
                .anySatisfy(longitude -> assertThat(longitude).isGreaterThan(24.00));
    }

    @Test
    void localRouteBoundsAnchorsIncludesLosAngelesMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Los Angeles Marathon",
                "Los Angeles",
                "United States"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Los Angeles Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .anySatisfy(latitude -> assertThat(latitude).isGreaterThan(34.10))
                .anySatisfy(latitude -> assertThat(latitude).isLessThan(34.04));
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .anySatisfy(longitude -> assertThat(longitude).isLessThan(-118.46))
                .anySatisfy(longitude -> assertThat(longitude).isGreaterThan(-118.24));
    }

    @Test
    void localRouteBoundsAnchorsIncludesAucklandMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Auckland Marathon",
                "Auckland",
                "New Zealand"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Auckland Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .anySatisfy(latitude -> assertThat(latitude).isGreaterThan(-36.78))
                .anySatisfy(latitude -> assertThat(latitude).isLessThan(-36.88));
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .anySatisfy(longitude -> assertThat(longitude).isLessThan(174.75))
                .anySatisfy(longitude -> assertThat(longitude).isGreaterThan(174.86));
    }

    @Test
    void localRouteBoundsAnchorsIncludesBangkokMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Bangkok Marathon",
                "Bangkok",
                "Thailand"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Bangkok Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .anySatisfy(latitude -> assertThat(latitude).isGreaterThan(13.78))
                .anySatisfy(latitude -> assertThat(latitude).isLessThan(13.73));
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .anySatisfy(longitude -> assertThat(longitude).isLessThan(100.43))
                .anySatisfy(longitude -> assertThat(longitude).isGreaterThan(100.54));
    }

    @Test
    void localRouteBoundsAnchorsIncludesBuenosAiresMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Buenos Aires Marathon",
                "Buenos Aires",
                "Argentina"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Buenos Aires Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .anySatisfy(latitude -> assertThat(latitude).isGreaterThan(-34.54))
                .anySatisfy(latitude -> assertThat(latitude).isLessThan(-34.64));
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .anySatisfy(longitude -> assertThat(longitude).isLessThan(-58.50))
                .anySatisfy(longitude -> assertThat(longitude).isGreaterThan(-58.34));
    }

    @Test
    void localRouteBoundsAnchorsIncludesCapeTownMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Cape Town Marathon",
                "Cape Town",
                "South Africa"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Cape Town Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .anySatisfy(latitude -> assertThat(latitude).isGreaterThan(-33.90))
                .anySatisfy(latitude -> assertThat(latitude).isLessThan(-33.98));
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .anySatisfy(longitude -> assertThat(longitude).isLessThan(18.38))
                .anySatisfy(longitude -> assertThat(longitude).isGreaterThan(18.50));
    }

    @Test
    void localRouteBoundsAnchorsIncludesChengduMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Chengdu Marathon",
                "Chengdu",
                "China"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Chengdu Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .anySatisfy(latitude -> assertThat(latitude).isGreaterThan(30.69))
                .anySatisfy(latitude -> assertThat(latitude).isLessThan(30.54));
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .anySatisfy(longitude -> assertThat(longitude).isLessThan(104.00))
                .anySatisfy(longitude -> assertThat(longitude).isGreaterThan(104.12));
    }

    @Test
    void localRouteBoundsAnchorsIncludesDalianMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Dalian Marathon",
                "Dalian",
                "China"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Dalian Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .anySatisfy(latitude -> assertThat(latitude).isGreaterThan(38.94))
                .anySatisfy(latitude -> assertThat(latitude).isLessThan(38.88));
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .anySatisfy(longitude -> assertThat(longitude).isLessThan(121.57))
                .anySatisfy(longitude -> assertThat(longitude).isGreaterThan(121.69));
    }

    @Test
    void localRouteBoundsAnchorsIncludesDublinMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Dublin Marathon",
                "Dublin",
                "Ireland"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Dublin Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .contains(53.3740, 53.2960);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .contains(-6.3650, -6.2050);
    }

    @Test
    void localRouteBoundsAnchorsIncludesDohaMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Doha Marathon",
                "Doha",
                "Qatar"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Doha Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .anySatisfy(latitude -> assertThat(latitude).isGreaterThan(25.32))
                .anySatisfy(latitude -> assertThat(latitude).isLessThan(25.28));
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .anySatisfy(longitude -> assertThat(longitude).isLessThan(51.51))
                .anySatisfy(longitude -> assertThat(longitude).isGreaterThan(51.54));
    }

    @Test
    void localRouteBoundsAnchorsIncludesDubaiMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Dubai Marathon",
                "Dubai",
                "United Arab Emirates"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Dubai Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .contains(25.1900, 25.0900);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .contains(55.1450, 55.2350);
    }

    @Test
    void geocodeAnchorPointsUsesLocalDohaMarathonAnchorsWithoutGoogle() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        GoogleGeocodingClient client = new GoogleGeocodingClient(restTemplate);

        List<GeocodedAnchorPointDTO> anchors = client.geocodeAnchorPoints(
                "Doha Marathon",
                "Doha",
                "Qatar",
                List.of("Hotel Park", "Al Bidda Park", "Doha Port", "Sheraton Grand Doha Resort")
        );

        assertThat(anchors)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsExactly(
                        "Hotel Park start/finish, Doha, Qatar",
                        "Al Bidda Park, Doha, Qatar",
                        "Doha Port, Doha, Qatar",
                        "Sheraton Grand Doha Resort, West Bay, Doha, Qatar"
                );
        verifyNoInteractions(restTemplate);
    }

    @Test
    void localRouteBoundsAnchorsIncludesBigSurMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Big Sur International Marathon",
                "Big Sur",
                "United States"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Big Sur Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .anySatisfy(latitude -> assertThat(latitude).isGreaterThan(36.54))
                .anySatisfy(latitude -> assertThat(latitude).isLessThan(36.24));
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .anySatisfy(longitude -> assertThat(longitude).isLessThan(-121.93))
                .anySatisfy(longitude -> assertThat(longitude).isGreaterThan(-121.77));
    }

    @Test
    void localRouteBoundsAnchorsIncludesBeijingMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Beijing Marathon",
                "Beijing",
                "China"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Beijing Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .anySatisfy(latitude -> assertThat(latitude).isGreaterThan(40.02))
                .anySatisfy(latitude -> assertThat(latitude).isLessThan(39.90));
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .anySatisfy(longitude -> assertThat(longitude).isLessThan(116.29))
                .anySatisfy(longitude -> assertThat(longitude).isGreaterThan(116.42));
    }

    @Test
    void localRouteBoundsAnchorsIncludesMarineCorpsMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Marine Corps Marathon",
                "Washington, D.C.",
                "United States"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Marine Corps Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .anySatisfy(latitude -> assertThat(latitude).isGreaterThan(38.92))
                .anySatisfy(latitude -> assertThat(latitude).isLessThan(38.85));
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .anySatisfy(longitude -> assertThat(longitude).isLessThan(-77.08))
                .anySatisfy(longitude -> assertThat(longitude).isGreaterThan(-77.01));
    }

    @Test
    void localRouteBoundsAnchorsIncludesBrusselsAirportMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Brussels Airport Marathon",
                "Brussels",
                "Belgium"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Brussels Airport Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .anySatisfy(latitude -> assertThat(latitude).isGreaterThan(50.89))
                .anySatisfy(latitude -> assertThat(latitude).isLessThan(50.84));
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .anySatisfy(longitude -> assertThat(longitude).isLessThan(4.32))
                .anySatisfy(longitude -> assertThat(longitude).isGreaterThan(4.40));
    }

    @Test
    void localRouteBoundsAnchorsIncludesFukuokaMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Fukuoka Marathon",
                "Fukuoka",
                "Japan"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Fukuoka Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .contains(33.6500, 33.5400);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .contains(130.1450, 130.4100);
    }

    @Test
    void localRouteBoundsAnchorsIncludesGuangzhouMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Guangzhou Marathon",
                "Guangzhou",
                "China"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Guangzhou Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .contains(23.1500, 23.0750);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .contains(113.2350, 113.3950);
    }

    @Test
    void localRouteBoundsAnchorsIncludesHangzhouMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Hangzhou Marathon",
                "Hangzhou",
                "China"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Hangzhou Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .contains(30.2850, 30.1550);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .contains(120.0700, 120.2750);
    }

    @Test
    void localRouteBoundsAnchorsIncludesHelsinkiMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Helsinki Marathon",
                "Helsinki",
                "Finland"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Helsinki Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .contains(60.2350, 60.1450);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .contains(24.8200, 25.0800);
    }

    @Test
    void localRouteBoundsAnchorsIncludesHoChiMinhCityMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Ho Chi Minh City Marathon",
                "Ho Chi Minh City",
                "Vietnam"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Ho Chi Minh City Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .contains(10.7950, 10.7350);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .contains(106.6150, 106.7650);
    }

    @Test
    void localRouteBoundsAnchorsIncludesHongKongMarathonCorridor() {
        GoogleGeocodingClient client = new GoogleGeocodingClient(mock(RestTemplate.class));

        List<GeocodedAnchorPointDTO> bounds = client.localRouteBoundsAnchors(
                "Hong Kong Marathon",
                "Hong Kong",
                "China"
        );

        assertThat(bounds).hasSize(4);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::formattedAddress)
                .containsOnly("Hong Kong Marathon local route bounds");
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::latitude)
                .contains(22.3720, 22.2750);
        assertThat(bounds)
                .extracting(GeocodedAnchorPointDTO::longitude)
                .contains(114.0450, 114.2050);
    }

    private String extractAddressQuery(String url) {
        String encoded = UriComponentsBuilder.fromUriString(url)
                .build(true)
                .getQueryParams()
                .getFirst("address");
        return encoded == null ? null : URLDecoder.decode(encoded, StandardCharsets.UTF_8);
    }
}
