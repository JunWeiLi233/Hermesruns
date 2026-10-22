package com.hermes.backend.activity;

/** Called before changing an existing actual run, in the same transaction as its write. */
public interface ActivityMutationHook {
    void beforeActivityChanged(Long activityId);
}
