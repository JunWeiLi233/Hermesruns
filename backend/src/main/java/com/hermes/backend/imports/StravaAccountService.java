package com.hermes.backend.imports;

import com.hermes.backend.activity.ActivityCaches;
import com.hermes.backend.activity.ActivityDataAccess;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.DeletedActivityTombstoneRepository;
import com.hermes.backend.coaching.AutomatedCoachService;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * What happens to a runner's Strava data when the connection ends.
 *
 * <p>Strava's API Policy requires deleting a user's Strava data when they disconnect, and caps how long
 * API data may be kept. This service owns both: the runner disconnecting ({@link #unlink}), Strava
 * telling us they revoked access ({@link #confirmRevocationAndPurge}), and age-based retention
 * ({@link #purgeApiDataOlderThan}). Only runs flagged {@code stravaApiSourced} are touched: runs the
 * runner imported from their own files stay.</p>
 */
@Service
public class StravaAccountService {

    private static final Logger log = LoggerFactory.getLogger(StravaAccountService.class);

    /** Result of a disconnect. {@code revokedAtStrava} is false when Strava could not be reached. */
    public record UnlinkResult(boolean revokedAtStrava, int removedActivities) {}

    public enum RevocationOutcome {
        /** The runner has no Strava link here. */
        NOT_LINKED,
        /** Strava issued fresh tokens, so access is intact; nothing was deleted. */
        STILL_AUTHORIZED,
        /** Strava gave no clear answer; nothing was deleted. */
        INCONCLUSIVE,
        /** Strava confirmed the runner revoked access; their Strava data was deleted. */
        PURGED
    }

    private final RunnerRepository runnerRepository;
    private final ActivityRepository activityRepository;
    private final ActivityDataAccess activityDataAccess;
    private final DeletedActivityTombstoneRepository tombstones;
    private final StravaTokenService stravaTokenService;
    private final AutomatedCoachService automatedCoachService;
    private final TtlCacheStore cacheStore;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate transaction;

    public StravaAccountService(RunnerRepository runnerRepository,
                                ActivityRepository activityRepository,
                                ActivityDataAccess activityDataAccess,
                                DeletedActivityTombstoneRepository tombstones,
                                StravaTokenService stravaTokenService,
                                AutomatedCoachService automatedCoachService,
                                TtlCacheStore cacheStore,
                                ApplicationEventPublisher events,
                                PlatformTransactionManager transactionManager) {
        this.runnerRepository = runnerRepository;
        this.activityRepository = activityRepository;
        this.activityDataAccess = activityDataAccess;
        this.tombstones = tombstones;
        this.stravaTokenService = stravaTokenService;
        this.automatedCoachService = automatedCoachService;
        this.cacheStore = cacheStore;
        this.events = events;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    /**
     * Disconnects the runner from Strava: revokes the token at Strava (best effort), clears the link,
     * stops any sync in flight and deletes the runs that came from the Strava API. Clearing the link and
     * deleting the runs are one transaction: if the deletion fails, the runner is still connected and can
     * try again, instead of being left disconnected with Strava runs that nothing would ever remove.
     */
    public UnlinkResult unlink(Runner runner) {
        boolean revoked = stravaTokenService.revokeAtStrava(runner);
        int removed = clearLinkAndPurge(runner);
        log.info("Strava disconnected for runner {}: revokedAtStrava={}, removedActivities={}", runner.getId(), revoked, removed);
        return new UnlinkResult(revoked, removed);
    }

    /**
     * Account deletion's share of a disconnect: tells Strava to revoke access, clears the link and stops a
     * sync in flight. It deletes no runs, because deleting the account removes every run and token anyway.
     */
    public void revokeAndStopSync(Runner runner) {
        stravaTokenService.revokeAtStrava(runner);
        clearLink(runner);
        events.publishEvent(new StravaAccountUnlinkedEvent(runner.getId()));
    }

    /**
     * Treats a hint that the runner's access ended as only a hint: asks Strava, and deletes data only if
     * Strava's own answer says the refresh token is invalid. Safe to call with a forged webhook event.
     */
    public RevocationOutcome confirmRevocationAndPurge(Long runnerId) {
        if (runnerId == null) {
            return RevocationOutcome.NOT_LINKED;
        }
        Runner runner = runnerRepository.findById(runnerId).orElse(null);
        if (runner == null || !stravaTokenService.isRunnerStravaLinked(runner)) {
            return RevocationOutcome.NOT_LINKED;
        }
        return switch (stravaTokenService.probeAuthorization(runner)) {
            case ACTIVE -> RevocationOutcome.STILL_AUTHORIZED;
            case UNKNOWN -> RevocationOutcome.INCONCLUSIVE;
            case REVOKED -> {
                int removed = clearLinkAndPurge(runner);
                log.info("Strava access revoked by runner {}: removedActivities={}", runner.getId(), removed);
                yield RevocationOutcome.PURGED;
            }
        };
    }

    /**
     * Deletes every run the runner got from the Strava API, the tombstones of runs they deleted, and the
     * cached views built from them. Returns how many runs were removed.
     */
    public int purgeStravaActivities(Runner runner) {
        Integer removed = transaction.execute(status -> purgeStravaRows(runner));
        int total = removed == null ? 0 : removed;
        refreshDerivedData(runner.getId(), total);
        return total;
    }

    /**
     * A sync that was writing a run when the runner disconnected can finish after the disconnect's own
     * sweeps. The sync calls this as it ends, so whichever of the two finishes last removes what is left.
     * Does nothing if the runner has connected Strava again in the meantime.
     */
    public void purgeStravaRunsOfDisconnectedRunner(Long runnerId) {
        Runner runner = runnerRepository.findById(runnerId).orElse(null);
        if (runner == null || stravaTokenService.isRunnerStravaLinked(runner)) {
            return;
        }
        int removed = purgeStravaActivities(runner);
        if (removed > 0) {
            log.info("Removed {} Strava runs a sync wrote while runner {} was disconnecting", removed, runnerId);
        }
    }

    /**
     * Retention: deletes Strava-API runs first stored longer ago than {@code maxAge}. Returns how many
     * runs were removed across all runners.
     */
    public int purgeApiDataOlderThan(Duration maxAge) {
        LocalDateTime cutoff = LocalDateTime.now().minus(maxAge);
        int total = 0;
        for (Long runnerId : activityRepository.findRunnerIdsWithStravaApiSourcedCreatedBefore(cutoff)) {
            Runner runner = runnerRepository.findById(runnerId).orElse(null);
            if (runner == null) {
                continue;
            }
            List<Long> ids = activityRepository.findStravaApiSourcedIdsCreatedBefore(runner, cutoff);
            int removed = activityDataAccess.purgeActivities(runner, ids);
            if (removed > 0) {
                refreshDerivedData(runnerId, removed);
                total += removed;
            }
        }
        return total;
    }

    /**
     * Clears the link and deletes the API-sourced runs in one transaction, then stops any sync in flight
     * and sweeps once more. The order is what keeps a sync from leaving runs behind: the stop signal goes
     * out after the link is gone, so a sync that sees it finds a disconnected runner and (see
     * {@link #purgeStravaRunsOfDisconnectedRunner}) removes what it wrote itself, and the sweep after the
     * signal removes anything written before it.
     */
    private int clearLinkAndPurge(Runner runner) {
        Integer removed = transaction.execute(status -> {
            clearLink(runner);
            return purgeStravaRows(runner);
        });
        events.publishEvent(new StravaAccountUnlinkedEvent(runner.getId()));
        Integer sweptAfterStop = transaction.execute(status -> purgeStravaRows(runner));
        int total = (removed == null ? 0 : removed) + (sweptAfterStop == null ? 0 : sweptAfterStop);
        refreshDerivedData(runner.getId(), total);
        return total;
    }

    private int purgeStravaRows(Runner runner) {
        List<Long> ids = activityRepository.findStravaApiSourcedIds(runner);
        int removed = activityDataAccess.purgeActivities(runner, ids);
        tombstones.deleteAllByRunner(runner);
        return removed;
    }

    private void clearLink(Runner runner) {
        runner.setStravaAthleteId(null);
        runner.setStravaUsername(null);
        runner.setStravaAccessToken(null);
        runner.setStravaRefreshToken(null);
        runner.setStravaTokenExpiresAt(null);
        runner.setStravaListCursorEpoch(null);
        runnerRepository.save(runner);
    }

    /**
     * Cached views and the coach's totals are built from the runs, so they are rebuilt after a purge. This
     * is bookkeeping: a failure here is logged and never undoes or blocks the deletion itself.
     */
    private void refreshDerivedData(Long runnerId, int removed) {
        ActivityCaches.evictForRunner(cacheStore, runnerId);
        if (removed > 0) {
            try {
                automatedCoachService.reaggregateRunner(runnerId);
            } catch (RuntimeException exception) {
                log.warn("Coach totals for runner {} were not refreshed after a Strava purge ({})",
                        runnerId, exception.getClass().getSimpleName());
            }
        }
    }
}
