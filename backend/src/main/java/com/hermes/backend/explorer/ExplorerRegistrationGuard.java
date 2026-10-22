package com.hermes.backend.explorer;

import com.hermes.backend.runner.RunnerRegistrationGuard;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.CONFLICT;

@Component
@ConditionalOnProperty(name="app.explorer.enabled",havingValue="true")
public class ExplorerRegistrationGuard implements RunnerRegistrationGuard {
    private final ExplorerStore store;
    public ExplorerRegistrationGuard(ExplorerStore store){this.store=store;}
    public void beforeRecycling(Long runnerId) {
        int pending=store.jdbc().queryForObject("SELECT count(*) FROM statshunters.deletion_requests WHERE runner_id=? AND state<>'complete'",Integer.class,runnerId);
        if(pending>0)throw new ResponseStatusException(CONFLICT,"Account cleanup is still in progress.");
    }
}
