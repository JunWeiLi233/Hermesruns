package com.hermes.backend.explorer;

import com.hermes.backend.auth.*;
import com.hermes.backend.runner.*;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;
import static com.hermes.backend.explorer.ExplorerJson.*;

@Service
@ConditionalOnProperty(name="app.explorer.enabled",havingValue="true")
public class ExplorerDeletion {
    private final ExplorerStore store;
    private final AuthService auth;
    private final RunnerRepository runners;
    private final AccountDeletionService deletion;
    private final ApiRateLimiter rates;
    private final TransactionTemplate tx;
    public ExplorerDeletion(ExplorerStore store,AuthService auth,RunnerRepository runners,AccountDeletionService deletion,ApiRateLimiter rates,PlatformTransactionManager manager) {
        this.store=store;this.auth=auth;this.runners=runners;this.deletion=deletion;this.rates=rates;this.tx=new TransactionTemplate(manager);
    }
    public Map<String,Object> request(Runner runner,Map<String,Object> body) {
        if(!body.keySet().equals(Set.of("confirmation","password"))||!"DELETE".equals(body.get("confirmation"))||!(body.get("password") instanceof String password)||password.length()>512) throw new ResponseStatusException(BAD_REQUEST,"Confirm deletion and enter your account password.");
        if(!rates.allow("explorer-delete:"+runner.getId(),5,900)) throw new ResponseStatusException(TOO_MANY_REQUESTS,"Try reauthentication later.");
        if(auth.authenticate(runner.getEmail(),password).filter(r->r.getId().equals(runner.getId())).isEmpty()) throw new ResponseStatusException(FORBIDDEN,"Account reauthentication failed.");
        return tx.execute(status->{
            var owner=store.lock(runner);String receipt=secret();UUID id=UUID.randomUUID();
            store.jdbc().update("INSERT INTO statshunters.deletion_requests(id,runner_id,receipt_hash) VALUES(?,?,?)",id,runner.getId(),hash(receipt));
            store.jdbc().update("UPDATE statshunters.account_profiles SET state='deleting',dataset_revision=dataset_revision+1 WHERE id=? AND runner_id=?",owner.id(),owner.runnerId());
            Runner locked=runners.findByIdForUpdate(runner.getId()).orElseThrow();locked.setDeleted(true);auth.invalidateSession(locked);
            store.jdbc().update("UPDATE statshunters.background_jobs SET cancel_requested=true,input='{}' WHERE user_id=?",owner.id());
            return map("id",id.toString(),"token",receipt,"state","queued");
        });
    }
    public Map<String,Object> receipt(String token) {
        if(token==null||!token.matches("[a-f0-9]{64}")) throw new ResponseStatusException(NOT_FOUND,"Receipt unavailable.");
        var rows=store.jdbc().queryForList("SELECT state,created_at,completed_at FROM statshunters.deletion_requests WHERE receipt_hash=?",hash(token));
        if(rows.isEmpty())throw new ResponseStatusException(NOT_FOUND,"Receipt unavailable.");
        var row=rows.get(0);return map("state",row.get("state"),"requestedAt",((Timestamp)row.get("created_at")).toInstant().toString(),"completedAt",row.get("completed_at")==null?null:((Timestamp)row.get("completed_at")).toInstant().toString());
    }
    void tick() {
        var request=tx.execute(status->{
            store.jdbc().update("UPDATE statshunters.deletion_requests SET state=CASE WHEN attempts>=6 THEN 'failed' ELSE 'retry' END,lease_owner=NULL,lease_expires_at=NULL WHERE state='running' AND lease_expires_at<now()");
            var rows=store.jdbc().queryForList("SELECT id,runner_id FROM statshunters.deletion_requests WHERE state IN ('queued','retry') AND run_after<=now() ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED");
            if(rows.isEmpty())return null;var row=rows.get(0);UUID lease=UUID.randomUUID();row.put("lease",lease);
            store.jdbc().update("UPDATE statshunters.deletion_requests SET state='running',attempts=attempts+1,lease_owner=?,lease_expires_at=now()+interval '30 minutes' WHERE id=?",lease,row.get("id"));return row;
        });
        if(request==null)return;
        try {
            deletion.deleteAccount(((Number)request.get("runner_id")).longValue());
            store.jdbc().update("UPDATE statshunters.deletion_requests SET state='complete',runner_id=NULL,completed_at=now(),lease_owner=NULL,lease_expires_at=NULL,error_code=NULL WHERE id=? AND lease_owner=?",request.get("id"),request.get("lease"));
        }catch(Exception failure) {
            store.jdbc().update("UPDATE statshunters.deletion_requests SET state=CASE WHEN attempts>=6 THEN 'failed' ELSE 'retry' END,run_after=now()+interval '1 minute'*power(2,least(attempts,6)),error_code='PURGE_FAILED',lease_owner=NULL,lease_expires_at=NULL WHERE id=? AND lease_owner=?",request.get("id"),request.get("lease"));
        }
    }
}
