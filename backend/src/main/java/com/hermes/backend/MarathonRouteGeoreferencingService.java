package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MarathonRouteGeoreferencingService {
    private final GeminiAnchorPixelClient geminiAnchorPixelClient;
    private final GoogleGeocodingClient googleGeocodingClient;
    private final AffineTransformEstimator affineTransformEstimator;

    public MarathonRouteGeoreferencingService(
            GeminiAnchorPixelClient geminiAnchorPixelClient,
            GoogleGeocodingClient googleGeocodingClient,
            AffineTransformEstimator affineTransformEstimator
    ) {
        this.geminiAnchorPixelClient = geminiAnchorPixelClient;
        this.googleGeocodingClient = googleGeocodingClient;
        this.affineTransformEstimator = affineTransformEstimator;
    }

    public MarathonRouteGeoreferencingResult georeferenceRoute(
            String imageFilePath,
            String raceName,
            String city,
            String country,
            RoutePathExtractionResultDTO routePath
    ) {
        if (routePath == null) {
            throw new IllegalArgumentException("Route path extraction result is required.");
        }
        if (routePath.routeParameters() == null) {
            throw new IllegalArgumentException("Route parameters are required for georeferencing.");
        }

        List<RouteAnchorPixelPointDTO> pixelAnchors =
                geminiAnchorPixelClient.extractAnchorPixels(imageFilePath, routePath.routeParameters());
        List<GeocodedAnchorPointDTO> geocodedAnchors =
                googleGeocodingClient.geocodeAnchorPoints(raceName, city, country, routePath.routeParameters().anchorPoints());
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

    public record MarathonRouteGeoreferencingResult(
            RouteParametersDTO routeParameters,
            List<RouteAnchorPixelPointDTO> pixelAnchors,
            List<GeocodedAnchorPointDTO> geocodedAnchors,
            AffineTransformCoefficientsDTO affineTransform,
            List<RawBreadcrumbPointDTO> rawBreadcrumbs
    ) {}
}
