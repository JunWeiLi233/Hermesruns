package com.hermes.backend.imports;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerDisconnectHook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Deleting an account disconnects Strava first, so Strava is told to revoke Hermes's access. Telling Strava is
 * best effort: the deletion that follows removes the tokens and every run whether or not it worked.
 */
@Component
class StravaAccountDeletionHook implements RunnerDisconnectHook {

    private static final Logger log = LoggerFactory.getLogger(StravaAccountDeletionHook.class);

    private final StravaTokenService tokens;
    private final StravaAccountService accounts;

    StravaAccountDeletionHook(StravaTokenService tokens, StravaAccountService accounts) {
        this.tokens = tokens;
        this.accounts = accounts;
    }

    @Override
    public void beforeAccountDeleted(Runner runner) {
        if (!tokens.isRunnerStravaLinked(runner)) {
            return;
        }
        try {
            accounts.revokeAndStopSync(runner);
        } catch (RuntimeException exception) {
            log.warn("Could not disconnect Strava before deleting runner {} ({}); deleting the account anyway",
                    runner.getId(), exception.getClass().getSimpleName());
        }
    }
}
