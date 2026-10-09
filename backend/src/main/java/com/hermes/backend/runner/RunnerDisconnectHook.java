package com.hermes.backend.runner;

/**
 * Work that has to happen outside the database transaction before an account is deleted, such as telling
 * a provider to revoke the runner's access. A failure should be handled by the hook: deleting the account
 * must not depend on a third party being reachable.
 */
public interface RunnerDisconnectHook {

    void beforeAccountDeleted(Runner runner);
}
