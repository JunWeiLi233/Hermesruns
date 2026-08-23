package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LocalSharedRunnerBootstrapServiceTests {
    private final RunnerRepository runnerRepository = mock(RunnerRepository.class);
    private final ShoeRepository shoeRepository = mock(ShoeRepository.class);
    private final ActivityRepository activityRepository = mock(ActivityRepository.class);
    private final AuthService authService = mock(AuthService.class);

    @Test
    void bootstrapCreatesSyntheticStravaRunnerWithPasswordAndMockDataWhenEmpty() {
        when(authService.normalizeEmail("strava+140971747@hermes.local")).thenReturn("strava+140971747@hermes.local");
        when(runnerRepository.findByEmailIgnoreCase("strava+140971747@hermes.local")).thenReturn(Optional.empty());
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> {
            Runner runner = invocation.getArgument(0);
            if (runner.getId() == null) runner.setId(42L);
            return runner;
        });
        when(activityRepository.countByRunner(any(Runner.class))).thenReturn(0L);
        when(shoeRepository.findByRunnerOrderByCreatedAtDesc(any(Runner.class))).thenReturn(List.of());
        doAnswer(invocation -> {
            Runner runner = invocation.getArgument(0);
            runner.setPassword("hashed-local-password");
            return null;
        }).when(authService).storePassword(any(Runner.class), any(String.class));

        LocalSharedRunnerBootstrapService.BootstrapResult result = newService().bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.localDefault("local-test-password")
        );

        assertThat(result.seededActivities()).isEqualTo(21);
        assertThat(result.seededShoes()).isEqualTo(3);
        verify(authService).storePassword(any(Runner.class), any(String.class));
        verify(activityRepository, times(21)).save(any(Activity.class));
        verify(shoeRepository, times(3)).save(any(Shoe.class));
        verify(runnerRepository).save(org.mockito.ArgumentMatchers.argThat(runner ->
                "strava+140971747@hermes.local".equals(runner.getEmail())
                        && "USER".equals(runner.getRole())
                        && "ACTIVE_STRAVA".equals(runner.getStatus())
                        && runner.isEmailVerified()
                        && Long.valueOf(140971747L).equals(runner.getStravaAthleteId())
                        && runner.getStravaAccessToken() == null
                        && runner.getStravaRefreshToken() == null
        ));
    }

    @Test
    void bootstrapDoesNotDuplicateMockDataWhenRunnerAlreadyHasCurrentSeed() {
        Runner existing = new Runner();
        existing.setId(7L);
        existing.setEmail("strava+140971747@hermes.local");
        when(authService.normalizeEmail("strava+140971747@hermes.local")).thenReturn("strava+140971747@hermes.local");
        when(runnerRepository.findByEmailIgnoreCase("strava+140971747@hermes.local")).thenReturn(Optional.of(existing));
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(activityRepository.countByRunner(existing)).thenReturn(4L);
        when(activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                existing,
                ImportProvider.STRAVA,
                "local-shared-runner-loop-v14-1"
        )).thenReturn(true);

        LocalSharedRunnerBootstrapService.BootstrapResult result = newService().bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.localDefault("local-test-password")
        );

        assertThat(result.seededActivities()).isZero();
        assertThat(result.seededShoes()).isZero();
        verify(activityRepository, never()).save(any(Activity.class));
        verify(shoeRepository, never()).save(any(Shoe.class));
    }

    @Test
    void bootstrapFillsOnlyMissingMockDataWhenExistingSeedIsPartial() {
        Runner existing = new Runner();
        existing.setId(9L);
        existing.setEmail("strava+140971747@hermes.local");
        when(authService.normalizeEmail("strava+140971747@hermes.local")).thenReturn("strava+140971747@hermes.local");
        when(runnerRepository.findByEmailIgnoreCase("strava+140971747@hermes.local")).thenReturn(Optional.of(existing));
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(activityRepository.countByRunner(existing)).thenReturn(4L);
        when(activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                existing,
                ImportProvider.STRAVA,
                "local-shared-runner-loop-v14-1"
        )).thenReturn(false);
        when(activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                existing,
                ImportProvider.STRAVA,
                "local-shared-runner-loop-v14-4"
        )).thenReturn(true);
        when(shoeRepository.findByRunnerOrderByCreatedAtDesc(existing)).thenReturn(List.of(new Shoe()));
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LocalSharedRunnerBootstrapService.BootstrapResult result = newService().bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.localDefault("local-test-password")
        );

        assertThat(result.seededActivities()).isEqualTo(20);
        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityRepository, times(20)).save(activityCaptor.capture());
        assertThat(activityCaptor.getAllValues())
                .noneMatch(activity -> "local-shared-runner-loop-v14-4".equals(activity.getSourceChecksum()));
    }

    @Test
    void bootstrapSeedsSharedRunnerRouteSamples() {
        when(authService.normalizeEmail("strava+140971747@hermes.local")).thenReturn("strava+140971747@hermes.local");
        when(runnerRepository.findByEmailIgnoreCase("strava+140971747@hermes.local")).thenReturn(Optional.empty());
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> {
            Runner runner = invocation.getArgument(0);
            if (runner.getId() == null) runner.setId(140971747L);
            return runner;
        });
        when(activityRepository.countByRunner(any(Runner.class))).thenReturn(0L);
        when(shoeRepository.findByRunnerOrderByCreatedAtDesc(any(Runner.class))).thenReturn(List.of());

        LocalSharedRunnerBootstrapService.BootstrapResult result = newService().bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.localDefault("local-test-password")
        );

        assertThat(result.seededActivities()).isEqualTo(21);

        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityRepository, times(21)).save(activityCaptor.capture());
        assertThat(activityCaptor.getAllValues())
                .allSatisfy(activity -> {
                    assertThat(activity.getSourceChecksum()).startsWith("local-shared-runner-loop-v14-");
                    int expectedPoints = activity.getSourceChecksum().endsWith("-19")
                            || activity.getSourceChecksum().endsWith("-20")
                            || activity.getSourceChecksum().endsWith("-21") ? 144 : 72;
                    assertThat(activity.getPoints()).hasSize(expectedPoints);
                });
    }

    private LocalSharedRunnerBootstrapService newService() {
        return new LocalSharedRunnerBootstrapService(
                runnerRepository,
                shoeRepository,
                activityRepository,
                authService
        );
    }
}
