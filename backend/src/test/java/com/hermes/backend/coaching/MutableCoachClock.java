package com.hermes.backend.coaching;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;

/** A shared instant with ordinary Clock zone views, confined to test sources. */
final class MutableCoachClock extends Clock {
    private final AtomicReference<Instant> instant;
    private final ZoneId zone;

    MutableCoachClock(Instant instant) {
        this(new AtomicReference<>(Objects.requireNonNull(instant)), ZoneOffset.UTC);
    }

    private MutableCoachClock(AtomicReference<Instant> instant, ZoneId zone) {
        this.instant = instant;
        this.zone = Objects.requireNonNull(zone);
    }

    void setInstant(Instant value) {
        instant.set(Objects.requireNonNull(value));
    }

    @Override
    public ZoneId getZone() {
        return zone;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return new MutableCoachClock(instant, zone);
    }

    @Override
    public Instant instant() {
        return instant.get();
    }
}
