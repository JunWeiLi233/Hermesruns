package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityPointRepository;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.routing.RouteHeatmapAnchorService;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class CoachRouteService {

    private static final int ROUTE_PREVIEW_POINT_LIMIT = 40;

    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final RouteHeatmapAnchorService anchors;

    public CoachRouteService(ActivityRepository activityRepository, ActivityPointRepository activityPointRepository) {
        this(activityRepository, activityPointRepository, null);
    }

    @Autowired
    public CoachRouteService(ActivityRepository activityRepository, ActivityPointRepository activityPointRepository,
            RouteHeatmapAnchorService anchors) {
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.anchors = anchors;
    }

    public CoachRouteRecommendationDto buildRouteRecommendation(
            Runner runner,
            CoachScheduledWorkout adjustedToday,
            List<CoachScheduledWorkout> scheduleRows
    ) {
        if (runner == null || runner.getId() == null) {
            return null;
        }
        Double targetDistanceKm = positiveDistanceKm(adjustedToday);
        if (targetDistanceKm == null) return null;
        // Use the same complete personal GPS history as the heatmap, so a recent
        // trip cannot replace the runner's densest familiar location.
        RouteHeatmapAnchorService.RouteAnchor anchor = anchors == null
                ? RouteHeatmapAnchorService.findDatabaseAnchor(activityPointRepository, runner.getId())
                : anchors.findAnchor(runner);
        if (anchor == null) {
            return null;
        }

        double minLat = Math.floor(anchor.startLat() / 0.001) * 0.001;
        double minLng = Math.floor(anchor.startLng() / 0.001) * 0.001;
        List<Long> routeIds = activityPointRepository.findHeatmapRouteActivityIds(runner.getId(), ActivityType.RUN.name(),
                minLat, minLat + 0.001, minLng, minLng + 0.001, targetDistanceKm);
        if (routeIds == null || routeIds.isEmpty()) return null;
        List<Object[]> pointRows = activityPointRepository.findHeatmapPointsByActivityIds(routeIds);

        Set<Long> hotspotActivityIds = new LinkedHashSet<>();
        double minLatitude = Double.POSITIVE_INFINITY;
        double maxLatitude = Double.NEGATIVE_INFINITY;
        double minLongitude = Double.POSITIVE_INFINITY;
        double maxLongitude = Double.NEGATIVE_INFINITY;
        for (Object[] row : pointRows) {
            if (row == null || row.length < 5 || !(row[0] instanceof Number activityIdNumber)) {
                continue;
            }
            long activityId = activityIdNumber.longValue();
            double latitude = row[1] instanceof Number number ? number.doubleValue() : Double.NaN;
            double longitude = row[2] instanceof Number number ? number.doubleValue() : Double.NaN;
            if (!isValidCoordinate(latitude, longitude)) {
                continue;
            }

            if (anchor.containsPoint(latitude, longitude)) {
                hotspotActivityIds.add(activityId);
            }
            minLatitude = Math.min(minLatitude, latitude);
            maxLatitude = Math.max(maxLatitude, latitude);
            minLongitude = Math.min(minLongitude, longitude);
            maxLongitude = Math.max(maxLongitude, longitude);
        }

        if (hotspotActivityIds.isEmpty()) {
            return null;
        }

        // Retain full traces only for runs through the hotspot, rather than
        // allocating an extra sample object for every point of every trip.
        Map<Long, List<RoutePointSample>> pointsByActivityId = new HashMap<>();
        for (Object[] row : pointRows) {
            if (row == null || row.length < 5 || !(row[0] instanceof Number activityIdNumber)
                    || !hotspotActivityIds.contains(activityIdNumber.longValue())) {
                continue;
            }
            double latitude = row[1] instanceof Number number ? number.doubleValue() : Double.NaN;
            double longitude = row[2] instanceof Number number ? number.doubleValue() : Double.NaN;
            if (!isValidCoordinate(latitude, longitude)) {
                continue;
            }
            double distanceMeters = row[3] instanceof Number number ? number.doubleValue() : Double.NaN;
            int elapsedSeconds = row[4] instanceof Number number ? number.intValue() : 0;
            pointsByActivityId.computeIfAbsent(activityIdNumber.longValue(), ignored -> new ArrayList<>())
                    .add(new RoutePointSample(latitude, longitude, distanceMeters, elapsedSeconds));
        }

        Map<Long, Activity> activitiesById = new HashMap<>();
        for (Activity activity : activityRepository.findAllById(new ArrayList<>(hotspotActivityIds))) {
            if (activity != null) {
                activitiesById.put(activity.getId(), activity);
            }
        }

        RouteBounds bounds = minLatitude == Double.POSITIVE_INFINITY
                ? null
                : new RouteBounds(minLatitude, minLongitude, maxLatitude, maxLongitude);

        List<RouteActivityCandidate> candidates = new ArrayList<>();
        int recentRank = 0;
        for (Long activityId : hotspotActivityIds) {
            Activity activity = activitiesById.get(activityId);
            List<RoutePointSample> samples = pointsByActivityId.get(activityId);
            if (activity == null || samples == null || samples.size() < 2) {
                recentRank += 1;
                continue;
            }
            Double distanceKm = resolveActivityDistanceKm(activity, samples);
            CoachRoutePreviewDto preview = buildRoutePreview(samples);
            if (!hasPositiveDistance(distanceKm) || preview == null) {
                recentRank += 1;
                continue;
            }
            candidates.add(new RouteActivityCandidate(distanceKm, recentRank, samples, preview));
            recentRank += 1;
        }

        if (candidates.isEmpty()) {
            return null;
        }

        Comparator<RouteActivityCandidate> comparator = Comparator
                .comparingDouble((RouteActivityCandidate candidate) -> distanceGapKm(targetDistanceKm, candidate.distanceKm()))
                .thenComparingInt(RouteActivityCandidate::recentRank);
        RouteActivityCandidate representative = candidates.stream().min(comparator).orElseThrow();
        if (Math.abs(representative.distanceKm() - targetDistanceKm) > targetDistanceKm * 0.15) return null;
        return new CoachRouteRecommendationDto(
                deriveZoneKey(new RouteCentroid(anchor.startLat(), anchor.startLng()), bounds),
                resolveRouteConfidence(targetDistanceKm, representative.distanceKm()),
                targetDistanceKm,
                representative.distanceKm(),
                candidates.size(),
                representative.preview(),
                buildRouteWaypoints(representative.samples(), anchor)
        );
    }

    private Double positiveDistanceKm(CoachScheduledWorkout workout) {
        if (workout == null || workout.getWorkoutType() == null
                || workout.getWorkoutType() == CoachWorkoutType.REST
                || workout.getWorkoutType() == CoachWorkoutType.CROSS_TRAIN
                || !hasPositiveDistance(workout.getPlannedDistanceKm())) {
            return null;
        }
        return workout.getPlannedDistanceKm();
    }

    private static boolean hasPositiveDistance(Double distanceKm) {
        return distanceKm != null && Double.isFinite(distanceKm) && distanceKm > 0;
    }

    private static boolean isValidCoordinate(double latitude, double longitude) {
        return Double.isFinite(latitude) && Double.isFinite(longitude)
                && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
                && !(latitude == 0.0 && longitude == 0.0);
    }

    private Double resolveActivityDistanceKm(Activity activity, List<RoutePointSample> samples) {
        if (hasPositiveDistance(activity.getDistanceKm())) {
            return activity.getDistanceKm();
        }
        if (hasPositiveDistance(activity.getDistanceMeters())) {
            return activity.getDistanceMeters() / 1000.0;
        }
        RoutePointSample lastSample = samples.get(samples.size() - 1);
        if (Double.isFinite(lastSample.distanceMeters()) && lastSample.distanceMeters() > 0) {
            return lastSample.distanceMeters() / 1000.0;
        }
        return null;
    }

    private static double distanceGapKm(Double targetDistanceKm, Double representativeDistanceKm) {
        if (!hasPositiveDistance(targetDistanceKm) || !hasPositiveDistance(representativeDistanceKm)) {
            return Double.POSITIVE_INFINITY;
        }
        return Math.abs(representativeDistanceKm - targetDistanceKm);
    }

    private String resolveRouteConfidence(Double targetDistanceKm, Double representativeDistanceKm) {
        if (!hasPositiveDistance(targetDistanceKm) || !hasPositiveDistance(representativeDistanceKm)) {
            return "best-available";
        }
        double gapKm = Math.abs(representativeDistanceKm - targetDistanceKm);
        double strongThresholdKm = targetDistanceKm * 0.12;
        double nearThresholdKm = targetDistanceKm * 0.28;
        if (gapKm <= strongThresholdKm) {
            return "distance-match";
        }
        if (gapKm <= nearThresholdKm) {
            return "near-match";
        }
        return "best-available";
    }

    private List<CoachRouteWaypointDto> buildRouteWaypoints(
            List<RoutePointSample> samples, RouteHeatmapAnchorService.RouteAnchor anchor) {
        if (samples == null || samples.size() < 2) {
            return List.of();
        }
        int stride = Math.max(1, samples.size() / ROUTE_PREVIEW_POINT_LIMIT);
        List<CoachRouteWaypointDto> waypoints = new ArrayList<>();
        boolean hotspotIncluded = false;
        for (int index = 0; index < samples.size(); index++) {
            RoutePointSample sample = samples.get(index);
            boolean inHotspot = anchor.containsPoint(sample.latitude(), sample.longitude());
            if (index % stride == 0 || (!hotspotIncluded && inHotspot)) {
                waypoints.add(new CoachRouteWaypointDto(sample.latitude(), sample.longitude()));
                hotspotIncluded |= inHotspot;
            }
        }

        RoutePointSample lastSample = samples.get(samples.size() - 1);
        CoachRouteWaypointDto lastWaypoint = new CoachRouteWaypointDto(lastSample.latitude(), lastSample.longitude());
        if (waypoints.isEmpty() || !sameWaypoint(waypoints.get(waypoints.size() - 1), lastWaypoint)) {
            waypoints.add(lastWaypoint);
        }
        return waypoints;
    }

    private CoachRoutePreviewDto buildRoutePreview(List<RoutePointSample> samples) {
        if (samples == null || samples.size() < 2) {
            return null;
        }
        double minLatitude = Double.POSITIVE_INFINITY;
        double maxLatitude = Double.NEGATIVE_INFINITY;
        double minLongitude = Double.POSITIVE_INFINITY;
        double maxLongitude = Double.NEGATIVE_INFINITY;
        for (RoutePointSample sample : samples) {
            minLatitude = Math.min(minLatitude, sample.latitude());
            maxLatitude = Math.max(maxLatitude, sample.latitude());
            minLongitude = Math.min(minLongitude, sample.longitude());
            maxLongitude = Math.max(maxLongitude, sample.longitude());
        }

        double padding = 10.0;
        double width = 100.0;
        double height = 100.0;
        double latitudeSpan = Math.max(0.00012, maxLatitude - minLatitude);
        double longitudeSpan = Math.max(0.00012, maxLongitude - minLongitude);
        double innerWidth = width - (padding * 2.0);
        double innerHeight = height - (padding * 2.0);
        int stride = Math.max(1, samples.size() / ROUTE_PREVIEW_POINT_LIMIT);
        List<RoutePreviewPoint> normalized = new ArrayList<>();
        for (int index = 0; index < samples.size(); index += stride) {
            normalized.add(normalizePreviewPoint(samples.get(index), minLatitude, latitudeSpan, minLongitude, longitudeSpan, padding, innerWidth, innerHeight));
        }
        RoutePointSample lastSample = samples.get(samples.size() - 1);
        RoutePreviewPoint lastPoint = normalizePreviewPoint(lastSample, minLatitude, latitudeSpan, minLongitude, longitudeSpan, padding, innerWidth, innerHeight);
        if (normalized.isEmpty() || !samePreviewPoint(normalized.get(normalized.size() - 1), lastPoint)) {
            normalized.add(lastPoint);
        }
        if (normalized.size() < 2) {
            return null;
        }

        StringBuilder path = new StringBuilder();
        for (int index = 0; index < normalized.size(); index++) {
            RoutePreviewPoint point = normalized.get(index);
            if (index > 0) {
                path.append(' ');
            }
            path.append(index == 0 ? 'M' : 'L')
                    .append(' ')
                    .append(formatPreviewCoordinate(point.x()))
                    .append(' ')
                    .append(formatPreviewCoordinate(point.y()));
        }

        RoutePreviewPoint start = normalized.get(0);
        RoutePreviewPoint finish = normalized.get(normalized.size() - 1);
        return new CoachRoutePreviewDto(path.toString(), start.x(), start.y(), finish.x(), finish.y());
    }

    private RoutePreviewPoint normalizePreviewPoint(
            RoutePointSample sample,
            double minLatitude,
            double latitudeSpan,
            double minLongitude,
            double longitudeSpan,
            double padding,
            double innerWidth,
            double innerHeight
    ) {
        double x = padding + (((sample.longitude() - minLongitude) / longitudeSpan) * innerWidth);
        double y = padding + (innerHeight - (((sample.latitude() - minLatitude) / latitudeSpan) * innerHeight));
        return new RoutePreviewPoint(x, y);
    }

    private boolean samePreviewPoint(RoutePreviewPoint left, RoutePreviewPoint right) {
        return Math.abs(left.x() - right.x()) < 0.001 && Math.abs(left.y() - right.y()) < 0.001;
    }

    private boolean sameWaypoint(CoachRouteWaypointDto left, CoachRouteWaypointDto right) {
        return Double.compare(left.lat(), right.lat()) == 0 && Double.compare(left.lng(), right.lng()) == 0;
    }

    private String formatPreviewCoordinate(double value) {
        return String.format(java.util.Locale.ROOT, "%.2f", value);
    }

    private String deriveZoneKey(RouteCentroid centroid, RouteBounds bounds) {
        if (centroid == null || bounds == null) {
            return "core";
        }
        double latitudeSpan = Math.max(0.0001, bounds.maxLatitude() - bounds.minLatitude());
        double longitudeSpan = Math.max(0.0001, bounds.maxLongitude() - bounds.minLongitude());
        double vertical = (centroid.latitude() - bounds.minLatitude()) / latitudeSpan;
        double horizontal = (centroid.longitude() - bounds.minLongitude()) / longitudeSpan;

        String northSouth = vertical >= 0.66 ? "north" : vertical <= 0.34 ? "south" : "mid";
        String eastWest = horizontal >= 0.66 ? "east" : horizontal <= 0.34 ? "west" : "mid";

        if ("mid".equals(northSouth) && "mid".equals(eastWest)) {
            return "core";
        }
        if ("mid".equals(northSouth)) {
            return eastWest;
        }
        if ("mid".equals(eastWest)) {
            return northSouth;
        }
        return northSouth + "-" + eastWest;
    }

    private record RoutePointSample(double latitude, double longitude, double distanceMeters, int elapsedSeconds) {}
    private record RouteCentroid(double latitude, double longitude) {}
    private record RouteBounds(double minLatitude, double minLongitude, double maxLatitude, double maxLongitude) {}
    private record RoutePreviewPoint(double x, double y) {}
    private record RouteActivityCandidate(
            Double distanceKm,
            int recentRank,
            List<RoutePointSample> samples,
            CoachRoutePreviewDto preview
    ) {}
}
