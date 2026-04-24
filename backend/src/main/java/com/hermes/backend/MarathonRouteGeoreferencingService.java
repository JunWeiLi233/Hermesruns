package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MarathonRouteGeoreferencingService {
    private final QwenAnchorPixelClient qwenAnchorPixelClient;
    private final AffineTransformEstimator affineTransformEstimator;
    private final GoogleGeocodingClient googleGeocodingClient;

    public MarathonRouteGeoreferencingService(
            QwenAnchorPixelClient qwenAnchorPixelClient,
            AffineTransformEstimator affineTransformEstimator,
            GoogleGeocodingClient googleGeocodingClient
    ) {
        this.qwenAnchorPixelClient = qwenAnchorPixelClient;
        this.affineTransformEstimator = affineTransformEstimator;
        this.googleGeocodingClient = googleGeocodingClient;
    }

    public boolean isConfiguredForPipelineFallback() {
        return googleGeocodingClient.isConfigured();
    }

    public MarathonRouteGeoreferencingResult georeferenceRoute(
            String imageFilePath,
            String raceName,
            String city,
            String country,
            RoutePathExtractionResultDTO routePath
    ) {
        if (!isConfiguredForPipelineFallback()) {
            throw new IllegalStateException("Marathon route georeferencing is disabled because Google geocoding is not configured.");
        }
        validateText("imageFilePath", imageFilePath);
        validateText("raceName", raceName);
        validateText("city", city);
        validateText("country", country);
        if (routePath == null) {
            throw new IllegalArgumentException("Route path extraction result is required.");
        }
        if (routePath.routeParameters() == null) {
            throw new IllegalArgumentException("Route parameters are required for georeferencing.");
        }

        List<GeocodedAnchorPointDTO> geocodedAnchors = googleGeocodingClient.geocodeAnchorPoints(
                raceName,
                city,
                country,
                routePath.routeParameters().anchorPoints()
        );
        return georeferenceRouteWhenEnabled(imageFilePath, raceName, city, country, routePath, geocodedAnchors);
    }

    public MarathonRouteGeoreferencingResult georeferenceRouteWhenEnabled(
            String imageFilePath,
            String raceName,
            String city,
            String country,
            RoutePathExtractionResultDTO routePath,
            List<GeocodedAnchorPointDTO> geocodedAnchors
    ) {
        if (routePath == null) {
            throw new IllegalArgumentException("Route path extraction result is required.");
        }
        if (routePath.routeParameters() == null) {
            throw new IllegalArgumentException("Route parameters are required for georeferencing.");
        }

        List<RouteAnchorPixelPointDTO> pixelAnchors =
                qwenAnchorPixelClient.extractAnchorPixels(imageFilePath, routePath.routeParameters());
        AffineTransformCoefficientsDTO affineTransform =
                affineTransformEstimator.estimateTransform(pixelAnchors, geocodedAnchors);
        List<RawBreadcrumbPointDTO> rawBreadcrumbs =
                affineTransformEstimator.project(routePath.points(), affineTransform);

        return new MarathonRouteGeoreferencingResult(
                routePath.routeParameters(),
                pixelAnchors,
                geocodedAnchors,
                affineTransform,
                rawBreadcrumbs
        );
    }

    private void validateText(String fieldName, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required.");
        }
    }

    public record MarathonRouteGeoreferencingResult(
            RouteParametersDTO routeParameters,
            List<RouteAnchorPixelPointDTO> pixelAnchors,
            List<GeocodedAnchorPointDTO> geocodedAnchors,
            AffineTransformCoefficientsDTO affineTransform,
            List<RawBreadcrumbPointDTO> rawBreadcrumbs
    ) {}
}
