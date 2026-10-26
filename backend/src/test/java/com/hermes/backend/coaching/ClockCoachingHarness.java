package com.hermes.backend.coaching;

import com.hermes.backend.BackendApplication;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Standalone isolated fixture startup. Never packaged in the production application. */
public final class ClockCoachingHarness {
    private ClockCoachingHarness() {}

    public static void main(String[] args) {
        new SpringApplication(BackendApplication.class, HarnessConfiguration.class).run(args);
    }

    @TestConfiguration(proxyBeanMethods = false)
    public static class HarnessConfiguration {
        @Bean
        @Primary
        Clock clockCoachingHarnessClock(@Value("${app.clock-harness.instant-file}") String file) {
            Path path = Path.of(file).toAbsolutePath().normalize();
            Path owned = Path.of("D:/Hermesruns/output/playwright/gap-closure-round-3/clock-coaching")
                    .toAbsolutePath().normalize();
            if (!path.startsWith(owned) || !Files.isRegularFile(path)) {
                throw new IllegalArgumentException("Clock harness requires its owned instant control file");
            }
            Clock clock = new FileClock(path, ZoneOffset.UTC);
            clock.instant();
            return clock;
        }
    }

    private static final class FileClock extends Clock {
        private final Path path;
        private final ZoneId zone;

        FileClock(Path path, ZoneId zone) {
            this.path = path;
            this.zone = zone;
        }

        @Override
        public ZoneId getZone() {
            return zone;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return new FileClock(path, zone);
        }

        @Override
        public Instant instant() {
            try {
                return Instant.parse(Files.readString(path).trim());
            } catch (IOException failure) {
                throw new UncheckedIOException("Cannot read owned clock instant", failure);
            }
        }
    }
}
