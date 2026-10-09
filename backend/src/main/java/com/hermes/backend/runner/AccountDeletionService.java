package com.hermes.backend.runner;

import com.hermes.backend.activity.ActivityCaches;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import java.util.Comparator;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Deletes a runner and everything they own. The runner's own request to delete their data also covers
 * the data Strava's API Policy requires deleting on request, so Strava is disconnected first.
 *
 * <p>Third-party work (revoking Strava access) runs first, outside the transaction. Then every
 * {@link RunnerDataPurger} runs in order and the runner row goes, in one transaction: if anything is
 * left that still points at the runner, the whole deletion rolls back and nothing is lost.</p>
 */
@Service
public class AccountDeletionService {

    private static final Logger log = LoggerFactory.getLogger(AccountDeletionService.class);

    private final RunnerRepository runners;
    private final ObjectProvider<RunnerDataPurger> purgers;
    private final ObjectProvider<RunnerDisconnectHook> disconnectHooks;
    private final TtlCacheStore cacheStore;
    private final TransactionTemplate transaction;

    public AccountDeletionService(RunnerRepository runners,
                                  ObjectProvider<RunnerDataPurger> purgers,
                                  ObjectProvider<RunnerDisconnectHook> disconnectHooks,
                                  TtlCacheStore cacheStore,
                                  PlatformTransactionManager transactionManager) {
        this.runners = runners;
        this.purgers = purgers;
        this.disconnectHooks = disconnectHooks;
        this.cacheStore = cacheStore;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    /** Deletes the runner and all their data. Safe to call for a runner that no longer exists. */
    public void deleteAccount(Long runnerId) {
        Runner runner = runnerId == null ? null : runners.findById(runnerId).orElse(null);
        if (runner == null) {
            return;
        }
        disconnectHooks.orderedStream().forEach(hook -> hook.beforeAccountDeleted(runner));

        List<RunnerDataPurger> ordered = purgers.stream()
                .sorted(Comparator.comparingInt(RunnerDataPurger::order))
                .toList();
        transaction.executeWithoutResult(status -> {
            for (RunnerDataPurger purger : ordered) {
                purger.purge(runnerId);
            }
            runners.deleteById(runnerId);
            runners.flush();
        });
        ActivityCaches.evictForRunner(cacheStore, runnerId);
        log.info("Account {} deleted", runnerId);
    }
}
