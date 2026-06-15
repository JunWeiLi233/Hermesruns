package com.hermes.backend;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

final class ActivityRoutePreviewHelper {
    private static final int ROUTE_PREVIEW_POINT_LIMIT = ActivityAnalyticsHelper.ROUTE_PREVIEW_POINT_LIMIT;
    private static final int MAX_ROUTE_PREVIEW_PATH_LENGTH = 255;

    private ActivityRoutePreviewHelper() {
    }

    static void hydrateMissingRoutePreviews(List<Activity> runs, ActivityDataAccess activityDataAccess) {
        if (runs == null || runs.isEmpty()) {
            return;
        }

        List<Long> missingIds = runs.stream()
                .filter(activity -> activity != null && activity.getId() != null && !hasRoutePreview(activity))
                .map(Activity::getId)
                .toList();
        if (missingIds.isEmpty()) {
            return;
        }

        Map<Long, List<PreviewSample>> samplesByActivityId = new LinkedHashMap<>();
        for (Object[] row : activityDataAccess.findRoutePreviewSamplesByActivityIds(missingIds, ROUTE_PREVIEW_POINT_LIMIT)) {
            if (row == null || row.length < 4 || !(row[0] instanceof Number activityIdNumber)) {
                continue;
            }
            double latitude = row[1] instanceof Number number ? number.doubleValue() : Double.NaN;
            double longitude = row[2] instanceof Number number ? number.doubleValue() : Double.NaN;
            int sequenceIndex = row[3] instanceof Number number ? number.intValue() : 0;
            if (!Double.isFinite(latitude) || !Double.isFinite(longitude)) {
                continue;
            }
            long activityId = activityIdNumber.longValue();
            samplesByActivityId.computeIfAbsent(activityId, ignored -> new ArrayList<>())
                    .add(new PreviewSample(latitude, longitude, sequenceIndex));
        }

        List<Activity> dirtyActivities = new ArrayList<>();
        for (Activity activity : runs) {
            if (activity == null || activity.getId() == null || hasRoutePreview(activity)) {
                continue;
            }
            RoutePreview routePreview = buildRoutePreview(samplesByActivityId.get(activity.getId()));
            if (routePreview == null) {
                continue;
            }
            applyRoutePreview(activity, routePreview);
            dirtyActivities.add(activity);
        }

        if (!dirtyActivities.isEmpty()) {
            activityDataAccess.saveAll(dirtyActivities);
        }
    }

    static Map<String, Object> toRunFeedItem(Activity activity) {
        Map<String, Object> body = new LinkedHashMap<>();
        ActivityWeatherCorrection.Value correction = ActivityWeatherCorrection.from(activity);
        body.put("id", activity.getId());
        body.put("name", activity.getName());
        body.put("stravaId", activity.getStravaId());
        body.put("distanceKm", activity.getDistanceKm());
        body.put("movingTimeSeconds", activity.getMovingTimeSeconds());
        body.put("startDate", activity.getStartDate());
        body.put("provider", activity.getProvider() == null ? null : activity.getProvider().name());
        body.put("activityType", activity.getActivityType() == null ? null : activity.getActivityType().name());
        body.put("startTime", activity.getStartTime());
        body.put("distanceMeters", activity.getDistanceMeters());
        body.put("durationSeconds", activity.getDurationSeconds());
        body.put("sourceFileName", activity.getSourceFileName());
        body.put("createdAt", activity.getCreatedAt());
        body.put("averageHeartRate", activity.getAverageHeartRate());
        body.put("maxHeartRate", activity.getMaxHeartRate());
        body.put("totalElevationGain", activity.getTotalElevationGain());
        body.put("calories", activity.getCalories());
        body.put("averageCadence", activity.getAverageCadence());
        body.put("averageWatts", activity.getAverageWatts());
        body.put("maxSpeedMps", activity.getMaxSpeedMps());
        body.put("sufferScore", activity.getSufferScore());
        body.put("pacePenaltySecPerKm", correction.pacePenaltySecPerKm());
        body.put("weatherAdjusted", correction.weatherAdjusted());
        body.put("weatherAdjustedMovingTimeSeconds", correction.weatherAdjustedMovingTimeSeconds());
        body.put("weatherAdjustedPaceSecPerKm", correction.weatherAdjustedPaceSecPerKm());
        body.put("weatherCorrectionFactor", correction.weatherCorrectionFactor());
        body.put("shoeId", activity.getShoeId());
        body.put("shoeName", activity.getShoeName());
        body.put("routePreview", hasRoutePreview(activity)
                ? Map.of(
                        "path", activity.getRoutePreviewPath(),
                        "startX", activity.getRoutePreviewStartX(),
                        "startY", activity.getRoutePreviewStartY(),
                        "finishX", activity.getRoutePreviewFinishX(),
                        "finishY", activity.getRoutePreviewFinishY()
                )
                : null);
        return body;
    }

    static List<LatLngPoint> fetchLatLngPoints(Long activityId, ActivityDataAccess activityDataAccess) {
        List<Object[]> coords = activityDataAccess.findLatLngByActivityId(activityId);
        if (coords == null || coords.isEmpty()) return List.of();

        List<LatLngPoint> out = new ArrayList<>(coords.size());
        for (Object[] row : coords) {
            if (row == null || row.length < 2) continue;
            Double lat = ((Number) row[0]).doubleValue();
            Double lng = ((Number) row[1]).doubleValue();
            if (lat == null || lng == null) continue;
            out.add(new LatLngPoint(lat, lng));
        }
        return out;
    }

    static void cacheRoutePreviewIfMissing(Activity activity, List<LatLngPoint> points, ActivityDataAccess activityDataAccess) {
        if (activity == null || hasRoutePreview(activity) || points == null || points.size() < 2) {
            return;
        }
        List<PreviewSample> samples = new ArrayList<>(points.size());
        for (int index = 0; index < points.size(); index++) {
            LatLngPoint point = points.get(index);
            samples.add(new PreviewSample(point.latitude(), point.longitude(), index));
        }
        RoutePreview routePreview = buildRoutePreview(samples);
        if (routePreview == null) {
            return;
        }
        applyRoutePreview(activity, routePreview);
        activityDataAccess.save(activity);
    }

    private static boolean hasRoutePreview(Activity activity) {
        return activity != null
                && activity.getRoutePreviewPath() != null
                && !activity.getRoutePreviewPath().isBlank()
                && activity.getRoutePreviewStartX() != null
                && activity.getRoutePreviewStartY() != null
                && activity.getRoutePreviewFinishX() != null
                && activity.getRoutePreviewFinishY() != null;
    }

    private static void applyRoutePreview(Activity activity, RoutePreview routePreview) {
        activity.setRoutePreviewPath(routePreview.path());
        activity.setRoutePreviewStartX(routePreview.startX());
        activity.setRoutePreviewStartY(routePreview.startY());
        activity.setRoutePreviewFinishX(routePreview.finishX());
        activity.setRoutePreviewFinishY(routePreview.finishY());
    }

    private static RoutePreview buildRoutePreview(List<PreviewSample> samples) {
        if (samples == null || samples.size() < 2) {
            return null;
        }

        double minLatitude = Double.POSITIVE_INFINITY;
        double maxLatitude = Double.NEGATIVE_INFINITY;
        double minLongitude = Double.POSITIVE_INFINITY;
        double maxLongitude = Double.NEGATIVE_INFINITY;
        for (PreviewSample sample : samples) {
            minLatitude = Math.min(minLatitude, sample.latitude());
            maxLatitude = Math.max(maxLatitude, sample.latitude());
            minLongitude = Math.min(minLongitude, sample.longitude());
            maxLongitude = Math.max(maxLongitude, sample.longitude());
        }

        double latitudeSpan = Math.max(0.0001, maxLatitude - minLatitude);
        double longitudeSpan = Math.max(0.0001, maxLongitude - minLongitude);
        double padding = 12.0;
        double width = 100.0;
        double height = 100.0;
        double innerWidth = width - (padding * 2.0);
        double innerHeight = height - (padding * 2.0);
        int stride = Math.max(1, samples.size() / ROUTE_PREVIEW_POINT_LIMIT);
        while (stride < samples.size()) {
            List<PreviewPoint> normalized = buildNormalizedPreviewPoints(
                    samples,
                    stride,
                    minLatitude,
                    latitudeSpan,
                    minLongitude,
                    longitudeSpan,
                    padding,
                    innerWidth,
                    innerHeight
            );
            if (normalized.size() < 2) {
                return null;
            }

            String path = buildPreviewPath(normalized);
            if (path.length() <= MAX_ROUTE_PREVIEW_PATH_LENGTH || stride >= samples.size() - 1) {
                PreviewPoint start = normalized.get(0);
                PreviewPoint finish = normalized.get(normalized.size() - 1);
                return new RoutePreview(path, start.x(), start.y(), finish.x(), finish.y());
            }
            stride += 1;
        }
        return null;
    }

    private static List<PreviewPoint> buildNormalizedPreviewPoints(
            List<PreviewSample> samples,
            int stride,
            double minLatitude,
            double latitudeSpan,
            double minLongitude,
            double longitudeSpan,
            double padding,
            double innerWidth,
            double innerHeight
    ) {
        List<PreviewPoint> normalized = new ArrayList<>();
        for (int index = 0; index < samples.size(); index += stride) {
            normalized.add(normalizePreviewPoint(samples.get(index), minLatitude, latitudeSpan, minLongitude, longitudeSpan, padding, innerWidth, innerHeight));
        }
        PreviewPoint lastPoint = normalizePreviewPoint(samples.get(samples.size() - 1), minLatitude, latitudeSpan, minLongitude, longitudeSpan, padding, innerWidth, innerHeight);
        if (normalized.isEmpty() || !samePreviewPoint(normalized.get(normalized.size() - 1), lastPoint)) {
            normalized.add(lastPoint);
        }
        return normalized;
    }

    private static String buildPreviewPath(List<PreviewPoint> normalized) {
        StringBuilder path = new StringBuilder();
        for (int index = 0; index < normalized.size(); index++) {
            PreviewPoint point = normalized.get(index);
            if (index > 0) {
                path.append(' ');
            }
            path.append(index == 0 ? 'M' : 'L')
                    .append(' ')
                    .append(formatPreviewCoordinate(point.x()))
                    .append(' ')
                    .append(formatPreviewCoordinate(point.y()));
        }
        return path.toString();
    }

    private static PreviewPoint normalizePreviewPoint(
            PreviewSample sample,
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
        return new PreviewPoint(x, y);
    }

    private static boolean samePreviewPoint(PreviewPoint left, PreviewPoint right) {
        return Math.abs(left.x() - right.x()) < 0.001 && Math.abs(left.y() - right.y()) < 0.001;
    }

    private static String formatPreviewCoordinate(double value) {
        return String.format(Locale.ROOT, "%.2f", value);
    }

    public record LatLngPoint(double latitude, double longitude) {}
    public record GeoBbox(double minLat, double maxLat, double minLng, double maxLng) {}
    public record RoutePreviewBatchItem(Long activityId, List<LatLngPoint> points, GeoBbox bbox, long pointCount) {}
    private record PreviewSample(double latitude, double longitude, int sequenceIndex) {}
    private record PreviewPoint(double x, double y) {}
    private record RoutePreview(String path, double startX, double startY, double finishX, double finishY) {}
}
