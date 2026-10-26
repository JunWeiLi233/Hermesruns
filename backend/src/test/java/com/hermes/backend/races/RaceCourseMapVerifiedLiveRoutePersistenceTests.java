package com.hermes.backend.races;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.infrastructure.web.SafeUrlExecutor;
import com.hermes.backend.routing.RoutePoint;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;

/** Exercises committed JPA state and the real managed artifact, without a test-wide rollback transaction. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:verified-live-route-persistence;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class RaceCourseMapVerifiedLiveRoutePersistenceTests {
    private static final String RACE_ID = "tokyo-marathon";
    private static final String LIVE_IMAGE = "local-course-map:previous-tokyo.png";
    private static final String PENDING_IMAGE = "local-course-map:pending-tokyo.png";
    private static final String REVIEWER = "synthetic-reviewer@hermes.test";
    private static final List<String> LIVE_COLUMNS = List.of(
            "live_image_url", "live_source", "live_confidence", "live_summary",
            "live_overlay_bounds_json", "live_route_points_json", "live_elevation_samples_json",
            "live_total_climb_meters", "live_ai_assisted", "live_updated_at", "live_updated_by_email",
            "local_route_artifact_ref", "local_route_updated_at", "local_route_updated_by_email");

    @TempDir static Path managedDirectory;

    @DynamicPropertySource
    static void managedCourseStorage(DynamicPropertyRegistry properties) {
        properties.add("app.course-map.upload-dir", () -> managedDirectory.toAbsolutePath().toString());
    }

    @Autowired private RaceCourseMapService courses;
    @Autowired private RaceCourseMapAssetRepository assets;
    @Autowired private RaceCourseMapImageService images;
    @Autowired private RaceCourseMapBulkSeedService seeds;
    @Autowired private ObjectMapper json;
    @Autowired private JdbcTemplate database;

    // Persistence, source hashing, geometry, review, publish and file writes remain real.
    @MockitoBean private SafeUrlExecutor externalHttp;
    @MockitoBean private RestTemplate externalRest;
    @MockitoBean private QwenCourseMapAlignmentClient externalAi;
    @MockitoBean private OsrmMapMatchingClient externalRouting;

    private RaceCourseMapResult expectedPending;
    private List<RoutePoint> previousLivePoints;
    private Path liveArtifact;

    @BeforeEach
    void seedOnlyDisposablePersistenceAndManagedFiles() throws Exception {
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
        assertThat(database.getDataSource()).isNotNull();
        try (var connection = database.getDataSource().getConnection()) {
            assertThat(connection.getMetaData().getURL())
                    .startsWith("jdbc:h2:mem:verified-live-route-persistence");
        }
        assets.deleteAllInBatch();
        byte[] source;
        try (var stream = getClass().getResourceAsStream("/course-maps/tokyo-2026.png")) {
            assertThat(stream).isNotNull();
            source = stream.readAllBytes();
        }
        Files.write(managedDirectory.resolve("previous-tokyo.png"), source);
        Files.write(managedDirectory.resolve("pending-tokyo.png"), source);
        expectedPending = VerifiedCourseMapReference.match(source, "Tokyo Marathon", "Tokyo", "Japan", 42.195)
                .orElseThrow().preview(PENDING_IMAGE);
        assertThat(expectedPending.routePoints()).hasSize(600);
        var reduced = new ArrayList<RoutePoint>();
        for (int index = 0; index < expectedPending.routePoints().size(); index += 2) {
            reduced.add(expectedPending.routePoints().get(index));
        }
        reduced.add(expectedPending.routePoints().get(expectedPending.routePoints().size() - 1));
        previousLivePoints = List.copyOf(reduced);

        LocalDateTime publishedAt = LocalDateTime.of(2026, 9, 1, 12, 0);
        var asset = new RaceCourseMapAsset();
        asset.setRaceId(RACE_ID);
        asset.setRaceName("Tokyo Marathon");
        asset.setCity("Tokyo");
        asset.setCountry("Japan");
        asset.setOfficialWebsite("https://www.marathon.tokyo/");
        asset.setLatitude(35.6762);
        asset.setLongitude(139.6503);
        asset.setDistanceKm(42.195);
        asset.setLiveImageUrl(LIVE_IMAGE);
        asset.setLiveSource(expectedPending.source());
        asset.setLiveConfidence(73);
        asset.setLiveSummary("Previously published synthetic source-bound route.");
        asset.setLiveOverlayBoundsJson(json.writeValueAsString(expectedPending.overlayBounds()));
        asset.setLiveRoutePointsJson(json.writeValueAsString(previousLivePoints));
        asset.setLiveElevationSamplesJson(json.writeValueAsString(expectedPending.elevationSamples()));
        asset.setLiveTotalClimbMeters(expectedPending.totalClimbMeters());
        asset.setLiveAiAssisted(false);
        asset.setLiveUpdatedAt(publishedAt);
        asset.setLiveUpdatedByEmail("synthetic-publisher@hermes.test");
        String artifactReference = images.replaceSuccessfulCourseMapRoute(RACE_ID, null,
                json.writeValueAsString(Map.of("imageUrl", LIVE_IMAGE, "source", expectedPending.source(),
                        "confidence", 73, "routePoints", previousLivePoints)));
        asset.setLocalRouteArtifactRef(artifactReference);
        asset.setLocalRouteUpdatedAt(publishedAt);
        asset.setLocalRouteUpdatedByEmail("synthetic-publisher@hermes.test");
        liveArtifact = managedDirectory.resolve("routes")
                .resolve(artifactReference.substring("local-course-map-route:".length()));
        assertThat(liveArtifact.toAbsolutePath().normalize()).startsWith(managedDirectory.toAbsolutePath().normalize());
        asset.setPendingImageUrl(PENDING_IMAGE);
        asset.setPendingSource("admin-upload");
        asset.setPendingConfidence(0);
        asset.setPendingSummary("Synthetic upload awaiting reanalysis.");
        asset.setPendingRoutePointsJson("[]");
        asset.setPendingElevationSamplesJson("[]");
        asset.setPendingAiAssisted(false);
        asset.setPendingUpdatedAt(publishedAt);
        asset.setPendingUpdatedByEmail(REVIEWER);
        assets.saveAndFlush(asset);
        assertThat(assets.count()).isEqualTo(1);
    }

    @Test
    void overwriteSeedForActualTokyoIdPreservesEveryCommittedLiveColumnAndArtifact() throws Exception {
        Map<String, String> previouslyCommittedLive = committedLive();
        byte[] previousArtifact = Files.readAllBytes(liveArtifact);
        var race = new RaceCourseMapBulkSeedService.CatalogRace(RACE_ID, "Tokyo Marathon", "Tokyo Marathon",
                "https://www.marathon.tokyo/", "Tokyo", "Japan", "Tokyo, Japan", 42.195, 3, "",
                35.6762, 139.6503, "");

        assertThat(seeds.seedRace(race, "startup-seeder", true))
                .isEqualTo(RaceCourseMapBulkSeedService.SeedOutcome.SKIPPED_HAS_REAL_MAP);

        assertThat(committedLive()).isEqualTo(previouslyCommittedLive);
        assertThat(Files.readAllBytes(liveArtifact)).isEqualTo(previousArtifact);
        assertThat(savedAsset().getPendingImageUrl()).isEqualTo(PENDING_IMAGE);
        verifyNoInteractions(externalHttp, externalRest, externalAi, externalRouting);
    }

    @Test
    void reanalysisAndReviewPreserveCommittedLiveRouteUntilExplicitPublish() throws Exception {
        Map<String, String> previouslyCommittedLive = committedLive();
        byte[] previousArtifact = Files.readAllBytes(liveArtifact);

        RaceCourseMapResult analyzed = reanalyze();

        assertThat(analyzed).isEqualTo(expectedPending);
        assertThat(committedLive()).isEqualTo(previouslyCommittedLive);
        assertThat(Files.readAllBytes(liveArtifact)).isEqualTo(previousArtifact);
        RaceCourseMapAsset staged = savedAsset();
        assertPendingEqualsExpected(staged);
        assertThat(staged.getPendingUpdatedAt()).isAfter(staged.getLiveUpdatedAt());
        assertThat(staged.getPendingUpdatedByEmail()).isEqualTo(REVIEWER);
        assertThat(json.readTree(staged.getPendingRoutePointsJson()))
                .isNotEqualTo(json.readTree(staged.getLiveRoutePointsJson()));

        RaceCourseMapAdminDetail reviewed = courses.getAdminDetail(RACE_ID);

        assertThat(reviewed.live().routePoints()).isEqualTo(previousLivePoints);
        assertThat(reviewed.currentLivePreview()).isEqualTo(reviewed.live());
        assertThat(reviewed.live().confidence()).isEqualTo(73);
        assertThat(reviewed.live().sourceAvailable()).isTrue();
        assertThat(reviewed.pendingPreview().routePoints()).isEqualTo(expectedPending.routePoints());
        assertThat(reviewed.pendingPreview().sourceAvailable()).isTrue();
        assertThat(reviewed.pendingPreview().alignmentAccepted()).isTrue();
        assertThat(committedLive()).isEqualTo(previouslyCommittedLive);
        assertThat(Files.readAllBytes(liveArtifact)).isEqualTo(previousArtifact);
        assertPendingEqualsExpected(savedAsset());

        courses.acceptPendingCourseMap(RACE_ID, REVIEWER);

        RaceCourseMapAsset published = savedAsset();
        Map<String, String> committedPublished = committedLive();
        assertThat(committedPublished.get("live_route_points_json")).isEqualTo(staged.getPendingRoutePointsJson());
        assertThat(committedPublished.get("live_source")).isEqualTo(staged.getPendingSource());
        assertThat(committedPublished.get("live_confidence")).isEqualTo("90");
        assertThat(published.getLiveImageUrl()).isEqualTo(PENDING_IMAGE);
        assertThat(published.getLiveSummary()).isEqualTo(expectedPending.summary());
        assertThat(published.getLiveOverlayBoundsJson()).isEqualTo(staged.getPendingOverlayBoundsJson());
        assertThat(published.getLiveElevationSamplesJson()).isEqualTo(staged.getPendingElevationSamplesJson());
        assertThat(published.getLiveTotalClimbMeters()).isEqualTo(staged.getPendingTotalClimbMeters());
        assertThat(published.getLiveAiAssisted()).isFalse();
        assertThat(published.getLiveUpdatedByEmail()).isEqualTo(REVIEWER);
        assertThat(published.getLocalRouteUpdatedByEmail()).isEqualTo(REVIEWER);
        assertThat(published.getLocalRouteUpdatedAt()).isEqualTo(published.getLiveUpdatedAt());
        assertThat(published.getPendingImageUrl()).isNull();
        assertThat(published.getPendingRoutePointsJson()).isNull();
        assertThat(published.getPendingConfidence()).isNull();
        assertThat(published.getPendingSource()).isNull();
        assertThat(published.getLocalRouteArtifactRef()).isEqualTo(staged.getLocalRouteArtifactRef());
        byte[] publishedArtifact = Files.readAllBytes(liveArtifact);
        assertThat(publishedArtifact).isNotEqualTo(previousArtifact);
        var artifact = json.readTree(publishedArtifact);
        assertThat(artifact.path("routePoints")).isEqualTo(json.valueToTree(expectedPending.routePoints()));
        assertThat(artifact.path("imageUrl").asText()).isEqualTo(PENDING_IMAGE);
        assertThat(artifact.path("source").asText()).isEqualTo(expectedPending.source());
        assertThat(artifact.path("confidence").asInt()).isEqualTo(90);
        assertThat(artifact.path("updatedByEmail").asText()).isEqualTo(REVIEWER);
        verifyNoInteractions(externalHttp, externalRest, externalAi, externalRouting);
    }

    @Test
    void missingPendingSourceBlocksPublishWithoutChangingCommittedLiveRouteOrArtifact() throws Exception {
        reanalyze();
        Map<String, String> previouslyCommittedLive = committedLive();
        byte[] previousArtifact = Files.readAllBytes(liveArtifact);
        Files.delete(managedDirectory.resolve("pending-tokyo.png"));

        assertThatThrownBy(() -> courses.acceptPendingCourseMap(RACE_ID, REVIEWER))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("race_course_map_pending_missing");

        assertThat(committedLive()).isEqualTo(previouslyCommittedLive);
        assertThat(Files.readAllBytes(liveArtifact)).isEqualTo(previousArtifact);
        assertPendingEqualsExpected(savedAsset());
        assertThat(courses.getAdminDetail(RACE_ID).pendingPreview().sourceAvailable()).isFalse();
        assertThat(committedLive()).isEqualTo(previouslyCommittedLive);
        verifyNoInteractions(externalHttp, externalRest, externalAi, externalRouting);
    }

    private RaceCourseMapResult reanalyze() {
        return courses.reanalyzePendingCourseMap(RACE_ID, "Tokyo Marathon", "Tokyo", "Japan",
                "https://www.marathon.tokyo/", 35.6762, 139.6503, 42.195, REVIEWER);
    }

    private RaceCourseMapAsset savedAsset() {
        return assets.findByRaceId(RACE_ID).orElseThrow();
    }

    private void assertPendingEqualsExpected(RaceCourseMapAsset asset) throws Exception {
        assertThat(asset.getPendingImageUrl()).isEqualTo(expectedPending.imageUrl());
        assertThat(asset.getPendingSource()).isEqualTo(expectedPending.source());
        assertThat(asset.getPendingConfidence()).isEqualTo(expectedPending.confidence());
        assertThat(asset.getPendingSummary()).isEqualTo(expectedPending.summary());
        assertThat(json.readTree(asset.getPendingRoutePointsJson())).isEqualTo(json.valueToTree(expectedPending.routePoints()));
    }

    /** An independent JDBC read observes repository commits, not a cached entity or mutated service return value. */
    private Map<String, String> committedLive() {
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
        return database.queryForObject("select " + String.join(", ", LIVE_COLUMNS)
                + " from race_course_map_asset where race_id = ?", (row, index) -> {
                    Map<String, String> live = new LinkedHashMap<>();
                    for (String column : LIVE_COLUMNS) live.put(column, row.getString(column));
                    return live;
                }, RACE_ID);
    }
}
