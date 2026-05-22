package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class OpenMeteoRateLimiterTests {

    private static final Instant FROZEN = Instant.parse("2026-05-11T12:00:00Z");

    @Test
    void shouldNotThrottleWhenNoPrior429() {
        OpenMeteoRateLimiter limiter = new OpenMeteoRateLimiter(Clock.fixed(FROZEN, ZoneId.of("UTC")));
        assertThat(limiter.shouldThrottle("archive")).isFalse();
    }

    @Test
    void shouldThrottleAfterFirst429() {
        Clock clock = Clock.fixed(FROZEN, ZoneId.of("UTC"));
        OpenMeteoRateLimiter limiter = new OpenMeteoRateLimiter(clock);

        limiter.recordRateLimited("archive");
        assertThat(limiter.shouldThrottle("archive")).isTrue();
    }

    @Test
    void shouldNotThrottleAfterBackoffExpires() {
        Instant start = FROZEN;
        TestClock clock = new TestClock(start);
        OpenMeteoRateLimiter limiter = new OpenMeteoRateLimiter(clock);

        limiter.recordRateLimited("archive");
        assertThat(limiter.shouldThrottle("archive")).isTrue();

        // Advance past 30s backoff window
        clock.advanceSeconds(31);
        assertThat(limiter.shouldThrottle("archive")).isFalse();
    }

    @Test
    void escalatesFrom30sTo5mTo30m() {
        TestClock clock = new TestClock(FROZEN);
        OpenMeteoRateLimiter limiter = new OpenMeteoRateLimiter(clock);

        // First 429: 30s backoff
        limiter.recordRateLimited("archive");
        assertThat(limiter.shouldThrottle("archive")).isTrue();
        clock.advanceSeconds(31);
        assertThat(limiter.shouldThrottle("archive")).isFalse();

        // Second 429: 5m backoff
        limiter.recordRateLimited("archive");
        assertThat(limiter.shouldThrottle("archive")).isTrue();
        clock.advanceSeconds(31);
        assertThat(limiter.shouldThrottle("archive")).isTrue(); // still throttled
        clock.advanceSeconds(270); // 31 + 270 = 301s > 300s
        assertThat(limiter.shouldThrottle("archive")).isFalse();

        // Third 429: 30m backoff
        limiter.recordRateLimited("archive");
        assertThat(limiter.shouldThrottle("archive")).isTrue();
        clock.advanceSeconds(60);
        assertThat(limiter.shouldThrottle("archive")).isTrue(); // still throttled
        clock.advanceSeconds(1740); // 60 + 1740 = 1800s
        assertThat(limiter.shouldThrottle("archive")).isFalse();
    }

    @Test
    void recordSuccessClearsThrottle() {
        TestClock clock = new TestClock(FROZEN);
        OpenMeteoRateLimiter limiter = new OpenMeteoRateLimiter(clock);

        limiter.recordRateLimited("archive");
        assertThat(limiter.shouldThrottle("archive")).isTrue();

        limiter.recordSuccess("archive");
        assertThat(limiter.shouldThrottle("archive")).isFalse();
    }

    @Test
    void backoffScheduleIsCorrect() {
        assertThat(OpenMeteoRateLimiter.backoffSeconds(0)).isEqualTo(30);
        assertThat(OpenMeteoRateLimiter.backoffSeconds(1)).isEqualTo(30);
        assertThat(OpenMeteoRateLimiter.backoffSeconds(2)).isEqualTo(300);
        assertThat(OpenMeteoRateLimiter.backoffSeconds(3)).isEqualTo(1800);
        assertThat(OpenMeteoRateLimiter.backoffSeconds(10)).isEqualTo(1800);
    }

    @Test
    void separateEndpointsAreIsolated() {
        TestClock clock = new TestClock(FROZEN);
        OpenMeteoRateLimiter limiter = new OpenMeteoRateLimiter(clock);

        limiter.recordRateLimited("archive");
        assertThat(limiter.shouldThrottle("archive")).isTrue();
        assertThat(limiter.shouldThrottle("elevation")).isFalse();
    }

    @Test
    void nullEndpointDefaultsToDefaultKey() {
        OpenMeteoRateLimiter limiter = new OpenMeteoRateLimiter(Clock.fixed(FROZEN, ZoneId.of("UTC")));

        limiter.recordRateLimited(null);
        assertThat(limiter.shouldThrottle("default")).isTrue();
    }

    private static class TestClock extends Clock {
        private Instant instant;

        TestClock(Instant instant) {
            this.instant = instant;
        }

        void advanceSeconds(long seconds) {
            this.instant = this.instant.plusSeconds(seconds);
        }

        @Override
        public Instant instant() {
            return instant;
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }
}
