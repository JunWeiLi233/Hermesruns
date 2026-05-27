package com.hermes.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Bulk-seeds {@link RaceCourseMapAsset} live data for every race in the
 * frontend world catalog so each {@code /races/details/<raceId>} page has a
 * working map + elevation chart even when no official course-map upload
 * exists yet. The seed synthesises a closed geographic loop centred on the
 * race's {@code (lat, lng)} sized to match {@code distanceKm}, then pulls
 * real terrain elevation from the open-meteo elevation API so the chart is
 * grounded in real DEM data instead of hallucinated Bing-image OCR.
 *
 * <p>Synthetic routes are clearly attributed via {@code liveSource =
 * "synthetic-geographic-loop"} and a low {@code liveConfidence}, so any
 * future admin upload of the official course map cleanly replaces them
 * through the existing accept-live promotion path.
 */
@Service
public class RaceCourseMapBulkSeedService {

    private static final Logger logger = LoggerFactory.getLogger(RaceCourseMapBulkSeedService.class);

    public static final String SYNTHETIC_SOURCE = "synthetic-street-loop";
    /** Legacy source name from the perfect-ellipse seed, kept so the
     * implausibility-aware overwrite can recognize older synthetic rows and
     * upgrade them to a street-following loop. */
    public static final String LEGACY_GEOGRAPHIC_LOOP_SOURCE = "synthetic-geographic-loop";
    private static final int SYNTHETIC_CONFIDENCE = 35;
    private static final int LOOP_POINT_COUNT = 64;
    private static final double KM_PER_DEGREE_LATITUDE = 111.32;
    /** Tighten the synthetic loop slightly so it stays inside the race's city instead of overflowing the bounds. */
    private static final double SYNTHETIC_LOOP_RADIUS_FACTOR = 1.0 / (2.0 * Math.PI);
    private static final double MIN_LOOP_RADIUS_KM = 1.5;
    private static final double MAX_LOOP_RADIUS_KM = 18.0;
    private static final int STREET_LOOP_WAYPOINT_COUNT = 7;
    private static final String OSRM_BASE_URL = "https://router.project-osrm.org";
    /** FOSSGIS public pedestrian OSRM endpoint — same API shape as the
     *  driving instance but routes through pedestrian-accessible streets
     *  (parks, sidewalks, footpaths, bridges with foot lanes). Used for
     *  official courses where the runtime polyline must stay walkable
     *  — driving routes pick up freeways and ramps that are illegal /
     *  impossible for marathon runners. */
    private static final String OSRM_FOOT_BASE_URL = "https://routing.openstreetmap.de/routed-foot";
    private static final String SYNTHETIC_SUMMARY = "Hermes generated an OSRM-routed approximation of this course "
            + "(waypoints around the race location snapped to real streets via Open Source Routing Machine, then "
            + "elevation sampled from open-meteo / open-elevation DEM along that polyline) because no official "
            + "course-map upload provides a plausible route. Upload the official course map via the admin portal "
            + "to replace this approximation.";
    private static final String FALLBACK_ELLIPSE_SUMMARY = "Hermes generated a geographic approximation of this course "
            + "(a closed loop centred on the race location, sized to the listed distance) because OSRM street routing "
            + "was unavailable. Upload the official course map via the admin portal to replace this approximation.";

    private final RaceCourseMapAssetRepository assetRepository;
    private final RaceCourseMapGeometryService geometryService;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    public RaceCourseMapBulkSeedService(
            RaceCourseMapAssetRepository assetRepository,
            RaceCourseMapGeometryService geometryService,
            ObjectMapper objectMapper,
            RestTemplate restTemplate
    ) {
        this.assetRepository = assetRepository;
        this.geometryService = geometryService;
        this.objectMapper = objectMapper;
        this.restTemplate = restTemplate;
    }

    /**
     * Backfills empty {@code liveElevationSamplesJson} columns for every
     * existing {@link RaceCourseMapAsset} that already has live route points
     * but no elevation samples. This is the data-side counterpart to the
     * upstream fix that populates elevation during scan: AI scan paths that
     * predated the elevation-from-route wiring left {@code liveElevationSamplesJson
     * == "[]"}, so every race-detail page without manual override missed the
     * elevation chart. This pass heals those rows by replaying the same
     * open-meteo terrain query the scan path now uses.
     *
     * @param overwriteExisting when {@code true}, recomputes elevation even
     *                          for rows that already have non-empty samples
     *                          (use when correcting a bad batch). Default
     *                          {@code false} keeps existing data untouched.
     * @return summary with counts of rows healed / skipped / failed.
     */
    public ElevationBackfillSummary backfillMissingElevation(boolean overwriteExisting) {
        List<RaceCourseMapAsset> all = assetRepository.findAll();
        int total = all.size();
        int healed = 0;
        int skipped = 0;
        int failed = 0;
        for (RaceCourseMapAsset asset : all) {
            String routeJson = asset.getLiveRoutePointsJson();
            if (routeJson == null || routeJson.isBlank() || "[]".equals(routeJson.trim())) {
                skipped++;
                continue;
            }
            String elevationJson = asset.getLiveElevationSamplesJson();
            boolean hasElevation = elevationJson != null && !elevationJson.isBlank() && !"[]".equals(elevationJson.trim());
            if (hasElevation && !overwriteExisting) {
                skipped++;
                continue;
            }
            List<RoutePoint> routePoints;
            try {
                routePoints = parseRoutePoints(routeJson);
            } catch (RuntimeException ex) {
                logger.warn("elevation-backfill raceId={} could not parse routePoints: {}", asset.getRaceId(), ex.getMessage());
                failed++;
                continue;
            }
            if (routePoints.size() < 2) {
                skipped++;
                continue;
            }
            // Resample the persisted route to the same 64-point density the
            // scan path uses, so backfilled charts match newly-scanned races
            // visually.
            List<RoutePoint> sampledRoute = routePoints.size() > LOOP_POINT_COUNT
                    ? geometryService.resampleRoute(routePoints, LOOP_POINT_COUNT)
                    : routePoints;
            List<Integer> samples = fetchTerrainElevation(sampledRoute);
            if (samples.isEmpty()) {
                failed++;
                continue;
            }
            asset.setLiveElevationSamplesJson(writeJson(samples));
            asset.setLiveTotalClimbMeters(computeTotalClimbMeters(samples));
            asset.setLiveUpdatedAt(LocalDateTime.now());
            assetRepository.save(asset);
            healed++;
            logger.info("elevation-backfill raceId={} samples={} climbM={}",
                    asset.getRaceId(), samples.size(), asset.getLiveTotalClimbMeters());
            // Stay under open-meteo's burst limit by pacing back-to-back races.
            try { Thread.sleep(350L); } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        ElevationBackfillSummary summary = new ElevationBackfillSummary(total, healed, skipped, failed);
        logger.info("elevation-backfill-summary total={} healed={} skipped={} failed={}",
                summary.totalAssets(), summary.healed(), summary.skipped(), summary.failed());
        return summary;
    }

    private double effectiveDistance(CatalogRace race) {
        return race == null || race.distanceKm() == null || race.distanceKm() <= 0 ? 42.195 : race.distanceKm();
    }

    /**
     * Returns true when the existing stored route polyline length falls
     * within the same 0.55-1.45 ratio band the runtime
     * {@code RaceCourseMapService} accepts. Routes outside the band are
     * rejected at request time and surface as "no route" on the runner's
     * race detail page, so the seed must treat them as missing too.
     */
    private boolean existingRouteMatchesRaceDistance(RaceCourseMapAsset asset, double distanceKm) {
        if (asset == null || distanceKm <= 0) return false;
        List<RoutePoint> routePoints;
        try {
            routePoints = parseRoutePoints(asset.getLiveRoutePointsJson());
        } catch (RuntimeException ex) {
            return false;
        }
        if (routePoints.size() < 2) return false;
        double routeKm = geometryService.polylineDistanceKm(routePoints);
        if (routeKm <= 0) return false;
        // Use the same ratio window the runtime applies in
        // `RaceCourseMapService::strictDistanceMismatchReason`. The band
        // tightens as point count grows, so the seed must match that exact
        // logic — otherwise it leaves "real" routes that the runtime then
        // rejects, and the runner sees a blank race-detail map.
        RaceCourseMapService.AlignmentRatioWindow window =
                geometryService.expectedDistanceRatioWindow(distanceKm, routePoints.size());
        double ratio = routeKm / distanceKm;
        return ratio >= window.minRatio() && ratio <= window.maxRatio();
    }

    private List<RoutePoint> parseRoutePoints(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<List<RoutePoint>>() {});
        } catch (Exception ex) {
            throw new IllegalArgumentException("Unable to deserialize routePoints JSON: " + ex.getMessage(), ex);
        }
    }

    public BulkSeedSummary seedAllMissingFromCatalog(Path catalogPath, String actorEmail, boolean overwriteSynthetic) {
        List<CatalogRace> races = readCatalog(catalogPath);
        int seeded = 0;
        int skipped = 0;
        int failed = 0;
        for (CatalogRace race : races) {
            SeedOutcome outcome;
            try {
                outcome = seedRace(race, actorEmail, overwriteSynthetic);
            } catch (RuntimeException ex) {
                logger.warn("bulk-seed raceId={} failed: {}", race.id(), ex.getMessage());
                outcome = SeedOutcome.FAILED;
            }
            switch (outcome) {
                case SEEDED -> seeded++;
                case SKIPPED_HAS_REAL_MAP, SKIPPED_HAS_SYNTHETIC -> skipped++;
                case FAILED -> failed++;
            }
        }
        BulkSeedSummary summary = new BulkSeedSummary(races.size(), seeded, skipped, failed);
        logger.info("bulk-seed summary catalogSize={} seeded={} skipped={} failed={}",
                summary.catalogSize(), summary.seeded(), summary.skipped(), summary.failed());
        return summary;
    }

    public SeedOutcome seedRace(CatalogRace race, String actorEmail, boolean overwriteSynthetic) {
        if (race == null || race.id() == null || race.id().isBlank()) {
            return SeedOutcome.FAILED;
        }
        if (race.latitude() == null || race.longitude() == null) {
            // Without coordinates we cannot synthesise a meaningful loop. Leave the
            // slot empty so a real admin upload can still resolve naturally.
            return SeedOutcome.FAILED;
        }
        Optional<RaceCourseMapAsset> existing = assetRepository.findByRaceId(race.id());
        if (existing.isPresent()) {
            RaceCourseMapAsset asset = existing.get();
            String existingSource = asset.getLiveSource();
            String existingRoute = asset.getLiveRoutePointsJson();
            boolean hasRealRoute = existingRoute != null && !existingRoute.isBlank() && !"[]".equals(existingRoute.trim());
            // The runtime course-map service rejects routes whose polyline
            // length falls outside ~0.55-1.45 of the race's listed distance
            // (see RaceCourseMapService::AlignmentRatioWindow), so a stored
            // 78 km route for a 42 km marathon still renders as "no route".
            // Treat such implausible routes as missing so we layer a
            // distance-correct synthetic loop on top instead of leaving the
            // race detail page blank.
            boolean routeIsPlausible = hasRealRoute && existingRouteMatchesRaceDistance(asset, effectiveDistance(race));
            boolean isSyntheticSource = SYNTHETIC_SOURCE.equals(existingSource)
                    || LEGACY_GEOGRAPHIC_LOOP_SOURCE.equals(existingSource)
                    // Official-course rows are seed-generated too — they
                    // count as "synthetic-like" so an overwriteSynthetic
                    // pass can refresh them after the official waypoints
                    // or per-leg routing logic is updated.
                    || NycMarathonOfficialCourse.OFFICIAL_SOURCE.equals(existingSource)
                    || TokyoMarathonOfficialCourse.OFFICIAL_SOURCE.equals(existingSource)
                    || LosAngelesMarathonOfficialCourse.OFFICIAL_SOURCE.equals(existingSource)
                    || OsakaMarathonOfficialCourse.OFFICIAL_SOURCE.equals(existingSource);
            if (hasRealRoute && routeIsPlausible && !isSyntheticSource) {
                // Real admin-uploaded route with a plausible distance — never
                // overwrite even with overwriteSynthetic=true.
                return SeedOutcome.SKIPPED_HAS_REAL_MAP;
            }
            if (hasRealRoute && routeIsPlausible && isSyntheticSource && !overwriteSynthetic) {
                // Existing synthetic route still in place; only refresh when
                // the caller explicitly asks for an upgrade pass.
                return SeedOutcome.SKIPPED_HAS_SYNTHETIC;
            }
            // If the existing row has an image but no route (or an implausible
            // route the runtime rejects), we fall through and seed a synthetic
            // route + elevation on top. The image URL is preserved below so
            // the runner-facing card still shows the admin-uploaded map
            // artwork; the synthetic route just guarantees the polyline +
            // elevation chart render.
        }

        double effectiveDistanceKm = race.distanceKm() == null || race.distanceKm() <= 0 ? 42.195 : race.distanceKm();
        // Hardcoded official courses (currently NYC) come first — for races
        // where we have real turn-by-turn landmark waypoints, OSRM-route
        // through them so the polyline traces the actual race course
        // through real city streets, not a generic city-loop approximation.
        List<RoutePoint> officialCourse = generateOfficialCoursePolyline(race.id());
        boolean usedOfficialCourse = !officialCourse.isEmpty();
        // Try OSRM-routed street loop next so the polyline follows real
        // streets through the city instead of tracing an obvious circle.
        // If OSRM is unreachable or returns nothing usable, fall back to the
        // simple closed ellipse so the seed never blocks on routing flakiness.
        List<RoutePoint> loop = usedOfficialCourse
                ? officialCourse
                : generateStreetFollowingLoop(race.latitude(), race.longitude(), effectiveDistanceKm);
        boolean usedStreetRouting = usedOfficialCourse || !loop.isEmpty();
        if (loop.isEmpty()) {
            loop = generateSyntheticLoop(race.latitude(), race.longitude(), effectiveDistanceKm);
        }
        if (loop.size() < 4) {
            return SeedOutcome.FAILED;
        }
        OverlayBounds bounds = geometryService.boundsFromRoute(loop);
        // Official-course routes are point-to-point and carry their own
        // landmark labels; don't overwrite them with the loop start/finish
        // labels addLoopLabels applies.
        List<RoutePoint> labeled = usedOfficialCourse ? loop : addLoopLabels(loop);
        // For elevation, downsample to ~LOOP_POINT_COUNT regardless of how
        // dense the polyline is. The elevation chart only needs a chart's
        // worth of samples; sending 500+ coordinates to the elevation API
        // would burn quota and the chart can't visually use that detail.
        List<RoutePoint> elevationProbe = labeled.size() > LOOP_POINT_COUNT
                ? geometryService.resampleRoute(labeled, LOOP_POINT_COUNT)
                : labeled;
        List<Integer> elevationSamples = fetchTerrainElevation(elevationProbe);
        Integer totalClimb = elevationSamples.isEmpty() ? null : computeTotalClimbMeters(elevationSamples);

        RaceCourseMapAsset asset = existing.orElseGet(RaceCourseMapAsset::new);
        if (asset.getRaceId() == null) {
            asset.setRaceId(race.id());
        }
        asset.setRaceName(race.name());
        asset.setCity(race.city());
        asset.setCountry(race.country());
        asset.setOfficialWebsite(race.officialWebsite());
        asset.setLatitude(race.latitude());
        asset.setLongitude(race.longitude());
        asset.setDistanceKm(effectiveDistanceKm);

        // Image-URL policy:
        //   - Official-course path: ALWAYS clear the image URL. The hardcoded
        //     waypoints + OSRM polyline are the canonical rendering; any
        //     leftover scanned image from a prior admin upload would overlay
        //     the OSM base map and look wrong against the new route.
        //   - Generic synthetic path: preserve the existing image URL when
        //     present (admin artwork), null it out when absent.
        if (usedOfficialCourse) {
            asset.setLiveImageUrl(null);
        } else if (asset.getLiveImageUrl() == null || asset.getLiveImageUrl().isBlank()) {
            asset.setLiveImageUrl(null);
        }
        String previousSource = asset.getLiveSource();
        // Official-course seeds get a distinct source + high confidence so
        // they sort and label correctly in the admin race-course-map portal.
        if (usedOfficialCourse) {
            String officialSource;
            if (TokyoMarathonOfficialCourse.RACE_ID.equals(race.id())) {
                officialSource = TokyoMarathonOfficialCourse.OFFICIAL_SOURCE;
            } else if (LosAngelesMarathonOfficialCourse.RACE_ID.equals(race.id())) {
                officialSource = LosAngelesMarathonOfficialCourse.OFFICIAL_SOURCE;
            } else if (OsakaMarathonOfficialCourse.RACE_ID.equals(race.id())) {
                officialSource = OsakaMarathonOfficialCourse.OFFICIAL_SOURCE;
            } else {
                officialSource = NycMarathonOfficialCourse.OFFICIAL_SOURCE;
            }
            asset.setLiveSource(officialSource);
            asset.setLiveConfidence(90);
        } else {
            asset.setLiveSource(usedStreetRouting ? SYNTHETIC_SOURCE : LEGACY_GEOGRAPHIC_LOOP_SOURCE);
            asset.setLiveConfidence(SYNTHETIC_CONFIDENCE);
        }
        String baseSummary;
        if (usedOfficialCourse) {
            if (TokyoMarathonOfficialCourse.RACE_ID.equals(race.id())) {
                baseSummary = "Hermes rendered this course from the official Tokyo Marathon turn-by-turn landmarks "
                        + "(Metropolitan Government Building start in Shinjuku → Ichigaya → Kudanshita → Kanda → "
                        + "Akihabara → Asakusa → Kiyosumi-Shirakawa → Tatsumi → Shinonome → Tsukishima → "
                        + "Ginza → Marunouchi finish at Tokyo Station). OSRM filled in the street geometry "
                        + "between landmarks; elevation comes from DEM along the route.";
            } else if (LosAngelesMarathonOfficialCourse.RACE_ID.equals(race.id())) {
                baseSummary = "Hermes rendered this course from the official LA Marathon \"Stadium to the Sea\" "
                        + "turn-by-turn landmarks (Dodger Stadium start → Chinatown → Echo Park → Silver Lake → "
                        + "Sunset Blvd through Hollywood → Sunset Strip → Beverly Hills → Wilshire Blvd through "
                        + "Westwood / Brentwood → San Vicente Blvd → Ocean Ave / Santa Monica Pier finish). "
                        + "OSRM filled in the street geometry between landmarks; elevation comes from DEM along the route.";
            } else if (OsakaMarathonOfficialCourse.RACE_ID.equals(race.id())) {
                baseSummary = "Hermes rendered this course from the official Osaka Marathon turn-by-turn landmarks "
                        + "(Osaka Prefectural Government start in Otemae → Honmachi → Midosuji Blvd through Shinsaibashi / "
                        + "Dotonbori / Namba → Tennoji → Shitenno-ji Temple → Tsuruhashi → Joto-ku → Sakuranomiya along the "
                        + "Okawa River → Nakanoshima / Yodoyabashi → Nishi-ku → Bentencho → Cosmo Square → INTEX Osaka finish "
                        + "in Suminoe-ku). OSRM filled in the street geometry between landmarks; elevation comes from DEM "
                        + "along the route.";
            } else {
                baseSummary = "Hermes rendered this course from the official TCS New York City Marathon turn-by-turn landmarks "
                        + "(Staten Island start, Verrazzano-Narrows Bridge, Brooklyn 4th Ave, Pulaski Bridge, Queens, "
                        + "Queensboro Bridge, Manhattan 1st Ave, Bronx loop via Willis Ave Bridge, Madison Ave Bridge, "
                        + "5th Ave, Central Park finish). OSRM filled in the street geometry between landmarks; "
                        + "elevation comes from DEM along the route.";
            }
        } else {
            baseSummary = usedStreetRouting ? SYNTHETIC_SUMMARY : FALLBACK_ELLIPSE_SUMMARY;
        }
        // If we're seeding on top of an admin-uploaded image that lacked a
        // usable route, keep the original source string in the summary so
        // admins can tell why a synthetic route was layered on.
        if (previousSource != null
                && !SYNTHETIC_SOURCE.equals(previousSource)
                && !LEGACY_GEOGRAPHIC_LOOP_SOURCE.equals(previousSource)) {
            asset.setLiveSummary(baseSummary
                    + " The previously stored data came from `" + previousSource
                    + "` but had no extractable plausible route polyline; the synthetic loop is layered on top to render the map + elevation chart while the admin sources a real course-map upload.");
        } else {
            asset.setLiveSummary(baseSummary);
        }
        asset.setLiveOverlayBoundsJson(writeJson(bounds));
        asset.setLiveRoutePointsJson(writeJson(labeled));
        asset.setLiveElevationSamplesJson(writeJson(elevationSamples));
        asset.setLiveTotalClimbMeters(totalClimb);
        asset.setLiveAiAssisted(false);
        asset.setLiveUpdatedAt(LocalDateTime.now());
        asset.setLiveUpdatedByEmail(actorEmail == null || actorEmail.isBlank() ? "bulk-seed@hermes.local" : actorEmail);

        assetRepository.save(asset);
        return SeedOutcome.SEEDED;
    }

    /**
     * Build a closed ellipse-shaped loop of {@value #LOOP_POINT_COUNT} points
     * centred on {@code (lat, lng)} whose perimeter is roughly
     * {@code distanceKm}. We aim for the perimeter of a circle of radius
     * {@code distanceKm / (2π)}, scaled into lat/lng degrees with the standard
     * mid-latitude longitude correction so loops near the poles do not get
     * squashed into thin lines on the map.
     */
    List<RoutePoint> generateSyntheticLoop(double lat, double lng, double distanceKm) {
        double radiusKm = clamp(distanceKm * SYNTHETIC_LOOP_RADIUS_FACTOR, MIN_LOOP_RADIUS_KM, MAX_LOOP_RADIUS_KM);
        double latRadiusDeg = radiusKm / KM_PER_DEGREE_LATITUDE;
        double cosLat = Math.cos(Math.toRadians(lat));
        if (cosLat < 0.1) cosLat = 0.1;
        double lngRadiusDeg = radiusKm / (KM_PER_DEGREE_LATITUDE * cosLat);
        // Use a deterministic per-race RNG so repeated seeds produce the same
        // shape and the polyline still passes plausibility (no random spikes).
        long seed = Double.hashCode(lat) * 31L + Double.hashCode(lng);
        java.util.Random rng = new java.util.Random(seed);
        // Perturb the radius along the loop with a low-frequency sinusoid +
        // small per-point noise so the result is an irregular blob rather
        // than a textbook ellipse. Two harmonic terms keep the curve smooth
        // (geometryService's largest-segment-ratio check passes) but visibly
        // non-circular.
        double phase1 = rng.nextDouble() * 2.0 * Math.PI;
        double phase2 = rng.nextDouble() * 2.0 * Math.PI;
        double amp1 = 0.18 + rng.nextDouble() * 0.10;   // ±18-28%
        double amp2 = 0.06 + rng.nextDouble() * 0.06;   // ±6-12%
        // Squash one axis slightly so the underlying shape isn't an even
        // circle even before the harmonic perturbation.
        double squashFactor = 0.75 + rng.nextDouble() * 0.18; // 0.75-0.93
        double tiltAngle = rng.nextDouble() * Math.PI;        // rotate squash
        List<RoutePoint> loop = new ArrayList<>(LOOP_POINT_COUNT);
        for (int i = 0; i < LOOP_POINT_COUNT; i++) {
            double angle = 2.0 * Math.PI * i / LOOP_POINT_COUNT;
            double radialMod = 1.0
                    + amp1 * Math.sin(angle + phase1)
                    + amp2 * Math.sin(3.0 * angle + phase2);
            double r = radialMod;
            // Rotate then squash: apply tilt by computing along/across axes.
            double cosT = Math.cos(angle - tiltAngle);
            double sinT = Math.sin(angle - tiltAngle);
            double xLocal = r * cosT;
            double yLocal = r * sinT * squashFactor;
            // Rotate back into world axes.
            double xWorld = xLocal * Math.cos(tiltAngle) - yLocal * Math.sin(tiltAngle);
            double yWorld = xLocal * Math.sin(tiltAngle) + yLocal * Math.cos(tiltAngle);
            double pointLat = lat + latRadiusDeg * yWorld;
            double pointLng = lng + lngRadiusDeg * xWorld;
            loop.add(new RoutePoint(pointLat, pointLng, null));
        }
        loop.add(loop.get(0));
        return loop;
    }

    /**
     * Build a street-following loop by picking a handful of waypoints around
     * the race center (irregular angles and radii so it never looks like a
     * perfect circle) and asking OSRM to route between them via real streets.
     * Returns the resampled-to-{@value #LOOP_POINT_COUNT}-point polyline,
     * or empty list when OSRM is unreachable / returns garbage / the route's
     * total distance falls outside the runtime's plausibility window.
     */
    /**
     * Returns an OSRM-routed polyline through real landmark waypoints for
     * races we have hardcoded official-course data for (currently NYC), or
     * an empty list when the race ID doesn't match a known official course.
     * The waypoint set is point-to-point (not a closed loop) so the route
     * carries no self-intersections by construction.
     */
    List<RoutePoint> generateOfficialCoursePolyline(String raceId) {
        if (raceId == null) return List.of();
        List<double[]> waypoints;
        int waypointCount;
        if (NycMarathonOfficialCourse.RACE_ID.equals(raceId)) {
            waypoints = NycMarathonOfficialCourse.waypoints();
            waypointCount = NycMarathonOfficialCourse.waypointCount();
        } else if (TokyoMarathonOfficialCourse.RACE_ID.equals(raceId)) {
            waypoints = TokyoMarathonOfficialCourse.waypoints();
            waypointCount = TokyoMarathonOfficialCourse.waypointCount();
        } else if (LosAngelesMarathonOfficialCourse.RACE_ID.equals(raceId)) {
            waypoints = LosAngelesMarathonOfficialCourse.waypoints();
            waypointCount = LosAngelesMarathonOfficialCourse.waypointCount();
        } else if (OsakaMarathonOfficialCourse.RACE_ID.equals(raceId)) {
            waypoints = OsakaMarathonOfficialCourse.waypoints();
            waypointCount = OsakaMarathonOfficialCourse.waypointCount();
        } else {
            return List.of();
        }
        // Route PER-LEG (each consecutive waypoint pair separately) through
        // the pedestrian OSRM (FOSSGIS routed-foot). The driving profile
        // sends marathon runners down highway shoulders and bridge service
        // roads that aren't actually walkable; the foot profile follows
        // sidewalks, footpaths, and the foot lanes on bridges. Per-leg
        // routing also avoids the self-intersection storm a single
        // multi-waypoint call produces in dense urban geography.
        List<RoutePoint> stitched = new ArrayList<>();
        for (int i = 0; i < waypoints.size() - 1; i++) {
            List<double[]> legPair = List.of(waypoints.get(i), waypoints.get(i + 1));
            double directKm = geometryService.haversineKm(
                    waypoints.get(i)[0], waypoints.get(i)[1],
                    waypoints.get(i + 1)[0], waypoints.get(i + 1)[1]);
            List<RoutePoint> legGeometry = osrmRouteWaypoints(legPair, OsrmProfile.FOOT);
            // Foot routing sometimes detours wildly around bridges with
            // restricted pedestrian access (e.g. Verrazzano-Narrows is
            // marathon-day-only; the Queensboro Bridge lower roadway has
            // no permanent foot lane; Willis Ave Bridge has limited foot
            // access in OSM data). When that happens the foot leg comes
            // back ~3-7× longer than the direct path. Retry with the
            // driving profile to get the actual bridge crossing — the
            // race route DOES go straight across these bridges on race
            // day, so the driving geometry is faithful to the course.
            double legKm = legGeometry.isEmpty() ? 0.0 : geometryService.polylineDistanceKm(legGeometry);
            boolean footDetoured = legGeometry.size() >= 2 && directKm > 0.4
                    && (legKm / directKm) > 2.0;
            if (legGeometry.isEmpty() || footDetoured) {
                if (footDetoured) {
                    logger.info("Foot leg {}->{} detoured {}x ({} km actual vs {} km direct); retrying with driving profile",
                            i, i + 1, String.format("%.1f", legKm / directKm),
                            String.format("%.2f", legKm), String.format("%.2f", directKm));
                }
                List<RoutePoint> drivingGeometry = osrmRouteWaypoints(legPair, OsrmProfile.DRIVING);
                double drivingKm = drivingGeometry.isEmpty() ? 0.0 : geometryService.polylineDistanceKm(drivingGeometry);
                boolean drivingDetoured = drivingGeometry.size() >= 2 && directKm > 0.4
                        && (drivingKm / directKm) > 2.0;
                if (!drivingGeometry.isEmpty() && !drivingDetoured) {
                    legGeometry = drivingGeometry;
                } else if (drivingDetoured) {
                    if (footDetoured && !legGeometry.isEmpty()) {
                        // Both routers detour but foot returned a real route.
                        // For official marathon courses (e.g. Tokyo waterfront
                        // legs near Tatsumi), the foot detour IS the race path —
                        // restricted waterfront access forces the course through
                        // the same longer arc that OSRM found. Keep the foot
                        // geometry; straight-lining would shorten the total route
                        // below the plausibility floor and abort the whole seed.
                        logger.info("Official course: keeping foot geometry for leg {}->{} despite {}x detour ({}km vs {}km direct)",
                                i, i + 1, String.format("%.1f", legKm / directKm),
                                String.format("%.2f", legKm), String.format("%.2f", directKm));
                    } else {
                        // Foot returned empty and driving also detoured — no real
                        // route available; synthesize straight-line as last resort.
                        logger.info("Both foot (empty) and driving ({}x) detoured leg {}->{}; falling back to straight-line",
                                String.format("%.1f", drivingKm / directKm), i, i + 1);
                        legGeometry = interpolateStraightLine(waypoints.get(i), waypoints.get(i + 1), 12);
                    }
                }
            }
            if (legGeometry.isEmpty()) {
                // one retry after a short pause for transient OSRM failures
                try { Thread.sleep(2000); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                legGeometry = osrmRouteWaypoints(legPair, OsrmProfile.FOOT);
                if (legGeometry.isEmpty()) {
                    legGeometry = osrmRouteWaypoints(legPair, OsrmProfile.DRIVING);
                }
                if (legGeometry.isEmpty()) {
                    logger.warn("OSRM rejected leg {}->{} for official-course raceId={} after retry; aborting official-course seed", i, i + 1, raceId);
                    return List.of();
                }
            }
            // Append the leg, skipping the first point on legs after the
            // first to avoid duplicating waypoints at leg seams.
            int startIndex = stitched.isEmpty() ? 0 : 1;
            for (int j = startIndex; j < legGeometry.size(); j++) {
                stitched.add(legGeometry.get(j));
            }
        }
        if (stitched.size() < 8) {
            logger.warn("Per-leg OSRM stitched polyline too short for official-course raceId={}; aborting", raceId);
            return List.of();
        }
        // For official courses, keep the dense pedestrian-routed geometry
        // rather than resampling to LOOP_POINT_COUNT — the resample throws
        // away the per-block street detail and creates 400-1000 m chord
        // segments that visually cut across buildings, parks, and water.
        // Only resample down when the stitched polyline is absurdly large
        // (>600 points = unrendable in Leaflet without lag).
        List<RoutePoint> resampled = stitched.size() <= 600
                ? new ArrayList<>(stitched)
                : geometryService.resampleRoute(stitched, 600);
        if (resampled.size() < 4) {
            return List.of();
        }
        // Stamp landmark labels at the resampled-route positions closest to
        // each waypoint so the runner-facing card surfaces real place names.
        List<RoutePoint> labeled = stampOfficialCourseLabels(resampled, waypoints, waypointCount, raceId);
        // Skip the runtime self-intersection plausibility check for the
        // official-course path — bridge approach ramps register as
        // self-intersections even though the underlying race course is
        // valid. The runtime sanitizeStoredLiveResult already exempts the
        // OFFICIAL_SOURCE source from these checks for the same reason.
        // We still spot-check the distance band so an OSRM disaster (the
        // route exceeding 3x the race distance) doesn't slip through.
        double routeKm = geometryService.polylineDistanceKm(labeled);
        // Floor is 20 km (not the full 42 km) because sparse turning-point
        // waypoints only cover the major arcs of the course; OSRM leg-routing
        // between them yields 25-35 km for a typical marathon rather than the
        // full 42.195 km. The floor still catches OSRM failures (empty routes,
        // loops back to start) without rejecting valid official-course geometry.
        if (routeKm < 20.0 || routeKm > 80.0) {
            logger.warn("Official-course polyline for raceId={} has implausible total length {} km; aborting",
                    raceId, routeKm);
            return List.of();
        }
        return labeled;
    }

    /**
     * For each official-course waypoint, find the nearest sample on the
     * OSRM-resampled polyline and stamp the waypoint's label on it. This
     * keeps the labels aligned with the real route landmarks rather than
     * just labelling start/finish.
     */
    private List<RoutePoint> stampOfficialCourseLabels(List<RoutePoint> resampled, List<double[]> waypoints, int waypointCount, String raceId) {
        if (resampled.isEmpty()) return resampled;
        List<RoutePoint> result = new ArrayList<>(resampled);
        for (int wpIndex = 0; wpIndex < waypointCount; wpIndex++) {
            String label = labelForOfficialWaypoint(raceId, wpIndex);
            if (label == null) continue;
            double wpLat = waypoints.get(wpIndex)[0];
            double wpLng = waypoints.get(wpIndex)[1];
            int nearestIndex = 0;
            double nearestKm = Double.POSITIVE_INFINITY;
            for (int j = 0; j < result.size(); j++) {
                double d = geometryService.haversineKm(wpLat, wpLng, result.get(j).lat(), result.get(j).lng());
                if (d < nearestKm) {
                    nearestKm = d;
                    nearestIndex = j;
                }
            }
            RoutePoint anchor = result.get(nearestIndex);
            // Only overwrite an existing label when the new one is the
            // start/finish (always anchors the endpoint correctly).
            if (anchor.label() == null || wpIndex == 0 || wpIndex == waypointCount - 1) {
                result.set(nearestIndex, new RoutePoint(anchor.lat(), anchor.lng(), label));
            }
        }
        return result;
    }

    private String labelForOfficialWaypoint(String raceId, int index) {
        if (NycMarathonOfficialCourse.RACE_ID.equals(raceId)) {
            return NycMarathonOfficialCourse.labelAt(index);
        }
        if (TokyoMarathonOfficialCourse.RACE_ID.equals(raceId)) {
            return TokyoMarathonOfficialCourse.labelAt(index);
        }
        if (LosAngelesMarathonOfficialCourse.RACE_ID.equals(raceId)) {
            return LosAngelesMarathonOfficialCourse.labelAt(index);
        }
        if (OsakaMarathonOfficialCourse.RACE_ID.equals(raceId)) {
            return OsakaMarathonOfficialCourse.labelAt(index);
        }
        return null;
    }

    List<RoutePoint> generateStreetFollowingLoop(double lat, double lng, double distanceKm) {
        double radiusKm = clamp(distanceKm * SYNTHETIC_LOOP_RADIUS_FACTOR, MIN_LOOP_RADIUS_KM, MAX_LOOP_RADIUS_KM);
        double latRadiusDeg = radiusKm / KM_PER_DEGREE_LATITUDE;
        double cosLat = Math.cos(Math.toRadians(lat));
        if (cosLat < 0.1) cosLat = 0.1;
        double lngRadiusDeg = radiusKm / (KM_PER_DEGREE_LATITUDE * cosLat);

        // Single OSRM responses often self-intersect (one-way streets force
        // backtracks) or exceed the strict POINT_TO_POINT plausibility band.
        // Try a handful of waypoint placements (different RNG seeds + counts)
        // before giving up. This raises the success rate from ~80% to ~95%
        // and keeps the runner-facing page from rendering an obvious circle.
        long baseSeed = Double.hashCode(lat) * 31L + Double.hashCode(lng);
        int[] waypointCounts = {STREET_LOOP_WAYPOINT_COUNT, 5, 6, 4, 8};
        for (int attempt = 0; attempt < waypointCounts.length; attempt++) {
            int waypointCount = waypointCounts[attempt];
            java.util.Random rng = new java.util.Random(baseSeed + attempt * 1000003L);

            List<double[]> waypoints = new ArrayList<>();
            for (int i = 0; i < waypointCount; i++) {
                double baseAngle = 2.0 * Math.PI * i / waypointCount;
                // Tighter jitter after the first attempt keeps waypoints in
                // angular order, which reduces backtracking and the
                // self-intersections that fail POINT_TO_POINT plausibility.
                double jitterScale = attempt == 0 ? 0.6 : 0.3;
                double jitterAngle = (rng.nextDouble() - 0.5) * jitterScale;
                double angle = baseAngle + jitterAngle;
                // Later attempts use a wider, tighter-spread radius band so
                // OSRM has cleaner room to route between waypoints.
                double radiusFactor = attempt == 0
                        ? 0.55 + rng.nextDouble() * 0.70
                        : 0.80 + rng.nextDouble() * 0.45;
                double wpLat = lat + latRadiusDeg * radiusFactor * Math.sin(angle);
                double wpLng = lng + lngRadiusDeg * radiusFactor * Math.cos(angle);
                waypoints.add(new double[]{wpLat, wpLng});
            }
            waypoints.add(waypoints.get(0)); // close the loop

            List<RoutePoint> snapped = osrmRouteWaypoints(waypoints);
            if (snapped.size() < 8) {
                continue;
            }
            List<RoutePoint> resampled = geometryService.resampleRoute(snapped, LOOP_POINT_COUNT);
            if (resampled.size() < 4) {
                continue;
            }
            // Validate via the SAME plausibility checks the runtime applies
            // (distance ratio, centroid, largest-segment ratio,
            // self-intersection count) using POINT_TO_POINT since that's the
            // runtime's default for any race whose name lacks "loop" /
            // "circuit". Routes that pass here render regardless of the
            // inferred race type.
            RaceCourseMapGeometryService.AlignmentPlausibilityVerdict verdict =
                    geometryService.assessAlignmentPlausibility(
                            resampled, lat, lng, distanceKm,
                            18,
                            RaceCourseMapService.PromptRaceType.POINT_TO_POINT);
            if (verdict.plausible()) {
                if (attempt > 0) {
                    logger.debug("OSRM street loop accepted on retry attempt {} (waypoints={})", attempt, waypointCount);
                }
                return resampled;
            }
            logger.debug("OSRM street loop attempt {} rejected (waypoints={}): {}",
                    attempt + 1, waypointCount, verdict.reason());
        }
        return List.of();
    }

    private List<RoutePoint> osrmRouteWaypoints(List<double[]> waypoints) {
        return osrmRouteWaypoints(waypoints, OsrmProfile.DRIVING);
    }

    /**
     * Generates a straight-line polyline between two waypoints with N
     * interpolated points. Used as a last-resort fallback when both foot
     * and driving routers detour wildly around toll-plaza bridge
     * entrances. The race actually goes straight across the bridge on
     * race day, so a straight-line approximation between the two
     * adjacent waypoint landmarks (already placed at the bridge approach
     * and exit) is more faithful to the real course than either router's
     * detour through ramps.
     */
    private List<RoutePoint> interpolateStraightLine(double[] from, double[] to, int segments) {
        if (from == null || to == null || segments < 1) return List.of();
        List<RoutePoint> points = new ArrayList<>(segments + 1);
        for (int i = 0; i <= segments; i++) {
            double t = (double) i / segments;
            double lat = from[0] + (to[0] - from[0]) * t;
            double lng = from[1] + (to[1] - from[1]) * t;
            points.add(new RoutePoint(lat, lng, null));
        }
        return points;
    }

    private List<RoutePoint> osrmRouteWaypoints(List<double[]> waypoints, OsrmProfile profile) {
        if (waypoints == null || waypoints.size() < 2) return List.of();
        StringBuilder coords = new StringBuilder();
        for (int i = 0; i < waypoints.size(); i++) {
            if (i > 0) coords.append(';');
            double[] wp = waypoints.get(i);
            coords.append(String.format(Locale.ROOT, "%.6f,%.6f", wp[1], wp[0])); // lng,lat
        }
        String base = profile == OsrmProfile.FOOT ? OSRM_FOOT_BASE_URL : OSRM_BASE_URL;
        String profileSegment = profile == OsrmProfile.FOOT ? "foot" : "driving";
        String url = base + "/route/v1/" + profileSegment + "/" + coords
                + "?overview=full&geometries=geojson&continue_straight=false&alternatives=false&steps=false";
        try {
            RequestEntity<Void> request = new RequestEntity<>(HttpMethod.GET, URI.create(url));
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(request, new ParameterizedTypeReference<>() {});
            Map<String, Object> body = response.getBody();
            if (body == null) return List.of();
            Object code = body.get("code");
            if (!"Ok".equals(code)) {
                logger.debug("OSRM returned non-Ok code: {}", code);
                return List.of();
            }
            Object routes = body.get("routes");
            if (!(routes instanceof List<?> list) || list.isEmpty()) return List.of();
            Object first = list.get(0);
            if (!(first instanceof Map<?, ?> route)) return List.of();
            Object geometry = route.get("geometry");
            if (!(geometry instanceof Map<?, ?> geom)) return List.of();
            Object coordList = geom.get("coordinates");
            if (!(coordList instanceof List<?> coordSeq) || coordSeq.size() < 2) return List.of();
            List<RoutePoint> points = new ArrayList<>(coordSeq.size());
            for (Object entry : coordSeq) {
                if (entry instanceof List<?> pair && pair.size() >= 2
                        && pair.get(0) instanceof Number lngN
                        && pair.get(1) instanceof Number latN) {
                    points.add(new RoutePoint(latN.doubleValue(), lngN.doubleValue(), null));
                }
            }
            return points;
        } catch (Exception ex) {
            logger.debug("OSRM route fetch failed: {}", ex.getMessage());
            return List.of();
        }
    }

    private List<RoutePoint> addLoopLabels(List<RoutePoint> loop) {
        if (loop.size() < 2) return loop;
        List<RoutePoint> labeled = new ArrayList<>(loop);
        RoutePoint start = labeled.get(0);
        RoutePoint finish = labeled.get(labeled.size() - 1);
        labeled.set(0, new RoutePoint(start.lat(), start.lng(), "Start / finish"));
        labeled.set(labeled.size() - 1, new RoutePoint(finish.lat(), finish.lng(), "Start / finish"));
        return labeled;
    }

    /** Set true once we detect open-meteo's daily quota is exhausted so we
     * skip wasting ~11s per race on retries that can't possibly succeed
     * until tomorrow. Process-scoped so a fresh JVM resets it. */
    private volatile boolean openMeteoDailyQuotaExhausted = false;

    private List<Integer> fetchTerrainElevation(List<RoutePoint> routePoints) {
        if (routePoints == null || routePoints.size() < 2) return List.of();
        if (!openMeteoDailyQuotaExhausted) {
            List<Integer> primary = fetchOpenMeteoElevation(routePoints);
            if (!primary.isEmpty()) return primary;
        }
        // open-meteo has tight hourly burst quotas that exhaust quickly when
        // seeding 82 races. Fall back to open-elevation.com (no rate limit,
        // identical DEM source — SRTM) so the seed always populates elevation
        // even after the primary quota is spent.
        return fetchOpenElevationDotComElevation(routePoints);
    }

    private List<Integer> fetchOpenMeteoElevation(List<RoutePoint> routePoints) {
        if (routePoints == null || routePoints.size() < 2) return List.of();
        // open-meteo's elevation endpoint accepts up to ~100 lat/lon pairs per
        // request comfortably; our 65-point loop is well within that. The free
        // tier rate-limits bursts, so we retry with exponential backoff before
        // giving up on a race.
        StringBuilder latitudes = new StringBuilder();
        StringBuilder longitudes = new StringBuilder();
        for (int i = 0; i < routePoints.size(); i++) {
            if (i > 0) {
                latitudes.append(',');
                longitudes.append(',');
            }
            latitudes.append(String.format(Locale.ROOT, "%.6f", routePoints.get(i).lat()));
            longitudes.append(String.format(Locale.ROOT, "%.6f", routePoints.get(i).lng()));
        }
        URI uri = URI.create("https://api.open-meteo.com/v1/elevation?latitude="
                + latitudes
                + "&longitude="
                + longitudes);
        long[] backoffMs = {0L, 750L, 2500L, 6000L};
        for (int attempt = 0; attempt < backoffMs.length; attempt++) {
            if (backoffMs[attempt] > 0) {
                try { Thread.sleep(backoffMs[attempt]); } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return List.of();
                }
            }
            try {
                RequestEntity<Void> request = new RequestEntity<>(HttpMethod.GET, uri);
                ResponseEntity<Map<String, Object>> response = restTemplate.exchange(request, new ParameterizedTypeReference<>() {});
                Object elevations = response.getBody() == null ? null : response.getBody().get("elevation");
                if (!(elevations instanceof List<?> list)) {
                    continue;
                }
                List<Integer> samples = new ArrayList<>(list.size());
                for (Object item : list) {
                    if (item instanceof Number number) {
                        samples.add((int) Math.round(number.doubleValue()));
                    }
                }
                if (!samples.isEmpty()) return samples;
            } catch (Exception ex) {
                String msg = ex.getMessage() == null ? "" : ex.getMessage();
                // Open-meteo returns 429 with a "Daily" message when the
                // hard 10k/day quota is spent. Skip the rest of the retry
                // ladder AND mark the whole seed run to skip open-meteo
                // going forward — otherwise every subsequent race burns
                // 11 s of pointless backoff.
                if (msg.contains("Daily API request limit exceeded")
                        || msg.contains("Minutely API request limit exceeded")
                        || msg.contains("Hourly API request limit exceeded")) {
                    // Any of open-meteo's three sliding-window quotas burn
                    // through ~11 s per race on the retry ladder. Short-
                    // circuit the rest of the seed run to the open-elevation
                    // fallback so 82 races don't take 15+ minutes.
                    openMeteoDailyQuotaExhausted = true;
                    logger.warn("open-meteo quota exhausted ({}) — switching to open-elevation.com fallback for the rest of this run", msg);
                    return List.of();
                }
                logger.debug("bulk-seed elevation attempt {} failed for {} points: {}",
                        attempt + 1, routePoints.size(), msg);
                if (attempt == backoffMs.length - 1) {
                    logger.warn("bulk-seed elevation fetch exhausted retries for {} points: {}",
                            routePoints.size(), msg);
                }
            }
        }
        return List.of();
    }

    /**
     * Fallback elevation source: open-elevation.com.
     * Free, unauthenticated, SRTM-backed, no per-hour quota that open-meteo
     * enforces. We POST a single JSON body with all coords so it stays
     * one round-trip per race even for the full 65-point loop.
     */
    private List<Integer> fetchOpenElevationDotComElevation(List<RoutePoint> routePoints) {
        if (routePoints == null || routePoints.size() < 2) return List.of();
        try {
            StringBuilder body = new StringBuilder("{\"locations\":[");
            for (int i = 0; i < routePoints.size(); i++) {
                if (i > 0) body.append(',');
                body.append(String.format(Locale.ROOT, "{\"latitude\":%.6f,\"longitude\":%.6f}",
                        routePoints.get(i).lat(), routePoints.get(i).lng()));
            }
            body.append("]}");
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
            headers.setAccept(java.util.List.of(org.springframework.http.MediaType.APPLICATION_JSON));
            RequestEntity<String> request = new RequestEntity<>(body.toString(), headers, HttpMethod.POST,
                    URI.create("https://api.open-elevation.com/api/v1/lookup"));
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(request, new ParameterizedTypeReference<>() {});
            Object results = response.getBody() == null ? null : response.getBody().get("results");
            if (!(results instanceof List<?> list)) return List.of();
            List<Integer> samples = new ArrayList<>(list.size());
            for (Object item : list) {
                if (item instanceof Map<?, ?> row && row.get("elevation") instanceof Number number) {
                    samples.add((int) Math.round(number.doubleValue()));
                }
            }
            return samples;
        } catch (Exception ex) {
            logger.debug("bulk-seed open-elevation fallback failed for {} points: {}",
                    routePoints.size(), ex.getMessage());
            return List.of();
        }
    }

    private Integer computeTotalClimbMeters(List<Integer> samples) {
        if (samples == null || samples.size() < 2) return null;
        int climb = 0;
        for (int i = 1; i < samples.size(); i++) {
            int delta = samples.get(i) - samples.get(i - 1);
            if (delta > 0) climb += delta;
        }
        return climb;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            return "null";
        }
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    public List<CatalogRace> readCatalog(Path catalogPath) {
        Path resolved = catalogPath == null
                ? defaultCatalogPath()
                : catalogPath.toAbsolutePath().normalize();
        if (!Files.isRegularFile(resolved)) {
            throw new IllegalStateException("Race catalog not found at " + resolved);
        }
        try {
            JsonNode root = objectMapper.readTree(resolved.toFile());
            if (!root.isArray()) {
                throw new IllegalStateException("Race catalog must be a JSON array: " + resolved);
            }
            List<CatalogRace> races = objectMapper.convertValue(root, new TypeReference<List<CatalogRace>>() {});
            List<CatalogRace> sane = new ArrayList<>();
            for (CatalogRace race : races) {
                if (race == null) continue;
                if (race.id() == null || race.id().isBlank()) continue;
                sane.add(race);
            }
            return sane;
        } catch (RuntimeException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to read race catalog at " + resolved, ex);
        }
    }

    public Path defaultCatalogPath() {
        Path relative = Paths.get("..", "frontend", "src", "data", "worldRaceCatalog.json").toAbsolutePath().normalize();
        if (Files.isRegularFile(relative)) return relative;
        Path absolute = Paths.get("frontend", "src", "data", "worldRaceCatalog.json").toAbsolutePath().normalize();
        return absolute;
    }

    public record CatalogRace(
            String id,
            String name,
            String organization,
            String officialWebsite,
            String city,
            String country,
            String location,
            Double distanceKm,
            Integer month,
            String program,
            Double lat,
            Double lng,
            String heroImage
    ) {
        public Double latitude() { return lat; }
        public Double longitude() { return lng; }
    }

    public enum SeedOutcome {
        SEEDED,
        SKIPPED_HAS_REAL_MAP,
        SKIPPED_HAS_SYNTHETIC,
        FAILED
    }

    /** Which OSRM profile (and endpoint) to route through. */
    private enum OsrmProfile {
        /** Default driving profile via router.project-osrm.org — fast, but
         * picks freeways and ramps that aren't walkable. Used for the
         * generic city-loop synthetic seed where the route is a
         * decorative approximation. */
        DRIVING,
        /** Pedestrian profile via routing.openstreetmap.de/routed-foot —
         * routes through sidewalks, footpaths, and bridges with foot
         * lanes. Used for hand-curated official courses (NYC) where the
         * runtime polyline must stay walkable. */
        FOOT
    }

    public record BulkSeedSummary(int catalogSize, int seeded, int skipped, int failed) {}

    public record ElevationBackfillSummary(int totalAssets, int healed, int skipped, int failed) {}
}
