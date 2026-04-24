package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class RaceCourseMapGeometryService {
    private static final double EARTH_RADIUS_KM = 6371.0088;
    private static final int SELF_INTERSECTION_REPAIR_LIMIT = 6;
    private static final int MIN_ALIGNMENT_ROUTE_POINTS = 12;

    public AlignmentPlausibilityVerdict assessAlignmentPlausibility(
            List<RoutePoint> routePoints,
            Double latitude,
            Double longitude,
            Double distanceKm,
            int minimumRoutePoints,
            RaceCourseMapService.PromptRaceType raceType
    ) {
        if (routePoints.size() < minimumRoutePoints) {
            return invalid("route has only %d route points; need at least %d".formatted(routePoints.size(), minimumRoutePoints));
        }
        if (latitude != null && longitude != null) {
            double centroidDistanceKm = routeCentroidDistanceKm(routePoints, latitude, longitude);
            double maxCentroidDistance = 50.0;
            if (centroidDistanceKm > maxCentroidDistance) {
                return invalid("route centroid is %.1f km from the race location, which is too far".formatted(centroidDistanceKm));
            }
        }
        if (distanceKm != null && distanceKm > 0) {
            double routeDistanceKm = polylineDistanceKm(routePoints);
            RaceCourseMapService.AlignmentRatioWindow ratioWindow = new RaceCourseMapService.AlignmentRatioWindow(0.30, 3.0);
            if (routeDistanceKm < distanceKm * ratioWindow.minRatio() || routeDistanceKm > distanceKm * ratioWindow.maxRatio()) {
                return invalid("route length %.1f km falls outside the coarse expected range for a %.1f km race".formatted(routeDistanceKm, distanceKm));
            }
            if (minimumRoutePoints >= MIN_ALIGNMENT_ROUTE_POINTS) {
                RaceCourseMapService.AlignmentRatioWindow expectedWindow = expectedDistanceRatioWindow(distanceKm, routePoints.size());
                if (routeDistanceKm < distanceKm * expectedWindow.minRatio() || routeDistanceKm > distanceKm * expectedWindow.maxRatio()) {
                    return invalid("route length %.1f km falls outside the expected range for a %.1f km race".formatted(routeDistanceKm, distanceKm));
                }
            }
            double largestSegmentRatio = largestSegmentRatio(routePoints, routeDistanceKm);
            double maxLargestSegmentRatio = maxLargestSegmentRatio(routePoints.size(), minimumRoutePoints);
            if (largestSegmentRatio > maxLargestSegmentRatio) {
                return invalid("one segment covers %.0f%% of the full route, which is too large".formatted(largestSegmentRatio * 100.0));
            }
        }
        RaceCourseMapService.RouteGeometryDiagnosis diagnosis = diagnoseRouteGeometry(routePoints, raceType, distanceKm);
        if (diagnosis.selfIntersectionCount() > diagnosis.allowedSelfIntersections()) {
            return invalid("route crosses itself %d times, exceeding the %d allowed for %s".formatted(
                    diagnosis.selfIntersectionCount(),
                    diagnosis.allowedSelfIntersections(),
                    raceType.promptValue()
            ));
        }
        return valid("alignment passed plausibility checks");
    }

    public boolean isAlignmentPlausible(
            List<RoutePoint> routePoints,
            Double latitude,
            Double longitude,
            Double distanceKm,
            int minimumRoutePoints,
            RaceCourseMapService.PromptRaceType raceType
    ) {
        return assessAlignmentPlausibility(routePoints, latitude, longitude, distanceKm, minimumRoutePoints, raceType).plausible();
    }

    public RaceCourseMapService.AlignmentRatioWindow expectedDistanceRatioWindow(Double distanceKm, int routePointCount) {
        if (distanceKm != null && distanceKm >= 40.0) {
            if (routePointCount >= 18) {
                return new RaceCourseMapService.AlignmentRatioWindow(0.78, 1.22);
            }
            if (routePointCount >= 14) {
                return new RaceCourseMapService.AlignmentRatioWindow(0.65, 1.35);
            }
            return new RaceCourseMapService.AlignmentRatioWindow(0.55, 1.45);
        }
        if (routePointCount >= 16) {
            return new RaceCourseMapService.AlignmentRatioWindow(0.60, 1.40);
        }
        return new RaceCourseMapService.AlignmentRatioWindow(0.45, 1.70);
    }

    public double routeCentroidDistanceKm(List<RoutePoint> routePoints, double latitude, double longitude) {
        double centroidLat = routePoints.stream().mapToDouble(RoutePoint::lat).average().orElse(latitude);
        double centroidLng = routePoints.stream().mapToDouble(RoutePoint::lng).average().orElse(longitude);
        return haversineKm(latitude, longitude, centroidLat, centroidLng);
    }

    public double polylineDistanceKm(List<RoutePoint> routePoints) {
        double total = 0;
        for (int i = 1; i < routePoints.size(); i++) {
            total += haversineKm(routePoints.get(i - 1).lat(), routePoints.get(i - 1).lng(), routePoints.get(i).lat(), routePoints.get(i).lng());
        }
        return total;
    }

    public double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLng / 2), 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }

    public List<RoutePoint> sanitizeRoutePoints(List<RoutePoint> routePoints) {
        if (routePoints == null || routePoints.isEmpty()) return List.of();
        List<RoutePoint> sanitized = new ArrayList<>();
        RoutePoint previous = null;
        for (RoutePoint point : routePoints) {
            if (point == null) continue;
            if (previous != null && Math.abs(previous.lat() - point.lat()) < 1.0e-6 && Math.abs(previous.lng() - point.lng()) < 1.0e-6) continue;
            sanitized.add(point);
            previous = point;
        }
        return sanitized;
    }

    public List<RoutePoint> processRoutePoints(List<RoutePoint> routePoints, RaceCourseMapService.PromptRaceType raceType) {
        List<RoutePoint> sanitized = sanitizeRoutePoints(routePoints);
        if (sanitized.isEmpty()) {
            return sanitized;
        }
        List<RoutePoint> repaired = repairSelfIntersections(sanitized, raceType);
        if (raceType == RaceCourseMapService.PromptRaceType.OUT_AND_BACK) {
            return sanitizeRoutePoints(rebuildOutAndBackRoute(repaired));
        }
        return sanitizeRoutePoints(repaired);
    }

    public List<RoutePoint> repairSelfIntersections(List<RoutePoint> routePoints, RaceCourseMapService.PromptRaceType raceType) {
        if (routePoints == null || routePoints.size() < 4) {
            return routePoints == null ? List.of() : routePoints;
        }
        List<RoutePoint> repaired = new ArrayList<>(routePoints);
        int pass = 0;
        while (pass < SELF_INTERSECTION_REPAIR_LIMIT) {
            RaceCourseMapService.SegmentIntersection intersection = findFirstSelfIntersection(repaired);
            if (intersection == null) {
                break;
            }
            if (countSelfIntersections(repaired) <= allowedSelfIntersections(raceType)) {
                break;
            }
            repaired = collapseIntersection(repaired, intersection);
            pass += 1;
        }
        return List.copyOf(repaired);
    }

    private RaceCourseMapService.SegmentIntersection findFirstSelfIntersection(List<RoutePoint> routePoints) {
        for (int firstSegmentEnd = 1; firstSegmentEnd < routePoints.size(); firstSegmentEnd++) {
            for (int secondSegmentEnd = firstSegmentEnd + 2; secondSegmentEnd < routePoints.size(); secondSegmentEnd++) {
                if (firstSegmentEnd == 1 && secondSegmentEnd == routePoints.size() - 1) {
                    continue;
                }
                if (segmentsIntersectProperly(
                        routePoints.get(firstSegmentEnd - 1),
                        routePoints.get(firstSegmentEnd),
                        routePoints.get(secondSegmentEnd - 1),
                        routePoints.get(secondSegmentEnd)
                )) {
                    return new RaceCourseMapService.SegmentIntersection(firstSegmentEnd, secondSegmentEnd);
                }
            }
        }
        return null;
    }

    private List<RoutePoint> collapseIntersection(List<RoutePoint> routePoints, RaceCourseMapService.SegmentIntersection intersection) {
        int keepPrefix = intersection.firstSegmentEndIndex();
        int resumeIndex = intersection.secondSegmentEndIndex();
        if (keepPrefix <= 0 || resumeIndex >= routePoints.size() || keepPrefix >= resumeIndex) {
            return routePoints;
        }
        List<RoutePoint> collapsed = new ArrayList<>(routePoints.size());
        collapsed.addAll(routePoints.subList(0, keepPrefix));
        RoutePoint start = routePoints.get(keepPrefix - 1);
        RoutePoint end = routePoints.get(resumeIndex);
        collapsed.addAll(interpolateBridge(start, end));
        collapsed.addAll(routePoints.subList(resumeIndex, routePoints.size()));
        return sanitizeRoutePoints(collapsed);
    }

    private List<RoutePoint> interpolateBridge(RoutePoint start, RoutePoint end) {
        double segmentKm = haversineKm(start.lat(), start.lng(), end.lat(), end.lng());
        int bridgePointCount = segmentKm >= 2.0 ? 2 : (segmentKm >= 0.75 ? 1 : 0);
        if (bridgePointCount == 0) {
            return List.of();
        }
        List<RoutePoint> bridge = new ArrayList<>(bridgePointCount);
        for (int step = 1; step <= bridgePointCount; step++) {
            double ratio = step / (double) (bridgePointCount + 1);
            bridge.add(new RoutePoint(
                    start.lat() + ((end.lat() - start.lat()) * ratio),
                    start.lng() + ((end.lng() - start.lng()) * ratio),
                    null
            ));
        }
        return bridge;
    }

    public int countSelfIntersections(List<RoutePoint> routePoints) {
        if (routePoints == null || routePoints.size() < 4) {
            return 0;
        }
        int intersections = 0;
        for (int firstSegmentEnd = 1; firstSegmentEnd < routePoints.size(); firstSegmentEnd++) {
            for (int secondSegmentEnd = firstSegmentEnd + 2; secondSegmentEnd < routePoints.size(); secondSegmentEnd++) {
                if (firstSegmentEnd == 1 && secondSegmentEnd == routePoints.size() - 1) {
                    continue;
                }
                if (segmentsIntersectProperly(
                        routePoints.get(firstSegmentEnd - 1),
                        routePoints.get(firstSegmentEnd),
                        routePoints.get(secondSegmentEnd - 1),
                        routePoints.get(secondSegmentEnd)
                )) {
                    intersections += 1;
                }
            }
        }
        return intersections;
    }

    public boolean segmentsIntersectProperly(RoutePoint firstStart, RoutePoint firstEnd, RoutePoint secondStart, RoutePoint secondEnd) {
        double firstOrientationA = segmentCrossProduct(firstStart, firstEnd, secondStart);
        double firstOrientationB = segmentCrossProduct(firstStart, firstEnd, secondEnd);
        double secondOrientationA = segmentCrossProduct(secondStart, secondEnd, firstStart);
        double secondOrientationB = segmentCrossProduct(secondStart, secondEnd, firstEnd);
        double epsilon = 1.0e-9;
        if (Math.abs(firstOrientationA) <= epsilon
                || Math.abs(firstOrientationB) <= epsilon
                || Math.abs(secondOrientationA) <= epsilon
                || Math.abs(secondOrientationB) <= epsilon) {
            return false;
        }
        return Math.signum(firstOrientationA) != Math.signum(firstOrientationB)
                && Math.signum(secondOrientationA) != Math.signum(secondOrientationB);
    }

    private double segmentCrossProduct(RoutePoint start, RoutePoint end, RoutePoint point) {
        return ((end.lng() - start.lng()) * (point.lat() - start.lat()))
                - ((end.lat() - start.lat()) * (point.lng() - start.lng()));
    }

    public List<RoutePoint> rebuildOutAndBackRoute(List<RoutePoint> outboundRoute) {
        if (outboundRoute == null || outboundRoute.size() < 2) {
            return outboundRoute == null ? List.of() : outboundRoute;
        }
        List<RoutePoint> fullRoute = new ArrayList<>(outboundRoute.size() * 2 - 1);
        for (int index = 0; index < outboundRoute.size(); index++) {
            RoutePoint point = outboundRoute.get(index);
            String label = index == outboundRoute.size() - 1
                    ? (point.label() == null ? "Turnaround" : point.label())
                    : point.label();
            fullRoute.add(new RoutePoint(point.lat(), point.lng(), label));
        }
        for (int index = outboundRoute.size() - 2; index >= 0; index--) {
            RoutePoint point = outboundRoute.get(index);
            String label = index == 0 ? "Finish" : null;
            fullRoute.add(new RoutePoint(point.lat(), point.lng(), label));
        }
        return List.copyOf(fullRoute);
    }

    public RaceCourseMapService.RouteGeometryDiagnosis diagnoseRouteGeometry(List<RoutePoint> routePoints, RaceCourseMapService.PromptRaceType raceType, Double distanceKm) {
        int selfIntersections = countSelfIntersections(routePoints);
        int allowedSelfIntersections = allowedSelfIntersections(raceType);
        int startDistanceBacktracks = countStartDistanceBacktracks(routePoints, raceType, distanceKm);
        double routeDistanceKm = routePoints == null ? 0.0 : polylineDistanceKm(routePoints);
        String feedbackPrompt = null;
        if (isCollapsedRouteDistance(routeDistanceKm, distanceKm)) {
            feedbackPrompt = "The route you returned is collapsed into one small city-center cluster and covers only %.1f km. Correct it by tracing distinct checkpoints across the full visible course, or return routePoints=[] if the image cannot support that."
                    .formatted(routeDistanceKm);
        } else if (selfIntersections > allowedSelfIntersections) {
            feedbackPrompt = "The route you returned crosses itself %d times which is impossible for this race type. Correct it."
                    .formatted(selfIntersections);
        } else if (startDistanceBacktracks >= 2 && raceType == RaceCourseMapService.PromptRaceType.POINT_TO_POINT) {
            feedbackPrompt = "The route you returned doubles back toward the start %d times, which suggests it switched between nearby parallel lines. Correct it so the course keeps progressing from start to finish."
                    .formatted(startDistanceBacktracks);
        }
        return new RaceCourseMapService.RouteGeometryDiagnosis(
                selfIntersections,
                allowedSelfIntersections,
                startDistanceBacktracks,
                feedbackPrompt
        );
    }

    private boolean isCollapsedRouteDistance(double routeDistanceKm, Double distanceKm) {
        if (distanceKm == null || distanceKm <= 0) return false;
        return routeDistanceKm < Math.max(1.0, distanceKm * 0.08);
    }

    public int allowedSelfIntersections(RaceCourseMapService.PromptRaceType raceType) {
        return switch (raceType) {
            case LOOP -> 3;
            case OUT_AND_BACK -> 1;
            case POINT_TO_POINT -> 1;
        };
    }

    public int countStartDistanceBacktracks(List<RoutePoint> routePoints, RaceCourseMapService.PromptRaceType raceType, Double distanceKm) {
        if (raceType != RaceCourseMapService.PromptRaceType.POINT_TO_POINT || routePoints == null || routePoints.size() < 3) {
            return 0;
        }
        RoutePoint start = routePoints.get(0);
        double furthestDistanceFromStart = 0.0;
        int backtracks = 0;
        for (int index = 1; index < routePoints.size(); index++) {
            RoutePoint point = routePoints.get(index);
            double distanceFromStart = haversineKm(start.lat(), start.lng(), point.lat(), point.lng());
            double toleranceKm = Math.max(
                    Math.max(1.25, (distanceKm == null ? 0.0 : distanceKm * 0.05)),
                    furthestDistanceFromStart * 0.18
            );
            if (distanceFromStart + toleranceKm < furthestDistanceFromStart) {
                backtracks += 1;
            }
            furthestDistanceFromStart = Math.max(furthestDistanceFromStart, distanceFromStart);
        }
        return backtracks;
    }

    private double largestSegmentRatio(List<RoutePoint> routePoints, double routeDistanceKm) {
        if (routePoints == null || routePoints.size() < 2 || routeDistanceKm <= 0) {
            return 1.0;
        }
        double largestSegmentKm = 0.0;
        for (int i = 1; i < routePoints.size(); i++) {
            largestSegmentKm = Math.max(largestSegmentKm, haversineKm(
                    routePoints.get(i - 1).lat(),
                    routePoints.get(i - 1).lng(),
                    routePoints.get(i).lat(),
                    routePoints.get(i).lng()
            ));
        }
        return largestSegmentKm / routeDistanceKm;
    }

    private double maxLargestSegmentRatio(int routePointCount, int minimumRoutePoints) {
        if (minimumRoutePoints < MIN_ALIGNMENT_ROUTE_POINTS) {
            if (routePointCount <= 5) {
                return 0.40;
            }
            if (routePointCount <= 7) {
                return 0.35;
            }
        }
        return 0.30;
    }

    public OverlayBounds boundsFromRoute(List<RoutePoint> routePoints) {
        double minLat = Double.POSITIVE_INFINITY;
        double maxLat = Double.NEGATIVE_INFINITY;
        double minLng = Double.POSITIVE_INFINITY;
        double maxLng = Double.NEGATIVE_INFINITY;
        for (RoutePoint point : routePoints) {
            minLat = Math.min(minLat, point.lat());
            maxLat = Math.max(maxLat, point.lat());
            minLng = Math.min(minLng, point.lng());
            maxLng = Math.max(maxLng, point.lng());
        }
        double latPad = Math.max(0.01, (maxLat - minLat) * 0.2);
        double lngPad = Math.max(0.01, (maxLng - minLng) * 0.2);
        return new OverlayBounds(maxLat + latPad, minLat - latPad, maxLng + lngPad, minLng - lngPad);
    }

    public List<RoutePoint> resampleRoute(List<RoutePoint> routePoints, int targetCount) {
        if (routePoints.size() <= 1 || targetCount <= 1) return routePoints;
        List<Double> cumulative = cumulativeRouteDistances(routePoints);
        double total = cumulative.get(cumulative.size() - 1);
        if (total <= 0.001) return routePoints;

        List<RoutePoint> resampled = new ArrayList<>();
        for (int i = 0; i < targetCount; i++) {
            double targetDistance = total * i / Math.max(targetCount - 1, 1);
            resampled.add(interpolateRoutePoint(routePoints, cumulative, targetDistance));
        }
        return resampled;
    }

    public List<Double> cumulativeRouteDistances(List<RoutePoint> routePoints) {
        List<Double> cumulative = new ArrayList<>();
        cumulative.add(0.0);
        for (int i = 1; i < routePoints.size(); i++) {
            double segment = haversineKm(
                    routePoints.get(i - 1).lat(),
                    routePoints.get(i - 1).lng(),
                    routePoints.get(i).lat(),
                    routePoints.get(i).lng()
            );
            cumulative.add(cumulative.get(i - 1) + Math.max(segment, 0.001));
        }
        return cumulative;
    }

    public RoutePoint interpolateRoutePoint(List<RoutePoint> routePoints, List<Double> cumulative, double targetDistance) {
        for (int i = 1; i < cumulative.size(); i++) {
            double end = cumulative.get(i);
            if (targetDistance > end) continue;
            double start = cumulative.get(i - 1);
            double span = Math.max(0.001, end - start);
            double ratio = Math.max(0.0, Math.min(1.0, (targetDistance - start) / span));
            RoutePoint left = routePoints.get(i - 1);
            RoutePoint right = routePoints.get(i);
            double lat = left.lat() + (right.lat() - left.lat()) * ratio;
            double lng = left.lng() + (right.lng() - left.lng()) * ratio;
            return new RoutePoint(lat, lng, null);
        }
        return routePoints.get(routePoints.size() - 1);
    }

    public static AlignmentPlausibilityVerdict invalid(String reason) {
        return new AlignmentPlausibilityVerdict(false, reason);
    }

    public static AlignmentPlausibilityVerdict valid(String reason) {
        return new AlignmentPlausibilityVerdict(true, reason);
    }

    public record AlignmentPlausibilityVerdict(boolean plausible, String reason) {}
}
