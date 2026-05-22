package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

final class ActivityAnalyticsHelper {

    static final int ROUTE_PREVIEW_POINT_LIMIT = 40;

    private ActivityAnalyticsHelper() {}

    static Double resolveElevationForAnalytics(Object[] row) {
        Double legacy = row.length > 4 && row[4] != null ? ((Number) row[4]).doubleValue() : null;
        Double raw = row.length > 7 && row[7] != null ? ((Number) row[7]).doubleValue() : null;
        Double corrected = row.length > 8 && row[8] != null ? ((Number) row[8]).doubleValue() : null;
        if (corrected != null) return corrected;
        if (raw != null) return raw;
        return legacy;
    }

    static void normalizeSamples(List<SamplePoint> pts, Activity activity) {
        if (pts.isEmpty()) return;
        double cum = 0;
        for (int i = 0; i < pts.size(); i++) {
            SamplePoint p = pts.get(i);
            if (p.distanceMeters() != null && p.distanceMeters() >= 0) {
                cum = Math.max(cum, p.distanceMeters());
                continue;
            }
            if (i > 0) {
                SamplePoint prev = pts.get(i - 1);
                cum += haversineMeters(prev.latitude(), prev.longitude(), p.latitude(), p.longitude());
            }
            pts.set(i, p.withDistanceMeters(cum));
        }

        Integer maxKnownSec = null;
        for (SamplePoint p : pts) {
            if (p.elapsedSeconds() != null) maxKnownSec = p.elapsedSeconds();
        }
        int totalSec = maxKnownSec != null && maxKnownSec > 0
                ? maxKnownSec
                : (activity.getMovingTimeSeconds() > 0 ? activity.getMovingTimeSeconds()
                : (activity.getDurationSeconds() != null ? activity.getDurationSeconds().intValue() : 0));
        double totalDist = pts.get(pts.size() - 1).distanceMeters() == null ? 0 : pts.get(pts.size() - 1).distanceMeters();
        if (totalSec > 0 && totalDist > 0) {
            for (int i = 0; i < pts.size(); i++) {
                SamplePoint p = pts.get(i);
                if (p.elapsedSeconds() != null) continue;
                int sec = (int) Math.round((p.distanceMeters() / totalDist) * totalSec);
                pts.set(i, p.withElapsedSeconds(sec));
            }
        }
    }

    static List<LapBreakdown> buildLapBreakdown(List<SamplePoint> pts) {
        List<LapBreakdown> out = new ArrayList<>();
        if (pts.isEmpty()) return out;
        double total = pts.get(pts.size() - 1).distanceMeters() == null ? 0 : pts.get(pts.size() - 1).distanceMeters();
        if (total <= 0) return out;
        int laps = (int) Math.floor(total / 1000.0);
        for (int lap = 1; lap <= laps; lap++) {
            double startM = (lap - 1) * 1000.0;
            double endM = lap * 1000.0;
            Double startSec = interpolateSecondsAtDistance(pts, startM);
            Double endSec = interpolateSecondsAtDistance(pts, endM);
            if (startSec == null || endSec == null || endSec <= startSec) continue;
            out.add(new LapBreakdown(
                    lap,
                    1.0,
                    (int) Math.round(endSec - startSec),
                    formatPace(endSec - startSec),
                    averageHrBetweenDistance(pts, startM, endM),
                    averageCadenceBetweenDistance(pts, startM, endM)
            ));
        }
        return out;
    }

    static List<ElevationSample> buildElevationProfile(List<SamplePoint> pts) {
        List<ElevationSample> out = new ArrayList<>();
        if (pts.isEmpty()) return out;
        int target = 240;
        int stride = pts.size() > target ? (int) Math.ceil(pts.size() / (double) target) : 1;
        for (int i = 0; i < pts.size(); i += stride) {
            SamplePoint p = pts.get(i);
            if (p.distanceMeters() == null || p.elevationMeters() == null) continue;
            out.add(new ElevationSample(p.distanceMeters() / 1000.0, p.elevationMeters()));
        }
        return out;
    }

    static Double averageCadence(List<SamplePoint> pts, Activity activity) {
        int s = 0;
        int n = 0;
        for (SamplePoint p : pts) {
            if (p.cadence() != null && p.cadence() > 0) {
                s += p.cadence();
                n++;
            }
        }
        return n > 0 ? s / (double) n : activity.getAverageCadence();
    }

    static Double averageStrideMeters(List<SamplePoint> pts) {
        double s = 0;
        int n = 0;
        for (int i = 1; i < pts.size(); i++) {
            SamplePoint a = pts.get(i - 1);
            SamplePoint b = pts.get(i);
            if (a.distanceMeters() == null || b.distanceMeters() == null
                    || a.elapsedSeconds() == null || b.elapsedSeconds() == null
                    || b.cadence() == null || b.cadence() <= 0) continue;
            double dd = b.distanceMeters() - a.distanceMeters();
            double dt = b.elapsedSeconds() - a.elapsedSeconds();
            if (dd <= 0 || dt <= 0) continue;
            double speed = dd / dt;
            double stride = speed / (b.cadence() / 60.0);
            if (Double.isFinite(stride) && stride > 0 && stride < 3.5) {
                s += stride;
                n++;
            }
        }
        return n > 0 ? s / n : null;
    }

    static CardiacDrift computeCardiacDrift(List<SamplePoint> pts) {
        if (pts.size() < 10) return null;
        double totalDist = pts.get(pts.size() - 1).distanceMeters() == null ? 0 : pts.get(pts.size() - 1).distanceMeters();
        if (totalDist <= 0) return null;
        double mid = totalDist / 2.0;
        Metrics first = paceHrMetrics(pts, 0, mid);
        Metrics second = paceHrMetrics(pts, mid, totalDist);
        if (first == null || second == null || first.avgHr <= 0 || second.avgHr <= 0) return null;
        double eff1 = (1000.0 / first.paceSecPerKm) / first.avgHr;
        double eff2 = (1000.0 / second.paceSecPerKm) / second.avgHr;
        if (eff1 <= 0 || eff2 <= 0) return null;
        double driftPct = ((eff1 - eff2) / eff1) * 100.0;
        return new CardiacDrift(
                round2(driftPct),
                round2(first.avgHr),
                round2(second.avgHr),
                formatPace(first.paceSecPerKm),
                formatPace(second.paceSecPerKm)
        );
    }

    private static Metrics paceHrMetrics(List<SamplePoint> pts, double fromDist, double toDist) {
        Double s0 = interpolateSecondsAtDistance(pts, fromDist);
        Double s1 = interpolateSecondsAtDistance(pts, toDist);
        if (s0 == null || s1 == null || s1 <= s0 || toDist <= fromDist) return null;
        int hrSum = 0;
        int hrCount = 0;
        for (SamplePoint p : pts) {
            if (p.distanceMeters() == null || p.heartRate() == null || p.heartRate() <= 0) continue;
            if (p.distanceMeters() >= fromDist && p.distanceMeters() <= toDist) {
                hrSum += p.heartRate();
                hrCount++;
            }
        }
        if (hrCount == 0) return null;
        double paceSecPerKm = ((s1 - s0) / (toDist - fromDist)) * 1000.0;
        return new Metrics(hrSum / (double) hrCount, paceSecPerKm);
    }

    static Double interpolateSecondsAtDistance(List<SamplePoint> pts, double targetDistM) {
        if (pts.isEmpty()) return null;
        for (int i = 1; i < pts.size(); i++) {
            SamplePoint a = pts.get(i - 1);
            SamplePoint b = pts.get(i);
            if (a.distanceMeters() == null || b.distanceMeters() == null
                    || a.elapsedSeconds() == null || b.elapsedSeconds() == null) continue;
            if (targetDistM > b.distanceMeters()) continue;
            double span = b.distanceMeters() - a.distanceMeters();
            if (span <= 0) return b.elapsedSeconds().doubleValue();
            double r = (targetDistM - a.distanceMeters()) / span;
            return a.elapsedSeconds() + r * (b.elapsedSeconds() - a.elapsedSeconds());
        }
        SamplePoint last = pts.get(pts.size() - 1);
        return last.elapsedSeconds() == null ? null : last.elapsedSeconds().doubleValue();
    }

    private static Integer averageHrBetweenDistance(List<SamplePoint> pts, double startM, double endM) {
        int s = 0, n = 0;
        for (SamplePoint p : pts) {
            if (p.distanceMeters() == null || p.heartRate() == null || p.heartRate() <= 0) continue;
            if (p.distanceMeters() >= startM && p.distanceMeters() <= endM) {
                s += p.heartRate();
                n++;
            }
        }
        return n > 0 ? Math.round(s / (float) n) : null;
    }

    private static Integer averageCadenceBetweenDistance(List<SamplePoint> pts, double startM, double endM) {
        int s = 0, n = 0;
        for (SamplePoint p : pts) {
            if (p.distanceMeters() == null || p.cadence() == null || p.cadence() <= 0) continue;
            if (p.distanceMeters() >= startM && p.distanceMeters() <= endM) {
                s += p.cadence();
                n++;
            }
        }
        return n > 0 ? Math.round(s / (float) n) : null;
    }

    static Double minElevation(List<SamplePoint> pts) {
        Double min = null;
        for (SamplePoint p : pts) {
            if (p.elevationMeters() == null) continue;
            min = min == null ? p.elevationMeters() : Math.min(min, p.elevationMeters());
        }
        return min;
    }

    static Double maxElevation(List<SamplePoint> pts) {
        Double max = null;
        for (SamplePoint p : pts) {
            if (p.elevationMeters() == null) continue;
            max = max == null ? p.elevationMeters() : Math.max(max, p.elevationMeters());
        }
        return max;
    }

    static String formatPace(double secPerKm) {
        if (!Double.isFinite(secPerKm) || secPerKm <= 0) return null;
        int totalSec = (int) Math.round(secPerKm);
        int min = totalSec / 60;
        int sec = totalSec % 60;
        return String.format(Locale.ROOT, "%d:%02d /km", min, sec);
    }

    static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    static double haversineMeters(double lat1, double lon1, double lat2, double lon2) {
        final double r = 6_371_000d;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // --- Shareable records ---

    record SamplePoint(
            double latitude,
            double longitude,
            Integer elapsedSeconds,
            Double distanceMeters,
            Double elevationMeters,
            Integer heartRate,
            Integer cadence
    ) {
        SamplePoint withElapsedSeconds(Integer elapsedSeconds) {
            return new SamplePoint(latitude, longitude, elapsedSeconds, distanceMeters, elevationMeters, heartRate, cadence);
        }
        SamplePoint withDistanceMeters(Double distanceMeters) {
            return new SamplePoint(latitude, longitude, elapsedSeconds, distanceMeters, elevationMeters, heartRate, cadence);
        }
    }

    record Metrics(double avgHr, double paceSecPerKm) {}
    record LapBreakdown(int lapIndex, double distanceKm, int durationSeconds, String pace, Integer averageHeartRate, Integer averageCadence) {}
    record ElevationSample(double distanceKm, double elevationMeters) {}
    record CardiacDrift(double driftPercent, double firstHalfAverageHeartRate, double secondHalfAverageHeartRate, String firstHalfPace, String secondHalfPace) {}
    record PostRunDebrief(String interpretation, Integer readinessScore, String nextDayGuidance) {}
    record PostRunAnalytics(List<LapBreakdown> laps, List<ElevationSample> elevationProfile, Double averageCadence, Double averageStrideLengthMeters, CardiacDrift cardiacDrift, Double minElevationMeters, Double maxElevationMeters, PostRunDebrief debrief) {}
}
