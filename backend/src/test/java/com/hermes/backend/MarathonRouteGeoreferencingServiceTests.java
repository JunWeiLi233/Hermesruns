package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MarathonRouteGeoreferencingServiceTests {

    @Test
    void georeferenceRouteUsesGoogleGeocodingQwenPixelAnchorsAndAffineProjection() {
        QwenAnchorPixelClient qwenAnchorPixelClient = mock(QwenAnchorPixelClient.class);
        AffineTransformEstimator affineTransformEstimator = mock(AffineTransformEstimator.class);
        GoogleGeocodingClient googleGeocodingClient = mock(GoogleGeocodingClient.class);

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

        MarathonRouteGeoreferencingService service = new MarathonRouteGeoreferencingService(
                qwenAnchorPixelClient,
                affineTransformEstimator,
                googleGeocodingClient
        );

        List<GeocodedAnchorPointDTO> geocodedAnchors = List.of(
                new GeocodedAnchorPointDTO("Start Line", 42.3500, -71.0700, "Start Address"),
                new GeocodedAnchorPointDTO("Bridge Turn", 42.3600, -71.0600, "Bridge Address"),
                new GeocodedAnchorPointDTO("Park Loop", 42.3700, -71.0500, "Park Address"),
                new GeocodedAnchorPointDTO("Finish Chute", 42.3800, -71.0400, "Finish Address")
        );
        List<RouteAnchorPixelPointDTO> pixelAnchors = List.of(
                new RouteAnchorPixelPointDTO("Start Line", 10, 20),
                new RouteAnchorPixelPointDTO("Bridge Turn", 30, 40),
                new RouteAnchorPixelPointDTO("Park Loop", 50, 60),
                new RouteAnchorPixelPointDTO("Finish Chute", 70, 80)
        );
        AffineTransformCoefficientsDTO coefficients = new AffineTransformCoefficientsDTO(
                0.001, 0.002, 40.0,
                -0.003, -0.004, -70.0
        );
        List<RawBreadcrumbPointDTO> rawBreadcrumbs = List.of(
                new RawBreadcrumbPointDTO(42.351, -71.071),
                new RawBreadcrumbPointDTO(42.352, -71.072)
        );

        when(googleGeocodingClient.isConfigured()).thenReturn(true);
        when(googleGeocodingClient.geocodeAnchorPoints(
                "Boston Marathon",
                "Boston",
                "United States",
                routeParameters.anchorPoints()
        )).thenReturn(geocodedAnchors);
        when(qwenAnchorPixelClient.extractAnchorPixels("C:\\maps\\course.png", routeParameters)).thenReturn(pixelAnchors);
        when(affineTransformEstimator.estimateTransform(pixelAnchors, geocodedAnchors)).thenReturn(coefficients);
        when(affineTransformEstimator.project(routePath.points(), coefficients)).thenReturn(rawBreadcrumbs);

        MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult result = service.georeferenceRoute(
                "C:\\maps\\course.png",
                "Boston Marathon",
                "Boston",
                "United States",
                routePath
        );

        assertThat(result.routeParameters()).isEqualTo(routeParameters);
        assertThat(result.pixelAnchors()).isEqualTo(pixelAnchors);
        assertThat(result.geocodedAnchors()).isEqualTo(geocodedAnchors);
        assertThat(result.affineTransform()).isEqualTo(coefficients);
        assertThat(result.rawBreadcrumbs()).isEqualTo(rawBreadcrumbs);

        verify(googleGeocodingClient).geocodeAnchorPoints(
                "Boston Marathon",
                "Boston",
                "United States",
                routeParameters.anchorPoints()
        );
        verify(qwenAnchorPixelClient).extractAnchorPixels("C:\\maps\\course.png", routeParameters);
        verify(affineTransformEstimator).estimateTransform(pixelAnchors, geocodedAnchors);
        verify(affineTransformEstimator).project(routePath.points(), coefficients);
    }

    @Test
    void georeferencingIsDisabledWhenGoogleGeocodingIsNotConfigured() {
        QwenAnchorPixelClient qwenAnchorPixelClient = mock(QwenAnchorPixelClient.class);
        AffineTransformEstimator affineTransformEstimator = mock(AffineTransformEstimator.class);
        GoogleGeocodingClient googleGeocodingClient = mock(GoogleGeocodingClient.class);
        when(googleGeocodingClient.isConfigured()).thenReturn(false);

        MarathonRouteGeoreferencingService service = new MarathonRouteGeoreferencingService(
                qwenAnchorPixelClient,
                affineTransformEstimator,
                googleGeocodingClient
        );

        assertThat(service.isConfiguredForPipelineFallback()).isFalse();
    }

    @Test
    void georeferenceRouteFailsFastWhenGoogleGeocodingIsNotConfigured() {
        QwenAnchorPixelClient qwenAnchorPixelClient = mock(QwenAnchorPixelClient.class);
        AffineTransformEstimator affineTransformEstimator = mock(AffineTransformEstimator.class);
        GoogleGeocodingClient googleGeocodingClient = mock(GoogleGeocodingClient.class);
        when(googleGeocodingClient.isConfigured()).thenReturn(false);

        RouteParametersDTO routeParameters = new RouteParametersDTO(
                "#FF3300",
                List.of("Start Line", "Bridge Turn", "Park Loop", "Finish Chute")
        );
        RoutePathExtractionResultDTO routePath = new RoutePathExtractionResultDTO(
                routeParameters,
                List.of(new RoutePixelPointDTO(10, 20)),
                1,
                120,
                80
        );

        MarathonRouteGeoreferencingService service = new MarathonRouteGeoreferencingService(
                qwenAnchorPixelClient,
                affineTransformEstimator,
                googleGeocodingClient
        );

        assertThatThrownBy(() -> service.georeferenceRoute(
                "C:\\maps\\course.png",
                "Boston Marathon",
                "Boston",
                "United States",
                routePath
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Google geocoding");
    }

    @Test
    void georeferenceRouteRejectsSyntheticRouteBoundsAnchors() {
        QwenAnchorPixelClient qwenAnchorPixelClient = mock(QwenAnchorPixelClient.class);
        AffineTransformEstimator affineTransformEstimator = mock(AffineTransformEstimator.class);
        GoogleGeocodingClient googleGeocodingClient = mock(GoogleGeocodingClient.class);
        when(googleGeocodingClient.isConfigured()).thenReturn(true);

        RoutePathExtractionResultDTO routePath = new RoutePathExtractionResultDTO(
                new RouteParametersDTO(
                        "#FDD835",
                        List.of("route bounds northwest", "route bounds northeast", "route bounds southeast", "route bounds southwest")
                ),
                List.of(
                        new RoutePixelPointDTO(10, 20),
                        new RoutePixelPointDTO(200, 20),
                        new RoutePixelPointDTO(200, 80),
                        new RoutePixelPointDTO(10, 80)
                ),
                4,
                400,
                80
        );

        MarathonRouteGeoreferencingService service = new MarathonRouteGeoreferencingService(
                qwenAnchorPixelClient,
                affineTransformEstimator,
                googleGeocodingClient
        );

        assertThatThrownBy(() -> service.georeferenceRoute(
                "C:\\maps\\boston-course.gif",
                "Boston Marathon",
                "Boston",
                "United States",
                routePath,
                42.3601,
                -71.0589,
                42.195
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Synthetic route-bounds anchors are not accepted");
    }

    @Test
    void georeferenceRouteDoesNotPublishLocalBoundsWhenAnchorPixelsFail() {
        QwenAnchorPixelClient qwenAnchorPixelClient = mock(QwenAnchorPixelClient.class);
        AffineTransformEstimator affineTransformEstimator = mock(AffineTransformEstimator.class);
        GoogleGeocodingClient googleGeocodingClient = mock(GoogleGeocodingClient.class);
        RouteParametersDTO routeParameters = new RouteParametersDTO(
                "#FDD835",
                List.of("Hopkinton", "Framingham", "Wellesley", "Finish")
        );
        RoutePathExtractionResultDTO routePath = new RoutePathExtractionResultDTO(
                routeParameters,
                List.of(
                        new RoutePixelPointDTO(100, 300),
                        new RoutePixelPointDTO(250, 260),
                        new RoutePixelPointDTO(500, 220),
                        new RoutePixelPointDTO(900, 90)
                ),
                4,
                5_640,
                1_183
        );
        List<GeocodedAnchorPointDTO> localAnchors = List.of(
                new GeocodedAnchorPointDTO("Hopkinton", 42.2295, -71.5218, "Hopkinton"),
                new GeocodedAnchorPointDTO("Framingham", 42.2793, -71.4162, "Framingham"),
                new GeocodedAnchorPointDTO("Wellesley", 42.2965, -71.2926, "Wellesley"),
                new GeocodedAnchorPointDTO("Finish", 42.3499, -71.0784, "Finish")
        );
        when(googleGeocodingClient.isConfigured()).thenReturn(true);
        when(googleGeocodingClient.geocodeAnchorPoints("Boston Marathon", "Boston", "United States", routeParameters.anchorPoints()))
                .thenReturn(localAnchors);
        when(qwenAnchorPixelClient.extractAnchorPixels("C:\\maps\\boston-course.gif", routeParameters))
                .thenThrow(new IllegalStateException("anchor pixels not visible"));

        MarathonRouteGeoreferencingService service = new MarathonRouteGeoreferencingService(
                qwenAnchorPixelClient,
                affineTransformEstimator,
                googleGeocodingClient
        );

        assertThatThrownBy(() -> service.georeferenceRoute(
                "C:\\maps\\boston-course.gif",
                "Boston Marathon",
                "Boston",
                "United States",
                routePath,
                42.3601,
                -71.0589,
                42.195
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("anchor pixels not visible");
    }
}
