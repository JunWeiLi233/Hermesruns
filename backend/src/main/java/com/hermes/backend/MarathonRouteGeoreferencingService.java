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
        return googleGeocodingClient.isConfigured() || googleGeocodingClient.hasLocalAnchorCatalog();
    }

    public MarathonRouteGeoreferencingResult georeferenceRoute(
            String imageFilePath,
            String raceName,
            String city,
            String country,
            RoutePathExtractionResultDTO routePath
    ) {
        return georeferenceRoute(imageFilePath, raceName, city, country, routePath, null, null, null);
    }

    public MarathonRouteGeoreferencingResult georeferenceRoute(
            String imageFilePath,
            String raceName,
            String city,
            String country,
            RoutePathExtractionResultDTO routePath,
            Double fallbackLatitude,
            Double fallbackLongitude,
            Double distanceKm
    ) {
        if (!isConfiguredForPipelineFallback()) {
            throw new IllegalStateException("Marathon route georeferencing is disabled because neither Google geocoding nor local race-anchor geocoding is configured.");
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

        if (usesSyntheticRouteBoundsAnchors(routePath.routeParameters().anchorPoints())) {
            throw new IllegalStateException("Synthetic route-bounds anchors are not accepted for route-backed georeferencing.");
        }

        List<GeocodedAnchorPointDTO> geocodedAnchors = googleGeocodingClient.geocodeAnchorPoints(
                raceName,
                city,
                country,
                routePath.routeParameters().anchorPoints()
        );
        return georeferenceRouteWhenEnabled(imageFilePath, raceName, city, country, routePath, geocodedAnchors, fallbackLatitude, fallbackLongitude, distanceKm);
    }

    public MarathonRouteGeoreferencingResult georeferenceRouteWhenEnabled(
            String imageFilePath,
            String raceName,
            String city,
            String country,
            RoutePathExtractionResultDTO routePath,
            List<GeocodedAnchorPointDTO> geocodedAnchors
    ) {
        return georeferenceRouteWhenEnabled(imageFilePath, raceName, city, country, routePath, geocodedAnchors, null, null, null);
    }

    private MarathonRouteGeoreferencingResult georeferenceRouteWhenEnabled(
            String imageFilePath,
            String raceName,
            String city,
            String country,
            RoutePathExtractionResultDTO routePath,
            List<GeocodedAnchorPointDTO> geocodedAnchors,
            Double fallbackLatitude,
            Double fallbackLongitude,
            Double distanceKm
    ) {
        if (routePath == null) {
            throw new IllegalArgumentException("Route path extraction result is required.");
        }
        if (routePath.routeParameters() == null) {
            throw new IllegalArgumentException("Route parameters are required for georeferencing.");
        }

        List<RouteAnchorPixelPointDTO> pixelAnchors = qwenAnchorPixelClient.extractAnchorPixels(imageFilePath, routePath.routeParameters());
        List<GeocodedAnchorPointDTO> transformGeoAnchors = geocodedAnchors;
        AffineTransformCoefficientsDTO affineTransform = affineTransformEstimator.estimateTransform(pixelAnchors, transformGeoAnchors);
        List<RawBreadcrumbPointDTO> rawBreadcrumbs =
                affineTransformEstimator.project(routePath.points(), affineTransform);

        return new MarathonRouteGeoreferencingResult(
                routePath.routeParameters(),
                pixelAnchors,
                transformGeoAnchors,
                affineTransform,
                rawBreadcrumbs
        );
    }

    private boolean usesSyntheticRouteBoundsAnchors(List<String> anchorPoints) {
        if (anchorPoints == null || anchorPoints.size() != 4) {
            return false;
        }
        for (String anchorPoint : anchorPoints) {
            if (anchorPoint == null || !anchorPoint.toLowerCase(java.util.Locale.ROOT).contains("route bounds")) {
                return false;
            }
        }
        return true;
    }

    private MarathonRouteGeoreferencingResult georeferenceRouteWithBounds(
            String imageFilePath,
            RoutePathExtractionResultDTO routePath,
            List<GeocodedAnchorPointDTO> geocodedAnchors
    ) {
        validateText("imageFilePath", imageFilePath);
        if (routePath == null || routePath.routeParameters() == null) {
            throw new IllegalArgumentException("Route parameters are required for georeferencing.");
        }
        List<RouteAnchorPixelPointDTO> pixelAnchors = routeBoundsPixelAnchors(routePath.points());
        if (pixelAnchors.isEmpty() || geocodedAnchors == null || geocodedAnchors.size() != 4) {
            throw new IllegalArgumentException("Route bounds georeferencing requires usable route pixels and 4 geographic bounds.");
        }
        AffineTransformCoefficientsDTO affineTransform = affineTransformEstimator.estimateTransform(pixelAnchors, geocodedAnchors);
        List<RawBreadcrumbPointDTO> rawBreadcrumbs = affineTransformEstimator.project(routePath.points(), affineTransform);
        return new MarathonRouteGeoreferencingResult(
                routePath.routeParameters(),
                pixelAnchors,
                geocodedAnchors,
                affineTransform,
                rawBreadcrumbs
        );
    }

    private List<GeocodedAnchorPointDTO> routeBoundsGeoAnchors(
            String raceName,
            String city,
            String country,
            Double fallbackLatitude,
            Double fallbackLongitude,
            Double distanceKm
    ) {
        List<GeocodedAnchorPointDTO> knownBounds = googleGeocodingClient.localRouteBoundsAnchors(raceName, city, country);
        if (!knownBounds.isEmpty()) {
            return knownBounds;
        }
        if (fallbackLatitude == null || fallbackLongitude == null) {
            return List.of();
        }
        double raceDistanceKm = distanceKm == null || distanceKm <= 0 ? 42.195 : distanceKm;
        double latitudeSpan = Math.max(0.10, Math.min(0.30, raceDistanceKm / 190.0));
        double longitudeScale = Math.max(0.35, Math.cos(Math.toRadians(fallbackLatitude)));
        double longitudeSpan = Math.max(0.10, Math.min(0.38, latitudeSpan / longitudeScale));
        double north = fallbackLatitude + latitudeSpan / 2.0;
        double south = fallbackLatitude - latitudeSpan / 2.0;
        double east = fallbackLongitude + longitudeSpan / 2.0;
        double west = fallbackLongitude - longitudeSpan / 2.0;
        String label = "Catalog route bounds for " + raceName;
        return List.of(
                new GeocodedAnchorPointDTO(label + " northwest", north, west, label),
                new GeocodedAnchorPointDTO(label + " northeast", north, east, label),
                new GeocodedAnchorPointDTO(label + " southeast", south, east, label),
                new GeocodedAnchorPointDTO(label + " southwest", south, west, label)
        );
    }

    private List<RouteAnchorPixelPointDTO> routeBoundsPixelAnchors(List<RoutePixelPointDTO> routePixels) {
        if (routePixels == null || routePixels.size() < 4) {
            return List.of();
        }
        int minX = Integer.MAX_VALUE;
        int maxX = Integer.MIN_VALUE;
        int minY = Integer.MAX_VALUE;
        int maxY = Integer.MIN_VALUE;
        for (RoutePixelPointDTO point : routePixels) {
            if (point == null) continue;
            minX = Math.min(minX, point.x());
            maxX = Math.max(maxX, point.x());
            minY = Math.min(minY, point.y());
            maxY = Math.max(maxY, point.y());
        }
        if (minX == Integer.MAX_VALUE || maxX - minX < 8 || maxY - minY < 8) {
            return List.of();
        }
        return List.of(
                new RouteAnchorPixelPointDTO("route bounds northwest", minX, minY),
                new RouteAnchorPixelPointDTO("route bounds northeast", maxX, minY),
                new RouteAnchorPixelPointDTO("route bounds southeast", maxX, maxY),
                new RouteAnchorPixelPointDTO("route bounds southwest", minX, maxY)
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
