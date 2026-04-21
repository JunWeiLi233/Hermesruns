package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MarathonRouteGeoreferencingServiceTests {

    @Test
    void georeferenceRouteCombinesPixelAnchorsGeocodedAnchorsAndProjectedBreadcrumbs() {
        GeminiAnchorPixelClient geminiAnchorPixelClient = mock(GeminiAnchorPixelClient.class);
        GoogleGeocodingClient googleGeocodingClient = mock(GoogleGeocodingClient.class);
        AffineTransformEstimator affineTransformEstimator = mock(AffineTransformEstimator.class);

        RouteParametersDTO routeParameters = new RouteParametersDTO(
                "#FF3300",
                List.of("Start Line", "Bridge Turn", "Park Loop", "Finish Chute")
        );
        RoutePathExtractionResultDTO routePath = new RoutePathExtractionResultDTO(
                routeParameters,
                List.of(
                        new RoutePixelPointDTO(10, 20),
                        new RoutePixelPointDTO(30, 40),
                        new RoutePixelPointDTO(50, 60)
                ),
                3,
                120,
                80
        );
        List<RouteAnchorPixelPointDTO> pixelAnchors = List.of(
                new RouteAnchorPixelPointDTO("Start Line", 10, 20),
                new RouteAnchorPixelPointDTO("Bridge Turn", 30, 40),
                new RouteAnchorPixelPointDTO("Park Loop", 50, 60),
                new RouteAnchorPixelPointDTO("Finish Chute", 70, 80)
        );
        List<GeocodedAnchorPointDTO> geocodedAnchors = List.of(
                new GeocodedAnchorPointDTO("Start Line", 42.1, -71.1, "Boston Start"),
                new GeocodedAnchorPointDTO("Bridge Turn", 42.2, -71.2, "Boston Bridge"),
                new GeocodedAnchorPointDTO("Park Loop", 42.3, -71.3, "Boston Park"),
                new GeocodedAnchorPointDTO("Finish Chute", 42.4, -71.4, "Boston Finish")
        );
        AffineTransformCoefficientsDTO coefficients = new AffineTransformCoefficientsDTO(
                0.01,
                0.02,
                40.0,
                -0.03,
                0.04,
                -73.0
        );
        List<RawBreadcrumbPointDTO> breadcrumbs = List.of(
                new RawBreadcrumbPointDTO(40.5, -72.5),
                new RawBreadcrumbPointDTO(41.1, -72.1),
                new RawBreadcrumbPointDTO(41.7, -71.7)
        );

        when(geminiAnchorPixelClient.extractAnchorPixels("C:\\maps\\course.png", routeParameters)).thenReturn(pixelAnchors);
        when(googleGeocodingClient.geocodeAnchorPoints(
                "Boston Marathon",
                "Boston",
                "United States",
                routeParameters.anchorPoints()
        )).thenReturn(geocodedAnchors);
        when(affineTransformEstimator.estimateTransform(pixelAnchors, geocodedAnchors)).thenReturn(coefficients);
        when(affineTransformEstimator.project(routePath.points(), coefficients)).thenReturn(breadcrumbs);

        MarathonRouteGeoreferencingService service = new MarathonRouteGeoreferencingService(
                geminiAnchorPixelClient,
                googleGeocodingClient,
                affineTransformEstimator
        );

        MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult result = service.georeferenceRoute(
                "C:\\maps\\course.png",
                "Boston Marathon",
                "Boston",
                "United States",
                routePath
        );

        verify(geminiAnchorPixelClient).extractAnchorPixels("C:\\maps\\course.png", routeParameters);
        verify(googleGeocodingClient).geocodeAnchorPoints(
                "Boston Marathon",
                "Boston",
                "United States",
                routeParameters.anchorPoints()
        );
        verify(affineTransformEstimator).estimateTransform(pixelAnchors, geocodedAnchors);
        verify(affineTransformEstimator).project(routePath.points(), coefficients);

        assertThat(result.pixelAnchors()).containsExactlyElementsOf(pixelAnchors);
        assertThat(result.geocodedAnchors()).containsExactlyElementsOf(geocodedAnchors);
        assertThat(result.affineTransform()).isEqualTo(coefficients);
        assertThat(result.rawBreadcrumbs()).containsExactlyElementsOf(breadcrumbs);
    }
}
