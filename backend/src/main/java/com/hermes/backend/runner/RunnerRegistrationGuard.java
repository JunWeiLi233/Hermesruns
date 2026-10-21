package com.hermes.backend.runner;

/** Domain lifecycle gates checked before a soft-deleted identity can be recycled for signup. */
public interface RunnerRegistrationGuard {
    void beforeRecycling(Long runnerId);
}
