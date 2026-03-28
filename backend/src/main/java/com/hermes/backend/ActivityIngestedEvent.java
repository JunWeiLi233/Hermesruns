package com.hermes.backend;

/**
 * Published after a running activity is persisted (import or Strava sync).
 */
public record ActivityIngestedEvent(Long runnerId, Long activityId) {}
