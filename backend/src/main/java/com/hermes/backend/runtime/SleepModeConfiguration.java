package com.hermes.backend.runtime;

import com.hermes.backend.Coach8020NightlyScheduler;
import com.hermes.backend.GarminWellnessSyncScheduler;
import com.hermes.backend.StravaAutoSyncScheduler;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration(proxyBeanMethods = false)
@Profile("sleep")
public class SleepModeConfiguration {
    @Bean(defaultCandidate = false)
    ThreadPoolTaskExecutor sleepCatchUpExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(0);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(1);
        executor.setKeepAliveSeconds(10);
        executor.setThreadNamePrefix("sleep-catchup-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);
        return executor;
    }

    @Bean
    SleepWakeCatchUp sleepWakeCatchUp(
            @Qualifier("sleepCatchUpExecutor") TaskExecutor executor,
            StravaAutoSyncScheduler strava,
            GarminWellnessSyncScheduler garmin,
            ObjectProvider<Coach8020NightlyScheduler> coach,
            @Value("${strava.sync.enabled:true}") boolean stravaEnabled,
            @Value("${garmin.wellness.sync.enabled:true}") boolean garminEnabled) {
        return new SleepWakeCatchUp(executor,
                () -> { if (stravaEnabled) strava.triggerAdminSync(null, "wake_catchup"); },
                () -> { if (garminEnabled) garmin.triggerAdminSync(null, "wake_catchup"); },
                () -> coach.ifAvailable(Coach8020NightlyScheduler::nightlyCoachAudit));
    }
}
