package com.hermes.backend.imports;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityDataAccess;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.DeletedActivityTombstoneRepository;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.coaching.AutomatedCoachService;
import com.hermes.backend.runner.AccountDeletionService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.AdditionalAnswers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Disconnecting Strava has to end with the runner disconnected and none of their Strava-sourced runs
 * left, or not have happened at all, even with a sync running at the same moment or a part of the work
 * failing. After a disconnect nothing else would ever remove a leftover run.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:strava-disconnect-race;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class StravaDisconnectRaceTests {

    private static final String ACTIVITY_URL = "https://www.strava.com/api/v3/activities/777";

    @Autowired private StravaSyncService sync;
    @Autowired private AccountDeletionService accountDeletion;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private DeletedActivityTombstoneRepository tombstones;
    @MockitoBean private StravaTokenService tokens;
    @MockitoSpyBean private StravaAccountService accounts;
    @MockitoSpyBean private ActivityDataAccess data;
    @MockitoSpyBean private AutomatedCoachService coach;

    private final RestTemplate restTemplate = mock(RestTemplate.class);

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static HttpEntity<?> anyHttpEntity() {
        return (HttpEntity) any(HttpEntity.class);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static <T> ParameterizedTypeReference<T> anyTypeRef() {
        return (ParameterizedTypeReference) any(ParameterizedTypeReference.class);
    }

    @BeforeEach
    void wire() {
        ReflectionTestUtils.setField(sync, "restTemplate", restTemplate);
        sync.setDeletedActivityTombstones(tombstones);
        when(tokens.resolveRunnerStravaAccessToken(any())).thenReturn("access");
        when(tokens.isRunnerStravaLinked(any())).thenAnswer(call -> {
            Runner runner = call.getArgument(0);
            return runner.getStravaAthleteId() != null
                    && runner.getStravaRefreshToken() != null && !runner.getStravaRefreshToken().isBlank();
        });
    }

    @AfterEach
    void restore() {
        sync.setDeletedActivityTombstones(tombstones);
    }

    private Runner linkedRunner() {
        Runner runner = new Runner("race-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setStravaAthleteId(Math.abs(UUID.randomUUID().getMostSignificantBits() % 1_000_000_000L));
        runner.setStravaAccessToken("access");
        runner.setStravaRefreshToken("refresh");
        runner.setStravaTokenExpiresAt(1_900_000_000L);
        return runners.saveAndFlush(runner);
    }

    private Activity apiRun(Runner owner, String stravaId) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + stravaId);
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.STRAVA);
        run.setStravaId(stravaId);
        run.setSourceChecksum("STRAVA_" + stravaId);
        run.setStravaApiSourced(true);
        run.setDistanceKm(5);
        return activities.saveAndFlush(run);
    }

    private void stravaReturnsOneRun() {
        Map<String, Object> run = Map.of(
                "id", 777L, "name", "Run 777", "type", "Run", "sport_type", "Run",
                "distance", 5000d, "moving_time", 1500L, "start_date_local", "2026-10-01T08:00:00Z");
        when(restTemplate.exchange(eq(ACTIVITY_URL), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(run));
    }

    private Runner reload(Runner runner) {
        return runners.findById(runner.getId()).orElseThrow();
    }

    // --- a sync running at the same moment ------------------------------------------------------------------

    @Test
    void aDisconnectWhileTheSyncWaitsOnStravaForGpsLeavesNoStravaRunBehind() {
        Runner owner = linkedRunner();
        stravaReturnsOneRun();
        // The run has been saved and the sync is waiting on Strava for its GPS stream when the runner
        // disconnects; the stream then comes back empty, so the sync goes on to update the run it saved.
        when(restTemplate.exchange(argThat((String url) -> url != null && url.startsWith(ACTIVITY_URL + "/streams")),
                eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenAnswer(call -> {
                    accounts.unlink(owner);
                    return ResponseEntity.ok(List.of());
                });

        sync.syncStravaActivityById(owner, 777L);

        assertThat(activities.findStravaApiSourcedIds(owner))
                .as("Strava-sourced runs still stored after the runner disconnected")
                .isEmpty();
        assertThat(reload(owner).getStravaRefreshToken()).isNull();
    }

    @Test
    void aDisconnectBetweenTheSyncsLastCheckAndItsWriteStillLeavesNoStravaRunBehind() {
        Runner owner = linkedRunner();
        stravaReturnsOneRun();
        // The sync has passed its last "was I told to stop?" check when the disconnect, sweeps and all,
        // runs to completion; only then does the sync write the run it was about to save.
        DeletedActivityTombstoneRepository stalled = mock(DeletedActivityTombstoneRepository.class,
                AdditionalAnswers.delegatesTo(tombstones));
        doAnswer(call -> {
            accounts.unlink(owner);
            return false;
        }).when(stalled).existsByRunnerAndProviderAndExternalId(any(), any(), any());
        sync.setDeletedActivityTombstones(stalled);

        sync.syncStravaActivityById(owner, 777L);

        assertThat(activities.findStravaApiSourcedIds(owner))
                .as("a run written after the disconnect finished sweeping")
                .isEmpty();
        assertThat(reload(owner).getStravaRefreshToken()).isNull();
    }

    @Test
    void aSyncThatFinishesAfterTheRunnerConnectedAgainKeepsItsRuns() {
        Runner owner = linkedRunner();
        stravaReturnsOneRun();
        // The runner disconnects and reconnects while the sync is part-way through: the link is back, so
        // the run the sync writes belongs to the new connection and must stay.
        DeletedActivityTombstoneRepository stalled = mock(DeletedActivityTombstoneRepository.class,
                AdditionalAnswers.delegatesTo(tombstones));
        doAnswer(call -> {
            accounts.unlink(owner);
            Runner again = reload(owner);
            again.setStravaAthleteId(owner.getStravaAthleteId() == null ? 4242L : owner.getStravaAthleteId());
            again.setStravaRefreshToken("new-refresh");
            runners.saveAndFlush(again);
            return false;
        }).when(stalled).existsByRunnerAndProviderAndExternalId(any(), any(), any());
        sync.setDeletedActivityTombstones(stalled);

        sync.syncStravaActivityById(owner, 777L);

        assertThat(activities.findStravaApiSourcedIds(owner)).hasSize(1);
    }

    // --- part of the work failing ---------------------------------------------------------------------------

    @Test
    void aFailureWhilePurgingLeavesTheRunnerConnectedAndTheirRunsInPlace() {
        Runner owner = linkedRunner();
        apiRun(owner, "1");
        apiRun(owner, "2");
        doThrow(new IllegalStateException("database went away")).doCallRealMethod().when(data).purgeActivities(any(), any());

        assertThatThrownBy(() -> accounts.unlink(reload(owner))).isInstanceOf(IllegalStateException.class);

        assertThat(reload(owner).getStravaRefreshToken()).as("still connected, so the runner can try again").isNotNull();
        assertThat(activities.findStravaApiSourcedIds(owner)).hasSize(2);

        StravaAccountService.UnlinkResult retry = accounts.unlink(reload(owner));

        assertThat(retry.removedActivities()).isEqualTo(2);
        assertThat(reload(owner).getStravaRefreshToken()).isNull();
        assertThat(activities.findStravaApiSourcedIds(owner)).isEmpty();
    }

    @Test
    void aFailingCoachRefreshDoesNotBlockOrUndoTheDisconnect() {
        Runner owner = linkedRunner();
        apiRun(owner, "1");
        doThrow(new IllegalStateException("coach is down")).when(coach).reaggregateRunner(any());

        StravaAccountService.UnlinkResult result = accounts.unlink(reload(owner));

        assertThat(result.removedActivities()).isEqualTo(1);
        assertThat(reload(owner).getStravaRefreshToken()).isNull();
        assertThat(activities.findStravaApiSourcedIds(owner)).isEmpty();
    }

    @Test
    void deletingAnAccountDoesNotDependOnTellingStrava() {
        Runner owner = linkedRunner();
        apiRun(owner, "1");
        doThrow(new IllegalStateException("strava bookkeeping failed")).when(accounts).revokeAndStopSync(any());

        accountDeletion.deleteAccount(owner.getId());

        verify(accounts).revokeAndStopSync(any());
        assertThat(runners.findById(owner.getId())).isEmpty();
        assertThat(activities.findAll()).noneMatch(run -> run.getRunner() != null && owner.getId().equals(run.getRunner().getId()));
    }
}
