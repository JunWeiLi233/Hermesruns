package com.hermes.backend.runtime;

import com.hermes.backend.Coach8020NightlyScheduler;
import com.hermes.backend.GarminWellnessSyncScheduler;
import com.hermes.backend.StravaAutoSyncScheduler;
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
    void dispatchUsesExistingManualPathsAndRespectsDisabledIntegrations() {
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        beans.addBean("coach", coach);
        SleepModeConfiguration config = new SleepModeConfiguration();
        config.sleepWakeCatchUp(Runnable::run, strava, garmin,
                beans.getBeanProvider(Coach8020NightlyScheduler.class), true, true).afterStartup();
        verify(strava).triggerAdminSync(null, "wake_catchup");
        verify(garmin).triggerAdminSync(null, "wake_catchup");
        verify(coach).nightlyCoachAudit();

        clearInvocations(strava, garmin, coach);
        config.sleepWakeCatchUp(Runnable::run, strava, garmin,
                new StaticListableBeanFactory().getBeanProvider(Coach8020NightlyScheduler.class),
                false, false).afterStartup();
        verifyNoInteractions(strava, garmin, coach);
    }
}
