package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
import java.util.ArrayList;
import java.util.List;

final class KualaLumpurMarathonKnownCourse {
    static final String SOURCE_NOTE = "Kuala Lumpur Marathon official 2025 full marathon route map PDF";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 8;

    private static final double TARGET_DISTANCE_KM = 42.195;
    private static final double START_LAT = 3.15551;
    private static final double START_LNG = 101.69440;
    private static final double FINISH_LAT = 3.13927;
    private static final double FINISH_LNG = 101.70077;

    private static final double LAT_X = -1.44290256e-06;
    private static final double LAT_Y = -4.72057319e-05;
    private static final double LAT_OFFSET = 3.20492047;
    private static final double LNG_X = 6.01184887e-05;
    private static final double LNG_Y = -7.72926558e-07;
    private static final double LNG_OFFSET = 101.659726;

    private static final double[][] OFFICIAL_MARKER_PIXELS = {
            {596, 818}, {600, 858}, {626, 925}, {686, 985}, {813, 1090}, {833, 1234},
            {850, 1278}, {878, 1188}, {858, 1110}, {856, 994}, {980, 950}, {1128, 949},
            {1308, 923}, {1190, 878}, {1040, 858}, {905, 900}, {765, 975}, {842, 930},
            {965, 830}, {1040, 880}, {1288, 876}, {1448, 875}, {1624, 900}, {1668, 778},
            {1705, 612}, {1530, 548}, {1380, 528}, {1240, 500}, {1075, 558}, {930, 500},
            {755, 490}, {615, 395}, {465, 386}, {285, 375}, {115, 365}, {118, 478},
            {198, 615}, {323, 670}, {444, 808}, {533, 952}, {535, 1095}, {535, 1235},
            {696, 1355}, {704, 1338}
    };

    private KualaLumpurMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> markerRoute = calibratedMarkerRoute();
        List<RoutePoint> interpolated = interpolateRoute(markerRoute, 0.08);
        return List.copyOf(interpolated);
    }

    private static List<RoutePoint> calibratedMarkerRoute() {
        List<RoutePoint> base = new ArrayList<>(OFFICIAL_MARKER_PIXELS.length);
        for (double[] pixel : OFFICIAL_MARKER_PIXELS) {
            base.add(projectPixel(pixel[0], pixel[1]));
        }

        double[] cumulativePixels = cumulativePixelDistances();
        double totalPixels = cumulativePixels[cumulativePixels.length - 1];
        RoutePoint baseStart = base.get(0);
        RoutePoint baseFinish = base.get(base.size() - 1);
        List<RoutePoint> endpointWarped = new ArrayList<>(base.size());
        for (int index = 0; index < base.size(); index++) {
            double fraction = totalPixels <= 0 ? 0 : cumulativePixels[index] / totalPixels;
            RoutePoint point = base.get(index);
            double latCorrection = ((1 - fraction) * (START_LAT - baseStart.lat())) + (fraction * (FINISH_LAT - baseFinish.lat()));
            double lngCorrection = ((1 - fraction) * (START_LNG - baseStart.lng())) + (fraction * (FINISH_LNG - baseFinish.lng()));
            endpointWarped.add(new RoutePoint(point.lat() + latCorrection, point.lng() + lngCorrection, null));
        }

        double low = 1.0;
        double high = 2.0;
        for (int pass = 0; pass < 48; pass++) {
            double mid = (low + high) / 2.0;
            double distance = polylineDistanceKm(scaleDeviationFromStartFinish(endpointWarped, mid));
            if (distance < TARGET_DISTANCE_KM) {
                low = mid;
            } else {
                high = mid;
            }
        }
        return scaleDeviationFromStartFinish(endpointWarped, (low + high) / 2.0);
    }

    private static RoutePoint projectPixel(double x, double y) {
        return new RoutePoint(
                (LAT_X * x) + (LAT_Y * y) + LAT_OFFSET,
                (LNG_X * x) + (LNG_Y * y) + LNG_OFFSET,
                null
        );
    }

    private static double[] cumulativePixelDistances() {
        double[] cumulative = new double[OFFICIAL_MARKER_PIXELS.length];
        for (int index = 1; index < OFFICIAL_MARKER_PIXELS.length; index++) {
            double[] previous = OFFICIAL_MARKER_PIXELS[index - 1];
            double[] current = OFFICIAL_MARKER_PIXELS[index];
            cumulative[index] = cumulative[index - 1] + Math.hypot(current[0] - previous[0], current[1] - previous[1]);
        }
        return cumulative;
    }

    private static List<RoutePoint> scaleDeviationFromStartFinish(List<RoutePoint> routePoints, double factor) {
        List<RoutePoint> scaled = new ArrayList<>(routePoints.size());
        int last = routePoints.size() - 1;
        for (int index = 0; index < routePoints.size(); index++) {
            double fraction = index / (double) last;
            double lineLat = (START_LAT * (1 - fraction)) + (FINISH_LAT * fraction);
            double lineLng = (START_LNG * (1 - fraction)) + (FINISH_LNG * fraction);
            RoutePoint point = routePoints.get(index);
            scaled.add(new RoutePoint(
                    lineLat + ((point.lat() - lineLat) * factor),
                    lineLng + ((point.lng() - lineLng) * factor),
                    null
            ));
        }
        return scaled;
    }

    private static List<RoutePoint> interpolateRoute(List<RoutePoint> markerRoute, double maxSegmentKm) {
        List<RoutePoint> interpolated = new ArrayList<>();
        for (int index = 0; index < markerRoute.size() - 1; index++) {
            RoutePoint start = markerRoute.get(index);
            RoutePoint end = markerRoute.get(index + 1);
            if (index == 0) {
                interpolated.add(roundPoint(start));
            }
            int steps = Math.max(1, (int) Math.ceil(haversineKm(start, end) / maxSegmentKm));
            for (int step = 1; step <= steps; step++) {
                double fraction = step / (double) steps;
                interpolated.add(roundPoint(new RoutePoint(
                        start.lat() + ((end.lat() - start.lat()) * fraction),
                        start.lng() + ((end.lng() - start.lng()) * fraction),
                        null
                )));
            }
        }
        return interpolated;
    }

    private static RoutePoint roundPoint(RoutePoint point) {
        return new RoutePoint(
                Math.round(point.lat() * 100000.0) / 100000.0,
                Math.round(point.lng() * 100000.0) / 100000.0,
                null
        );
    }

    private static double polylineDistanceKm(List<RoutePoint> routePoints) {
        double total = 0.0;
        for (int index = 1; index < routePoints.size(); index++) {
            total += haversineKm(routePoints.get(index - 1), routePoints.get(index));
        }
        return total;
    }

    private static double haversineKm(RoutePoint start, RoutePoint end) {
        double dLat = Math.toRadians(end.lat() - start.lat());
        double dLng = Math.toRadians(end.lng() - start.lng());
        double a = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(start.lat())) * Math.cos(Math.toRadians(end.lat())) * Math.pow(Math.sin(dLng / 2), 2);
        return 6371.0 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
