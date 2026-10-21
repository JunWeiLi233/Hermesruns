package com.hermes.backend.runner;

/**
 * Published when the heart-rate zones a runner trains with have changed (their max heart rate or their
 * boundaries). Everything computed from the zones is out of date and is recomputed.
 */
public record RunnerZonesChangedEvent(Long runnerId) {}
