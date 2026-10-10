package com.hermes.backend.imports;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.DeletedActivityTombstone;
import com.hermes.backend.activity.DeletedActivityTombstoneRepository;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Disconnect, revocation and retention against a real schema, with Strava itself mocked. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:strava-account-service;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@RecordApplicationEvents
class StravaAccountServiceIntegrationTests {

    @Autowired private StravaAccountService accounts;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private DeletedActivityTombstoneRepository tombstones;
    @Autowired private ApplicationEvents events;
    @MockitoBean private StravaTokenService tokenService;

    private Runner linkedRunner() {
        Runner runner = new Runner("account-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setStravaAthleteId(Math.abs(UUID.randomUUID().getMostSignificantBits() % 1_000_000_000L));
        runner.setStravaUsername("someone");
        runner.setStravaAccessToken("access");
        runner.setStravaRefreshToken("refresh");
        runner.setStravaTokenExpiresAt(1_900_000_000L);
        runner.setStravaListCursorEpoch(1_700_000_000L);
        return runners.saveAndFlush(runner);
    }

    private Activity run(Runner owner, ImportProvider provider, String stravaId, String checksum, boolean apiSourced) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + checksum);
        run.setActivityType(ActivityType.RUN);
        run.setProvider(provider);
        run.setStravaId(stravaId);
        run.setSourceChecksum(checksum);
        run.setStravaApiSourced(apiSourced);
        run.setDistanceKm(5);
        return activities.saveAndFlush(run);
    }

    private Activity apiRun(Runner owner, String stravaId) {
        return run(owner, ImportProvider.STRAVA, stravaId, "STRAVA_" + stravaId, true);
    }

    private Activity garminRun(Runner owner) {
        return run(owner, ImportProvider.GARMIN, null, "GARMIN_" + UUID.randomUUID(), false);
    }

    private Activity stravaExportFileRun(Runner owner) {
        return run(owner, ImportProvider.STRAVA, null, "e".repeat(64), false);
    }

    @Test
    void unlinkRevokesClearsTheLinkAndDeletesOnlyTheRunsThatCameFromTheApi() {
        Runner owner = linkedRunner();
        Activity api1 = apiRun(owner, "1");
        Activity api2 = apiRun(owner, "2");
        Activity garmin = garminRun(owner);
        Activity exported = stravaExportFileRun(owner);
        tombstones.saveAndFlush(new DeletedActivityTombstone(owner, "STRAVA", "777"));
        when(tokenService.revokeAtStrava(any())).thenReturn(true);

        StravaAccountService.UnlinkResult result = accounts.unlink(owner);

        assertThat(result.revokedAtStrava()).isTrue();
        assertThat(result.removedActivities()).isEqualTo(2);
        assertThat(activities.findById(api1.getId())).isEmpty();
        assertThat(activities.findById(api2.getId())).isEmpty();
        assertThat(activities.findById(garmin.getId())).as("a run from the runner's own file stays").isPresent();
        assertThat(activities.findById(exported.getId())).as("a Strava export the runner imported stays").isPresent();
        assertThat(tombstones.countByRunner(owner)).isZero();

        Runner reloaded = runners.findById(owner.getId()).orElseThrow();
        assertThat(reloaded.getStravaAthleteId()).isNull();
        assertThat(reloaded.getStravaUsername()).isNull();
        assertThat(reloaded.getStravaAccessToken()).isNull();
        assertThat(reloaded.getStravaRefreshToken()).isNull();
        assertThat(reloaded.getStravaTokenExpiresAt()).isNull();
        assertThat(reloaded.getStravaListCursorEpoch()).isNull();
        assertThat(events.stream(StravaAccountUnlinkedEvent.class))
                .anyMatch(event -> owner.getId().equals(event.runnerId()));
    }

    @Test
    void unlinkStillDisconnectsAndDeletesWhenStravaCannotBeReached() {
        Runner owner = linkedRunner();
        Activity api = apiRun(owner, "11");
        when(tokenService.revokeAtStrava(any())).thenReturn(false);

        StravaAccountService.UnlinkResult result = accounts.unlink(owner);

        assertThat(result.revokedAtStrava()).isFalse();
        assertThat(result.removedActivities()).isEqualTo(1);
        assertThat(activities.findById(api.getId())).isEmpty();
        assertThat(runners.findById(owner.getId()).orElseThrow().getStravaRefreshToken()).isNull();
    }

    @Test
    void unlinkingTwiceIsHarmless() {
        Runner owner = linkedRunner();
        apiRun(owner, "21");
        when(tokenService.revokeAtStrava(any())).thenReturn(true);

        accounts.unlink(owner);
        StravaAccountService.UnlinkResult second = accounts.unlink(owner);

        assertThat(second.removedActivities()).isZero();
    }

    @Test
    void aRunnerWithNoStravaRunsCanDisconnectToo() {
        Runner owner = linkedRunner();
        Activity garmin = garminRun(owner);

        StravaAccountService.UnlinkResult result = accounts.unlink(owner);

        assertThat(result.removedActivities()).isZero();
        assertThat(activities.findById(garmin.getId())).isPresent();
    }

    @Test
    void aConfirmedRevocationPurgesTheRunnersStravaData() {
        Runner owner = linkedRunner();
        Activity api = apiRun(owner, "31");
        Activity garmin = garminRun(owner);
        when(tokenService.isRunnerStravaLinked(any())).thenReturn(true);
        when(tokenService.probeAuthorization(any())).thenReturn(StravaTokenService.AuthorizationState.REVOKED);

        StravaAccountService.RevocationOutcome outcome = accounts.confirmRevocationAndPurge(owner.getId());

        assertThat(outcome).isEqualTo(StravaAccountService.RevocationOutcome.PURGED);
        assertThat(activities.findById(api.getId())).isEmpty();
        assertThat(activities.findById(garmin.getId())).isPresent();
        assertThat(runners.findById(owner.getId()).orElseThrow().getStravaRefreshToken()).isNull();
        verify(tokenService, never()).revokeAtStrava(any());
    }

    @Test
    void anAuthorizationThatStillStandsDeletesNothing() {
        Runner owner = linkedRunner();
        Activity api = apiRun(owner, "41");
        when(tokenService.isRunnerStravaLinked(any())).thenReturn(true);
        when(tokenService.probeAuthorization(any())).thenReturn(StravaTokenService.AuthorizationState.ACTIVE);

        assertThat(accounts.confirmRevocationAndPurge(owner.getId()))
                .isEqualTo(StravaAccountService.RevocationOutcome.STILL_AUTHORIZED);

        assertThat(activities.findById(api.getId())).isPresent();
        assertThat(runners.findById(owner.getId()).orElseThrow().getStravaRefreshToken()).isEqualTo("refresh");
    }

    @Test
    void anInconclusiveAnswerDeletesNothing() {
        Runner owner = linkedRunner();
        Activity api = apiRun(owner, "51");
        when(tokenService.isRunnerStravaLinked(any())).thenReturn(true);
        when(tokenService.probeAuthorization(any())).thenReturn(StravaTokenService.AuthorizationState.UNKNOWN);

        assertThat(accounts.confirmRevocationAndPurge(owner.getId()))
                .isEqualTo(StravaAccountService.RevocationOutcome.INCONCLUSIVE);

        assertThat(activities.findById(api.getId())).isPresent();
    }

    @Test
    void aRunnerWhoIsNotLinkedOrDoesNotExistIsLeftAlone() {
        Runner owner = linkedRunner();
        Activity api = apiRun(owner, "61");
        when(tokenService.isRunnerStravaLinked(any())).thenReturn(false);

        assertThat(accounts.confirmRevocationAndPurge(owner.getId())).isEqualTo(StravaAccountService.RevocationOutcome.NOT_LINKED);
        assertThat(accounts.confirmRevocationAndPurge(-1L)).isEqualTo(StravaAccountService.RevocationOutcome.NOT_LINKED);
        assertThat(accounts.confirmRevocationAndPurge(null)).isEqualTo(StravaAccountService.RevocationOutcome.NOT_LINKED);

        assertThat(activities.findById(api.getId())).isPresent();
        verify(tokenService, never()).probeAuthorization(any());
    }

    @Test
    void retentionDeletesOnlyOldRunsThatCameFromTheApi() {
        Runner owner = linkedRunner();
        Activity oldApi = apiRun(owner, "71");
        oldApi.setCreatedAt(LocalDateTime.now().minusDays(10));
        activities.saveAndFlush(oldApi);
        Activity freshApi = apiRun(owner, "72");
        Activity oldGarmin = garminRun(owner);
        oldGarmin.setCreatedAt(LocalDateTime.now().minusDays(400));
        activities.saveAndFlush(oldGarmin);

        int removed = accounts.purgeApiDataOlderThan(Duration.ofDays(7));

        assertThat(removed).isGreaterThanOrEqualTo(1);
        assertThat(activities.findById(oldApi.getId())).isEmpty();
        assertThat(activities.findById(freshApi.getId())).isPresent();
        assertThat(activities.findById(oldGarmin.getId())).as("a file run is never expired").isPresent();
    }
}
