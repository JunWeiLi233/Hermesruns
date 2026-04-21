package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Service
public class CoachRouteService {

    private static final int SCHEDULE_ROUTE_ACTIVITY_LIMIT = 18;
    private static final double ROUTE_CLUSTER_RADIUS_METERS = 900.0;
    private static final int ROUTE_PREVIEW_POINT_LIMIT = 40;
    private static final double EARTH_RADIUS_METERS = 6_371_000.0;

    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;

    public CoachRouteService(ActivityRepository activityRepository, ActivityPointRepository activityPointRepository) {
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
    }

    public CoachRouteRecommendationDto buildRouteRecommendation(
            Runner runner,
            CoachScheduledWorkout adjustedToday,
            List<CoachScheduledWorkout> scheduleRows
    ) {
        List<Long> recentActivityIds = activityRepository.findRecentIdsByRunnerAndActivityType(
                runner.getId(),
                ActivityType.RUN.name(),
                SCHEDULE_ROUTE_ACTIVITY_LIMIT
        );
        if (recentActivityIds == null || recentActivityIds.isEmpty()) {
            return null;
        }

        Map<Long, Activity> activitiesById = new HashMap<>();
        for (Activity activity : activityRepository.findAllById(recentActivityIds)) {
            if (activity != null) {
                activitiesById.put(activity.getId(), activity);
            }
        }

        Map<Long, List<RoutePointSample>> pointsByActivityId = new HashMap<>();
        double minLatitude = Double.POSITIVE_INFINITY;
        double maxLatitude = Double.NEGATIVE_INFINITY;
        double minLongitude = Double.POSITIVE_INFINITY;
        double maxLongitude = Double.NEGATIVE_INFINITY;
        for (Object[] row : activityPointRepository.findHeatmapPointsByActivityIds(recentActivityIds)) {
            if (row == null || row.length < 5 || !(row[0] instanceof Number activityIdNumber)) {
                continue;
            }
            long activityId = activityIdNumber.longValue();
            if (!activitiesById.containsKey(activityId)) {
                continue;
            }
            double latitude = row[1] instanceof Number number ? number.doubleValue() : Double.NaN;
            double longitude = row[2] instanceof Number number ? number.doubleValue() : Double.NaN;
            double distanceMeters = row[3] instanceof Number number ? number.doubleValue() : Double.NaN;
            int elapsedSeconds = row[4] instanceof Number number ? number.intValue() : 0;
            if (!Double.isFinite(latitude) || !Double.isFinite(longitude)) {
                continue;
            }

            pointsByActivityId.computeIfAbsent(activityId, ignored -> new ArrayList<>())
                    .add(new RoutePointSample(latitude, longitude, distanceMeters, elapsedSeconds));
            minLatitude = Math.min(minLatitude, latitude);
            maxLatitude = Math.max(maxLatitude, latitude);
            minLongitude = Math.min(minLongitude, longitude);
            maxLongitude = Math.max(maxLongitude, longitude);
        }

        if (pointsByActivityId.isEmpty()) {
            return null;
        }

        RouteBounds bounds = minLatitude == Double.POSITIVE_INFINITY
                ? null
                : new RouteBounds(minLatitude, minLongitude, maxLatitude, maxLongitude);
        Double targetDistanceKm = resolveTargetRouteDistanceKm(adjustedToday, scheduleRows);

        List<RouteActivityCandidate> candidates = new ArrayList<>();
        int recentRank = 0;
        for (Long activityId : recentActivityIds) {
            Activity activity = activitiesById.get(activityId);
            List<RoutePointSample> samples = pointsByActivityId.get(activityId);
            if (activity == null || samples == null || samples.size() < 2) {
                recentRank += 1;
                continue;
            }
            Double distanceKm = resolveActivityDistanceKm(activity, samples);
            RouteCentroid centroid = buildCentroid(samples);
            CoachRoutePreviewDto preview = buildRoutePreview(samples);
            if (preview == null || centroid == null) {
                recentRank += 1;
                continue;
            }
            candidates.add(new RouteActivityCandidate(activityId, distanceKm, recentRank, samples, centroid, preview));
            recentRank += 1;
        }

        if (candidates.isEmpty()) {
            return null;
        }

        List<RouteCluster> clusters = new ArrayList<>();
        for (RouteActivityCandidate candidate : candidates) {
            RouteCluster bestCluster = null;
            double bestDistance = Double.POSITIVE_INFINITY;
            for (RouteCluster cluster : clusters) {
                double distance = haversineMeters(
                        candidate.centroid().latitude(),
                        candidate.centroid().longitude(),
                        cluster.centroid().latitude(),
                        cluster.centroid().longitude()
                );
                if (distance <= ROUTE_CLUSTER_RADIUS_METERS && distance < bestDistance) {
                    bestCluster = cluster;
                    bestDistance = distance;
                }
            }

            if (bestCluster == null) {
                bestCluster = new RouteCluster(new ArrayList<>(), candidate.centroid());
                clusters.add(bestCluster);
            }
            bestCluster.add(candidate);
        }

        return clusters.stream()
                .min(routeClusterComparator(targetDistanceKm))
                .map(cluster -> toRouteRecommendation(cluster, bounds, targetDistanceKm))
                .orElse(null);
    }

    private Double resolveTargetRouteDistanceKm(CoachScheduledWorkout adjustedToday, List<CoachScheduledWorkout> scheduleRows) {
        Double todayDistanceKm = positiveDistanceKm(adjustedToday);
        if (todayDistanceKm != null) {
            return todayDistanceKm;
        }

        LocalDate today = adjustedToday != null && adjustedToday.getScheduledDate() != null
                ? adjustedToday.getScheduledDate()
                : LocalDate.now();
        return scheduleRows == null ? null : scheduleRows.stream()
                .filter(workout -> workout != null && workout.getScheduledDate() != null && workout.getScheduledDate().isAfter(today))
                .map(this::positiveDistanceKm)
                .filter(this::hasPositiveDistance)
                .findFirst()
                .orElse(null);
    }

    private Double positiveDistanceKm(CoachScheduledWorkout workout) {
        if (workout == null || workout.getPlannedDistanceKm() == null || workout.getPlannedDistanceKm() <= 0) {
            return null;
        }
        return workout.getPlannedDistanceKm();
    }

    private boolean hasPositiveDistance(Double distanceKm) {
        return distanceKm != null && distanceKm > 0;
    }

    private Double resolveActivityDistanceKm(Activity activity, List<RoutePointSample> samples) {
        if (activity.getDistanceKm() > 0) {
            return activity.getDistanceKm();
        }
        if (activity.getDistanceMeters() != null && activity.getDistanceMeters() > 0) {
            return activity.getDistanceMeters() / 1000.0;
        }
        RoutePointSample lastSample = samples.get(samples.size() - 1);
        if (Double.isFinite(lastSample.distanceMeters()) && lastSample.distanceMeters() > 0) {
            return lastSample.distanceMeters() / 1000.0;
        }
        return null;
    }

    private CoachRouteRecommendationDto toRouteRecommendation(RouteCluster cluster, RouteBounds bounds, Double targetDistanceKm) {
        RouteActivityCandidate representative = cluster.representative(targetDistanceKm);
        String confidence = resolveRouteConfidence(targetDistanceKm, representative.distanceKm());
        return new CoachRouteRecommendationDto(
                deriveZoneKey(cluster.centroid(), bounds),
                confidence,
                targetDistanceKm,
                representative.distanceKm(),
                cluster.candidates().size(),
                representative.preview()
        );
    }

    private Comparator<RouteCluster> routeClusterComparator(Double targetDistanceKm) {
        if (!hasPositiveDistance(targetDistanceKm)) {
            return Comparator
                    .comparingInt((RouteCluster cluster) -> cluster.recentActivityRank())
                    .thenComparing(Comparator.comparingInt(RouteCluster::activityCount).reversed());
        }

        return Comparator
                .comparingDouble((RouteCluster cluster) -> distanceGapKm(targetDistanceKm, cluster.representative(targetDistanceKm).distanceKm()))
                .thenComparingInt(cluster -> cluster.representative(targetDistanceKm).recentRank())
                .thenComparing(Comparator.comparingInt(RouteCluster::activityCount).reversed());
    }

    private double distanceGapKm(Double targetDistanceKm, Double representativeDistanceKm) {
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
        double strongThresholdKm = Math.max(1.0, targetDistanceKm * 0.12);
        double nearThresholdKm = Math.max(2.5, targetDistanceKm * 0.28);
        if (gapKm <= strongThresholdKm) {
            return "distance-match";
        }
        if (gapKm <= nearThresholdKm) {
            return "near-match";
        }
        return "best-available";
    }

    private RouteCentroid buildCentroid(List<RoutePointSample> samples) {
        if (samples == null || samples.isEmpty()) {
            return null;
        }
        double sumLatitude = 0;
        double sumLongitude = 0;
        for (RoutePointSample sample : samples) {
            sumLatitude += sample.latitude();
            sumLongitude += sample.longitude();
        }
        return new RouteCentroid(sumLatitude / samples.size(), sumLongitude / samples.size());
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

    private String formatPreviewCoordinate(double value) {
        return String.format(java.util.Locale.ROOT, "%.2f", value);
    }

    private double haversineMeters(double latitudeA, double longitudeA, double latitudeB, double longitudeB) {
        double deltaLatitude = Math.toRadians(latitudeB - latitudeA);
        double deltaLongitude = Math.toRadians(longitudeB - longitudeA);
        double a = Math.sin(deltaLatitude / 2.0) * Math.sin(deltaLatitude / 2.0)
                + Math.cos(Math.toRadians(latitudeA)) * Math.cos(Math.toRadians(latitudeB))
                * Math.sin(deltaLongitude / 2.0) * Math.sin(deltaLongitude / 2.0);
        return EARTH_RADIUS_METERS * 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
            long activityId,
            Double distanceKm,
            int recentRank,
            List<RoutePointSample> samples,
            RouteCentroid centroid,
            CoachRoutePreviewDto preview
    ) {}

    private static final class RouteCluster {
        private final List<RouteActivityCandidate> candidates;
        private double sumLatitude;
        private double sumLongitude;
        private RouteCentroid centroid;

        private RouteCluster(List<RouteActivityCandidate> candidates, RouteCentroid initialCentroid) {
            this.candidates = candidates;
            this.sumLatitude = 0.0;
            this.sumLongitude = 0.0;
            this.centroid = initialCentroid;
        }

        private void add(RouteActivityCandidate candidate) {
            candidates.add(candidate);
            sumLatitude += candidate.centroid().latitude();
            sumLongitude += candidate.centroid().longitude();
            centroid = new RouteCentroid(sumLatitude / candidates.size(), sumLongitude / candidates.size());
        }

        private List<RouteActivityCandidate> candidates() {
            return candidates;
        }

        private RouteCentroid centroid() {
            return centroid;
        }

        private int activityCount() {
            return candidates.size();
        }

        private int recentActivityRank() {
            return candidates.stream()
                    .mapToInt(RouteActivityCandidate::recentRank)
                    .min()
                    .orElse(Integer.MAX_VALUE);
        }

        private RouteActivityCandidate representative(Double targetDistanceKm) {
            Comparator<RouteActivityCandidate> comparator;
            if (targetDistanceKm != null && targetDistanceKm > 0) {
                comparator = Comparator
                        .comparingDouble((RouteActivityCandidate candidate) -> Math.abs(candidate.distanceKm() - targetDistanceKm))
                        .thenComparingInt(RouteActivityCandidate::recentRank);
            } else {
                comparator = Comparator.comparingInt(RouteActivityCandidate::recentRank);
            }
            return candidates.stream().min(comparator).orElseThrow();
        }
    }
}
