package com.hermes.backend.activity;

/**
 * Published when GPS and heart-rate points have been stored for an activity that already existed.
 *
 * <p>{@link ActivityIngestedEvent} fires when the activity row is saved, which for a Strava run is before
 * its stream has been fetched. Whatever is computed from the points has to be computed again once they are
 * there, and this is the signal for it. Runs imported from files store their points in the same transaction
 * as the run, so for them the ingest event is already enough.</p>
 */
public record ActivityPointsStoredEvent(Long runnerId, Long activityId) {}
