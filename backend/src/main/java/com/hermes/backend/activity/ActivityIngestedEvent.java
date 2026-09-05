package com.hermes.backend.activity;

/**
 * Published after a running activity is persisted (import or Strava sync).
 */
public record ActivityIngestedEvent(Long runnerId, Long activityId) {}
