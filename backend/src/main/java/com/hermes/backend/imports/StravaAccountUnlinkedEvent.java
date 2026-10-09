package com.hermes.backend.imports;

/**
 * Published when a runner's Strava link is removed (they disconnected, or Strava reports they revoked
 * access). The sync service listens so it can stop a sync that is already running for that runner.
 */
public record StravaAccountUnlinkedEvent(Long runnerId) {}
