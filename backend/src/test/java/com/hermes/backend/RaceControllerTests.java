package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class RaceControllerTests {

    @Test
    void listRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        RaceController controller = createController(authService);

        ResponseEntity<?> response = controller.list(null);

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    @Test
    void savedStatusRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        RaceController controller = createController(authService);

        ResponseEntity<?> response = controller.savedStatus(null, "Boston Marathon");

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    @Test
    void savedStatusRejectsBlankRaceName() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        RaceController controller = createController(authService);

        ResponseEntity<?> response = controller.savedStatus("Bearer runner-token", "   ");

        assertError(response, HttpStatus.BAD_REQUEST, "Race name is required.");
    }

    @Test
    void savedStatusReturnsSavedRaceSummaryWhenRaceExists() {
        AuthService authService = mock(AuthService.class);
        RaceEventRepository raceEventRepository = mock(RaceEventRepository.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        Runner runner = runner();
        RaceEvent raceEvent = new RaceEvent();
        raceEvent.setId(42L);
        raceEvent.setRunner(runner);
        raceEvent.setName("Boston Marathon");
        raceEvent.setEventDate(LocalDate.now().plusMonths(1));
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(raceEventRepository.findFirstByRunnerAndNameIgnoreCaseOrderByEventDateAsc(runner, "Boston Marathon"))
                .thenReturn(Optional.of(raceEvent));
        RaceController controller = new RaceController(
                authService,
                raceEventRepository,
                activityRepository,
                mock(RaceOfficialImageService.class),
                mock(RaceElevationProfileService.class),
                mock(RaceCourseMapService.class)
        );

        ResponseEntity<?> response = controller.savedStatus("Bearer runner-token", "  Boston Marathon  ");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(RaceController.SavedRaceStatusResponse.class);
        RaceController.SavedRaceStatusResponse payload = (RaceController.SavedRaceStatusResponse) response.getBody();
        assertThat(payload.saved()).isTrue();
        assertThat(payload.raceId()).isEqualTo(42L);
        verify(raceEventRepository).findFirstByRunnerAndNameIgnoreCaseOrderByEventDateAsc(runner, "Boston Marathon");
        verifyNoInteractions(activityRepository);
    }

    @Test
    void savedStatusReturnsNotSavedWhenRaceDoesNotExist() {
        AuthService authService = mock(AuthService.class);
        RaceEventRepository raceEventRepository = mock(RaceEventRepository.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(raceEventRepository.findFirstByRunnerAndNameIgnoreCaseOrderByEventDateAsc(runner, "Boston Marathon"))
                .thenReturn(Optional.empty());
        RaceController controller = new RaceController(
                authService,
                raceEventRepository,
                activityRepository,
                mock(RaceOfficialImageService.class),
                mock(RaceElevationProfileService.class),
                mock(RaceCourseMapService.class)
        );

        ResponseEntity<?> response = controller.savedStatus("Bearer runner-token", "Boston Marathon");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(RaceController.SavedRaceStatusResponse.class);
        RaceController.SavedRaceStatusResponse payload = (RaceController.SavedRaceStatusResponse) response.getBody();
        assertThat(payload.saved()).isFalse();
        assertThat(payload.raceId()).isNull();
        verify(raceEventRepository).findFirstByRunnerAndNameIgnoreCaseOrderByEventDateAsc(runner, "Boston Marathon");
        verifyNoInteractions(activityRepository);
    }

    @Test
    void createRejectsMissingPayload() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        RaceController controller = createController(authService);

        ResponseEntity<?> response = controller.create("Bearer runner-token", null);

        assertError(response, HttpStatus.BAD_REQUEST, "Race payload is required.");
    }

    @Test
    void createRejectsUnsafeNotes() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        RaceController controller = createController(authService);

        ResponseEntity<?> response = controller.create(
                "Bearer runner-token",
                validRequest().withNotes("<script>alert(1)</script>").build()
        );

        assertError(response, HttpStatus.BAD_REQUEST, "notes contains invalid characters.");
    }

    @Test
    void createReturnsSavedRaceResponseForValidRequest() {
        AuthService authService = mock(AuthService.class);
        RaceEventRepository raceEventRepository = mock(RaceEventRepository.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(raceEventRepository.save(any(RaceEvent.class))).thenAnswer(invocation -> {
            RaceEvent saved = invocation.getArgument(0);
            saved.setId(33L);
            return saved;
        });
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of());
        RaceController controller = new RaceController(
                authService,
                raceEventRepository,
                activityRepository,
                mock(RaceOfficialImageService.class),
                mock(RaceElevationProfileService.class),
                mock(RaceCourseMapService.class)
        );

        ResponseEntity<?> response = controller.create(
                "Bearer runner-token",
                validRequest()
                        .withName("  Berlin Marathon  ")
                        .withRegistrationStatus("not-a-real-status")
                        .withNotes("  Goal race  ")
                        .build()
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(RaceController.RaceEventResponse.class);
        RaceController.RaceEventResponse payload = (RaceController.RaceEventResponse) response.getBody();
        assertThat(payload.id()).isEqualTo(33L);
        assertThat(payload.name()).isEqualTo("Berlin Marathon");
        assertThat(payload.registrationStatus()).isEqualTo("INTERESTED");
        assertThat(payload.notes()).isEqualTo("Goal race");
        assertThat(payload.completed()).isFalse();
        verify(raceEventRepository).save(any(RaceEvent.class));
    }

    @Test
    void updateReturnsNotFoundWhenRaceBelongsToAnotherRunner() {
        AuthService authService = mock(AuthService.class);
        RaceEventRepository raceEventRepository = mock(RaceEventRepository.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(raceEventRepository.findByIdAndRunner(88L, runner)).thenReturn(Optional.empty());
        RaceController controller = new RaceController(
                authService,
                raceEventRepository,
                mock(ActivityRepository.class),
                mock(RaceOfficialImageService.class),
                mock(RaceElevationProfileService.class),
                mock(RaceCourseMapService.class)
        );

        ResponseEntity<?> response = controller.update(88L, "Bearer runner-token", validRequest().build());

        assertError(response, HttpStatus.NOT_FOUND, "Race not found.");
    }

    @Test
    void officialImageReturnsBadRequestWhenResolverRejectsWebsite() {
        AuthService authService = mock(AuthService.class);
        RaceOfficialImageService raceOfficialImageService = mock(RaceOfficialImageService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(raceOfficialImageService.resolveOfficialImage("javascript:alert(1)"))
                .thenThrow(new IllegalArgumentException("officialWebsite must be an http or https URL."));
        RaceController controller = new RaceController(
                authService,
                mock(RaceEventRepository.class),
                mock(ActivityRepository.class),
                raceOfficialImageService,
                mock(RaceElevationProfileService.class),
                mock(RaceCourseMapService.class)
        );

        ResponseEntity<?> response = controller.officialImage("Bearer runner-token", "javascript:alert(1)");

        assertError(response, HttpStatus.BAD_REQUEST, "officialWebsite must be an http or https URL.");
    }

    @Test
    void elevationProfileRejectsBlankRaceName() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        RaceController controller = createController(authService);

        ResponseEntity<?> response = controller.elevationProfile("Bearer runner-token", "   ", "Boston", "United States", null);

        assertError(response, HttpStatus.BAD_REQUEST, "Race name is required.");
    }

    @Test
    void elevationProfileReturnsStableEmptyPayloadWhenResolverFailsUnexpectedly() {
        AuthService authService = mock(AuthService.class);
        RaceElevationProfileService raceElevationProfileService = mock(RaceElevationProfileService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(raceElevationProfileService.resolveProfile("Boston Marathon", "Boston", "United States", "https://www.baa.org"))
                .thenThrow(new RuntimeException("boom"));
        RaceController controller = new RaceController(
                authService,
                mock(RaceEventRepository.class),
                mock(ActivityRepository.class),
                mock(RaceOfficialImageService.class),
                raceElevationProfileService,
                mock(RaceCourseMapService.class)
        );

        ResponseEntity<?> response = controller.elevationProfile(
                "Bearer runner-token",
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org"
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) response.getBody();
        assertThat(payload)
                .containsEntry("imageUrl", "")
                .containsEntry("source", "")
                .containsEntry("localizedFallbackUsed", false)
                .containsEntry("profileSamples", List.of());
    }

    @Test
    void courseMapRejectsBlankRaceName() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        RaceController controller = createController(authService);

        ResponseEntity<?> response = controller.courseMap("Bearer runner-token", null, "   ", "Boston", "United States", null, 42.36, -71.05, 42.195);

        assertError(response, HttpStatus.BAD_REQUEST, "Race name is required.");
    }

    @Test
    void courseMapReturnsAlignedPayloadWhenResolverSucceeds() {
        AuthService authService = mock(AuthService.class);
        RaceCourseMapService raceCourseMapService = mock(RaceCourseMapService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(raceCourseMapService.resolveCourseMap(
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org",
                42.36,
                -71.05,
                42.195
        )).thenReturn(new RaceCourseMapResult(
                "https://cdn.example.com/boston-course-map.png",
                "official-page:https://www.baa.org/course",
                true,
                81,
                "Aligned the official course map onto central Boston.",
                new OverlayBounds(42.41, 42.29, -70.97, -71.18),
                List.of(
                        new RoutePoint(42.349, -71.078, "Start"),
                        new RoutePoint(42.360, -71.058, "Finish")
                ),
                List.of(12, 15, 18, 16),
                22,
                true
        ));
        when(raceCourseMapService.materializePreviewImageUrl("https://cdn.example.com/boston-course-map.png"))
                .thenReturn("data:image/png;base64,runner-preview");
        when(raceCourseMapService.materializeTransparentOverlayImageUrl("https://cdn.example.com/boston-course-map.png"))
                .thenReturn("data:image/png;base64,transparent-overlay");
        RaceController controller = new RaceController(
                authService,
                mock(RaceEventRepository.class),
                mock(ActivityRepository.class),
                mock(RaceOfficialImageService.class),
                mock(RaceElevationProfileService.class),
                raceCourseMapService
        );

        ResponseEntity<?> response = controller.courseMap(
                "Bearer runner-token",
                null,
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org",
                42.36,
                -71.05,
                42.195
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) response.getBody();
        assertThat(payload)
                .containsEntry("routeAvailable", true)
                .containsEntry("confidence", 81)
                .containsEntry("totalClimbMeters", 22)
                .containsEntry("aiAssisted", true);
        assertThat(payload)
                .containsEntry("imageUrl", "https://cdn.example.com/boston-course-map.png")
                .containsEntry("previewImageUrl", "data:image/png;base64,runner-preview")
                .containsEntry("overlayImageUrl", "data:image/png;base64,transparent-overlay");
        assertThat(payload.get("routePoints")).isInstanceOf(List.class);
        assertThat(payload.get("viewportBounds")).isInstanceOf(OverlayBounds.class);
    }

    @Test
    void courseMapPreservesPreviewImageWhenOnlyCandidateImageExists() {
        AuthService authService = mock(AuthService.class);
        RaceCourseMapService raceCourseMapService = mock(RaceCourseMapService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(raceCourseMapService.resolveCourseMap(
                "Tokyo Marathon",
                "Tokyo",
                "Japan",
                "https://www.marathon.tokyo/en/",
                35.6762,
                139.6503,
                42.195
        )).thenReturn(new RaceCourseMapResult(
                "https://legacyhalf.tokyo/en/about/img/about-course-map_02_e.png",
                "Tokyo Marathon course map",
                false,
                0,
                "AI course-map alignment is not configured.",
                null,
                List.of(),
                List.of(),
                null,
                false
        ));
        when(raceCourseMapService.materializePreviewImageUrl("https://legacyhalf.tokyo/en/about/img/about-course-map_02_e.png"))
                .thenReturn("data:image/png;base64,tokyo-preview");
        RaceController controller = new RaceController(
                authService,
                mock(RaceEventRepository.class),
                mock(ActivityRepository.class),
                mock(RaceOfficialImageService.class),
                mock(RaceElevationProfileService.class),
                raceCourseMapService
        );

        ResponseEntity<?> response = controller.courseMap(
                "Bearer runner-token",
                null,
                "Tokyo Marathon",
                "Tokyo",
                "Japan",
                "https://www.marathon.tokyo/en/",
                35.6762,
                139.6503,
                42.195
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) response.getBody();
        assertThat(payload)
                .containsEntry("imageUrl", "https://legacyhalf.tokyo/en/about/img/about-course-map_02_e.png")
                .containsEntry("previewImageUrl", "data:image/png;base64,tokyo-preview")
                .containsEntry("routeAvailable", false)
                .containsEntry("confidence", 0)
                .containsEntry("summary", "AI course-map alignment is not configured.");
        assertThat(payload.get("routePoints")).isEqualTo(List.of());
        assertThat(payload.get("viewportBounds")).isNull();
    }

    @Test
    void courseMapReturnsStableEmptyPayloadWhenResolverFailsUnexpectedly() {
        AuthService authService = mock(AuthService.class);
        RaceCourseMapService raceCourseMapService = mock(RaceCourseMapService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(raceCourseMapService.resolveCourseMap(
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org",
                42.36,
                -71.05,
                42.195
        )).thenThrow(new RuntimeException("boom"));
        RaceController controller = new RaceController(
                authService,
                mock(RaceEventRepository.class),
                mock(ActivityRepository.class),
                mock(RaceOfficialImageService.class),
                mock(RaceElevationProfileService.class),
                raceCourseMapService
        );

        ResponseEntity<?> response = controller.courseMap(
                "Bearer runner-token",
                null,
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org",
                42.36,
                -71.05,
                42.195
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) response.getBody();
        assertThat(payload)
                .containsEntry("imageUrl", "")
                .containsEntry("previewImageUrl", "")
                .containsEntry("overlayImageUrl", "")
                .containsEntry("source", "")
                .containsEntry("routeAvailable", false)
                .containsEntry("confidence", 0)
                .containsEntry("summary", "")
                .containsEntry("routePoints", List.of())
                .containsEntry("elevationSamples", List.of())
                .containsEntry("aiAssisted", false);
        assertThat(payload).containsKey("viewportBounds");
        assertThat(payload).containsKey("totalClimbMeters");
    }

    private RaceController createController(AuthService authService) {
        return new RaceController(
                authService,
                mock(RaceEventRepository.class),
                mock(ActivityRepository.class),
                mock(RaceOfficialImageService.class),
                mock(RaceElevationProfileService.class),
                mock(RaceCourseMapService.class)
        );
    }

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(11L);
        runner.setEmail("runner@hermes.test");
        runner.setRole("USER");
        return runner;
    }

    private RaceRequestBuilder validRequest() {
        return new RaceRequestBuilder();
    }

    @SuppressWarnings("unchecked")
    private void assertError(ResponseEntity<?> response, HttpStatus expectedStatus, String expectedMessage) {
        assertThat(response.getStatusCode()).isEqualTo(expectedStatus);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        assertThat((Map<String, String>) response.getBody()).containsEntry("error", expectedMessage);
    }

    private static final class RaceRequestBuilder {
        private String name = "Boston Marathon";
        private String organization = "BAA";
        private String location = "Boston, United States";
        private LocalDate eventDate = LocalDate.now().plusMonths(6);
        private Double distanceKm = 42.195;
        private String registrationStatus = "REGISTERED";
        private Integer goalTimeSeconds = 10800;
        private String notes = "Target build";
        private Boolean nyrrNinePlusOneEligible = false;
        private Long completedActivityId = null;

        private RaceRequestBuilder withName(String name) {
            this.name = name;
            return this;
        }

        private RaceRequestBuilder withRegistrationStatus(String registrationStatus) {
            this.registrationStatus = registrationStatus;
            return this;
        }

        private RaceRequestBuilder withNotes(String notes) {
            this.notes = notes;
            return this;
        }

        private RaceController.RaceEventRequest build() {
            return new RaceController.RaceEventRequest(
                    name,
                    organization,
                    location,
                    eventDate,
                    distanceKm,
                    registrationStatus,
                    goalTimeSeconds,
                    notes,
                    nyrrNinePlusOneEligible,
                    completedActivityId
            );
        }
    }
}
