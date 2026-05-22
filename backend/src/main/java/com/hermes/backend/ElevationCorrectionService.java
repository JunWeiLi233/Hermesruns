package com.hermes.backend;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class ElevationCorrectionService {
    private static final double DISCREPANCY_THRESHOLD = 0.25;
    private static final int DEM_CHUNK = 100;

    private final ActivityPointRepository activityPointRepository;
    private final RestTemplate restTemplate;

    public ElevationCorrectionService(ActivityPointRepository activityPointRepository, RestTemplate restTemplate) {
        this.activityPointRepository = activityPointRepository;
        this.restTemplate = restTemplate;
    }

    @Transactional(readOnly = true)
    public ElevationStatus computeStatus(Activity activity) {
        List<ActivityPoint> points = activityPointRepository.findByActivityOrderBySequenceIndexAsc(activity);
        if (points.size() < 2) {
            return new ElevationStatus(false, null, null, 0.0, false, false, "Insufficient points");
        }

        List<Double> rawProfile = new ArrayList<>(points.size());
        boolean hasCorrected = false;
        for (ActivityPoint p : points) {
            Double raw = p.getElevationRawMeters() != null ? p.getElevationRawMeters() : p.getElevationMeters();
            rawProfile.add(raw);
            if (p.getElevationCorrectedMeters() != null) hasCorrected = true;
        }

        Double rawAscent = totalAscent(rawProfile);
        Double demAscent = demAscentFromStartEnd(points);
        double variance = variance(rawAscent, demAscent);
        boolean flagged = variance > DISCREPANCY_THRESHOLD;

        return new ElevationStatus(
                flagged,
                rawAscent,
                demAscent,
                variance,
                hasCorrected,
                hasCorrected,
                flagged ? "Suspicious elevation data detected. Barometric drift likely." : "Elevation profile looks consistent."
        );
    }

    @Transactional
    public RecalibrateResult recalibrate(Activity activity, RecalibrateRequest request) {
        List<ActivityPoint> points = activityPointRepository.findByActivityOrderBySequenceIndexAsc(activity);
        if (points.size() < 2) {
            return new RecalibrateResult(false, "Insufficient GPS points", 0, null, null, false);
        }

        List<LatLng> coords = request != null && request.coordinates != null && !request.coordinates.isEmpty()
                ? request.coordinates
                : points.stream().map(p -> new LatLng(p.getLatitude(), p.getLongitude())).toList();

        List<Double> demElev = fetchDemElevations(coords);
        if (demElev.isEmpty() || demElev.size() < points.size()) {
            return new RecalibrateResult(false, "Failed to fetch DEM elevations", 0, null, null, false);
        }

        boolean bridgeAware = applyBridgeTunnelInterpolation(coords, demElev);

        int n = Math.min(points.size(), demElev.size());
        List<Double> corrected = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            ActivityPoint p = points.get(i);
            if (p.getElevationRawMeters() == null && p.getElevationMeters() != null) {
                p.setElevationRawMeters(p.getElevationMeters());
            }
            p.setElevationCorrectedMeters(demElev.get(i));
            corrected.add(demElev.get(i));
        }
        activityPointRepository.saveAll(points);

        Double correctedAscent = totalAscent(corrected);
        Double rawAscent = totalAscent(points.stream()
                .map(p -> p.getElevationRawMeters() != null ? p.getElevationRawMeters() : p.getElevationMeters())
                .toList());

        return new RecalibrateResult(
                true,
                "Elevation recalibrated via topography.",
                n,
                rawAscent,
                correctedAscent,
                bridgeAware
        );
    }

    private List<Double> fetchDemElevations(List<LatLng> coords) {
        List<Double> out = new ArrayList<>();
        for (int start = 0; start < coords.size(); start += DEM_CHUNK) {
            int end = Math.min(coords.size(), start + DEM_CHUNK);
            List<LatLng> chunk = coords.subList(start, end);
            StringBuilder lats = new StringBuilder();
            StringBuilder lons = new StringBuilder();
            for (int i = 0; i < chunk.size(); i++) {
                if (i > 0) {
                    lats.append(',');
                    lons.append(',');
                }
                lats.append(String.format(Locale.ROOT, "%.6f", chunk.get(i).latitude));
                lons.append(String.format(Locale.ROOT, "%.6f", chunk.get(i).longitude));
            }
            URI uri = UriComponentsBuilder.fromUriString("https://api.open-meteo.com/v1/elevation")
                    .queryParam("latitude", lats.toString())
                    .queryParam("longitude", lons.toString())
                    .build().toUri();
            try {
                RequestEntity<Void> req = new RequestEntity<>(HttpMethod.GET, uri);
                ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(req, new ParameterizedTypeReference<>() {});
                Object elevations = resp.getBody() != null ? resp.getBody().get("elevation") : null;
                if (elevations instanceof List<?> list) {
                    for (Object e : list) {
                        if (e instanceof Number n) out.add(n.doubleValue());
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return out;
    }

    /**
     * OSM bridge/tunnel guard:
     * detect likely structure segments and interpolate to avoid DEM "drop into river/tunnel ground".
     */
    private boolean applyBridgeTunnelInterpolation(List<LatLng> coords, List<Double> demElev) {
        if (coords.size() < 6 || demElev.size() < 6) return false;
        if (!hasNearbyBridgeOrTunnel(coords)) return false;

        boolean applied = false;
        for (int i = 2; i < demElev.size() - 2; i++) {
            double prev = demElev.get(i - 1);
            double cur = demElev.get(i);
            double next = demElev.get(i + 1);
            // if center dips sharply below neighbors, smooth linearly
            if (cur < prev - 8 && cur < next - 8) {
                double interp = (prev + next) / 2.0;
                demElev.set(i, interp);
                applied = true;
            }
        }
        return applied;
    }

    private boolean hasNearbyBridgeOrTunnel(List<LatLng> coords) {
        double minLat = Double.POSITIVE_INFINITY, maxLat = Double.NEGATIVE_INFINITY;
        double minLon = Double.POSITIVE_INFINITY, maxLon = Double.NEGATIVE_INFINITY;
        for (LatLng c : coords) {
            minLat = Math.min(minLat, c.latitude);
            maxLat = Math.max(maxLat, c.latitude);
            minLon = Math.min(minLon, c.longitude);
            maxLon = Math.max(maxLon, c.longitude);
        }
        String query = "[out:json][timeout:12];(" +
                "way[\"bridge\"=\"yes\"](" + minLat + "," + minLon + "," + maxLat + "," + maxLon + ");" +
                "way[\"tunnel\"=\"yes\"](" + minLat + "," + minLon + "," + maxLat + "," + maxLon + ");" +
                ");out ids;";
        try {
            URI uri = UriComponentsBuilder.fromUriString("https://overpass-api.de/api/interpreter")
                    .queryParam("data", query).build().toUri();
            RequestEntity<Void> req = new RequestEntity<>(HttpMethod.GET, uri);
            ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(req, new ParameterizedTypeReference<>() {});
            Object elements = resp.getBody() != null ? resp.getBody().get("elements") : null;
            return elements instanceof List<?> list && !list.isEmpty();
        } catch (Exception ignored) {
            return false;
        }
    }

    private Double demAscentFromStartEnd(List<ActivityPoint> points) {
        List<LatLng> ends = List.of(
                new LatLng(points.get(0).getLatitude(), points.get(0).getLongitude()),
                new LatLng(points.get(points.size() - 1).getLatitude(), points.get(points.size() - 1).getLongitude())
        );
        List<Double> e = fetchDemElevations(ends);
        if (e.size() < 2) return null;
        return Math.abs(e.get(1) - e.get(0));
    }

    private static Double totalAscent(List<Double> profile) {
        if (profile == null || profile.size() < 2) return null;
        double ascent = 0.0;
        Double prev = profile.get(0);
        for (int i = 1; i < profile.size(); i++) {
            Double cur = profile.get(i);
            if (prev != null && cur != null && cur > prev) {
                ascent += (cur - prev);
            }
            if (cur != null) prev = cur;
        }
        return ascent;
    }

    private static double variance(Double a, Double b) {
        if (a == null || b == null) return 0.0;
        double base = Math.max(1.0, Math.max(Math.abs(a), Math.abs(b)));
        return Math.abs(a - b) / base;
    }

    public record LatLng(double latitude, double longitude) {}

    public static class RecalibrateRequest {
        public List<LatLng> coordinates;
    }

    public record ElevationStatus(
            boolean flagged,
            Double totalAscentBarometric,
            Double totalAscentDem,
            double variance,
            boolean hasCorrectedProfile,
            boolean canRecalibrate,
            String message
    ) {}

    public record RecalibrateResult(
            boolean success,
            String message,
            int correctedPoints,
            Double totalAscentRaw,
            Double totalAscentCorrected,
            boolean bridgeTunnelInterpolationApplied
    ) {}
}
