package com.hermes.backend.runtime;

import com.hermes.backend.coaching.Coach8020NightlyScheduler;
import com.hermes.backend.imports.GarminWellnessSyncScheduler;
import com.hermes.backend.imports.StravaAutoSyncScheduler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class SleepModeConfigurationTests {
    private final StravaAutoSyncScheduler strava = mock(StravaAutoSyncScheduler.class);
    private final GarminWellnessSyncScheduler garmin = mock(GarminWellnessSyncScheduler.class);
    private final Coach8020NightlyScheduler coach = mock(Coach8020NightlyScheduler.class);

    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withUserConfiguration(SleepModeConfiguration.class)
            .withBean(StravaAutoSyncScheduler.class, () -> strava)
            .withBean(GarminWellnessSyncScheduler.class, () -> garmin)
            .withBean(Coach8020NightlyScheduler.class, () -> coach);

    @Test
    void alwaysOnModeDoesNotInstallCatchUpInfrastructure() {
        context.run(ctx -> {
            assertThat(ctx).doesNotHaveBean(SleepWakeCatchUp.class);
            assertThat(ctx).doesNotHaveBean("sleepCatchUpExecutor");
            verifyNoInteractions(strava, garmin, coach);
        });
    }

    @Test
    void sleepProfileInstallsBoundedExecutorWithoutDispatchingBeforeReadiness() {
        context.withPropertyValues("spring.profiles.active=sleep").run(ctx -> {
            assertThat(ctx).hasSingleBean(SleepWakeCatchUp.class);
            ThreadPoolTaskExecutor executor = ctx.getBean("sleepCatchUpExecutor", ThreadPoolTaskExecutor.class);
            assertThat(executor.getCorePoolSize()).isZero();
            assertThat(executor.getMaxPoolSize()).isEqualTo(1);
            assertThat(executor.getQueueCapacity()).isEqualTo(1);
            verifyNoInteractions(strava, garmin, coach);
        });
    }

    @Test
    void dispatchUsesCompletionPathsInOrderAndRespectsDisabledIntegrations() {
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        beans.addBean("coach", coach);
        SleepModeConfiguration config = new SleepModeConfiguration();
        when(strava.syncOnWake()).thenReturn(true);
        when(garmin.syncOnWake()).thenReturn(true);
        config.sleepWakeCatchUp(Runnable::run, strava, garmin,
                beans.getBeanProvider(Coach8020NightlyScheduler.class), true, true).afterStartup();
        var order = inOrder(strava, garmin, coach);
        order.verify(strava).syncOnWake();
        order.verify(garmin).syncOnWake();
        order.verify(coach).nightlyCoachAudit();
        verify(strava, never()).triggerAdminSync(any(), any());
        verify(garmin, never()).triggerAdminSync(any(), any());

        clearInvocations(strava, garmin, coach);
        config.sleepWakeCatchUp(Runnable::run, strava, garmin,
                new StaticListableBeanFactory().getBeanProvider(Coach8020NightlyScheduler.class),
                false, false).afterStartup();
        verifyNoInteractions(strava, garmin, coach);
    }

    @Test
    void busyProviderDefersCoachButStillRunsTheOtherProvider() {
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        beans.addBean("coach", coach);
        when(strava.syncOnWake()).thenReturn(false);
        when(garmin.syncOnWake()).thenReturn(true);
        new SleepModeConfiguration().sleepWakeCatchUp(Runnable::run, strava, garmin,
                beans.getBeanProvider(Coach8020NightlyScheduler.class), true, true).afterStartup();
        verify(strava).syncOnWake();
        verify(garmin).syncOnWake();
        verifyNoInteractions(coach);
    }
}
