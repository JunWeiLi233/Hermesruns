package com.hermes.backend;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.context.metrics.buffering.StartupTimeline.TimelineEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.metrics.StartupStep;
import org.springframework.stereotype.Component;

/**
 * Cold boots have intermittently stalled for ~30s between MVC mapping and Tomcat
 * start without any log line naming the blocked phase. BufferingApplicationStartup
 * records every startup step, so when a boot crosses the slow threshold this logger
 * names the slowest steps directly in the boot log instead of requiring a jstack.
 */
@Component
public class StartupPhaseDiagnosticsLogger implements ApplicationListener<ApplicationReadyEvent> {
    private static final Logger logger = LoggerFactory.getLogger(StartupPhaseDiagnosticsLogger.class);

    private static final long DEFAULT_THRESHOLD_MS = 15_000;
    private static final long MIN_REPORTED_STEP_MS = 250;
    private static final int REPORTED_STEP_LIMIT = 10;

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        long thresholdMs = resolveThresholdMs();
        long bootMs = event.getTimeTaken() == null ? 0 : event.getTimeTaken().toMillis();
        if (bootMs < thresholdMs || BackendApplication.applicationStartup == null) {
            return;
        }

        List<String> slowestSteps = BackendApplication.applicationStartup.getBufferedTimeline().getEvents().stream()
                .filter(timelineEvent -> timelineEvent.getDuration().toMillis() >= MIN_REPORTED_STEP_MS)
                .sorted(Comparator.comparingLong((TimelineEvent timelineEvent) -> timelineEvent.getDuration().toMillis())
                        .reversed())
                .limit(REPORTED_STEP_LIMIT)
                .map(this::describeStep)
                .collect(Collectors.toList());

        if (slowestSteps.isEmpty()) {
            return;
        }

        logger.warn(
                "[Hermes] Slow startup diagnostics: ready in {} ms (threshold {} ms). Slowest startup steps:",
                bootMs,
                thresholdMs
        );
        for (String step : slowestSteps) {
            logger.warn("[Hermes]   {}", step);
        }
    }

    private String describeStep(TimelineEvent timelineEvent) {
        StartupStep step = timelineEvent.getStartupStep();
        String tags = StreamSupport.stream(step.getTags().spliterator(), false)
                .filter(tag -> "beanName".equals(tag.getKey()) || "beanClass".equals(tag.getKey()))
                .map(tag -> tag.getKey() + "=" + tag.getValue())
                .collect(Collectors.joining(" "));
        return tags.isEmpty()
                ? String.format("%s (%d ms)", step.getName(), timelineEvent.getDuration().toMillis())
                : String.format("%s [%s] (%d ms)", step.getName(), tags, timelineEvent.getDuration().toMillis());
    }

    private long resolveThresholdMs() {
        String raw = System.getenv("HERMES_STARTUP_DIAGNOSTICS_THRESHOLD_MS");
        if (raw == null || raw.isBlank()) {
            return DEFAULT_THRESHOLD_MS;
        }
        try {
            long parsed = Long.parseLong(raw.trim());
            return parsed > 0 ? parsed : DEFAULT_THRESHOLD_MS;
        } catch (NumberFormatException exception) {
            return DEFAULT_THRESHOLD_MS;
        }
    }
}
