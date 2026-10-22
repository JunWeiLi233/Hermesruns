package com.hermes.backend.explorer;

import com.hermes.backend.runner.Runner;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static com.hermes.backend.explorer.ExplorerJson.*;
import static org.springframework.http.HttpStatus.*;

@Service
@ConditionalOnProperty(name="app.explorer.enabled",havingValue="true")
public class ExplorerJobs {
    private final ExplorerStore store;
    public ExplorerJobs(ExplorerStore store){this.store=store;}
    public Map<String,Object> list(Runner runner) {
        var owner=store.owner(runner);
        var ids=store.jdbc().query("SELECT id FROM statshunters.background_jobs WHERE user_id=? AND kind='import' ORDER BY created_at DESC,id LIMIT 100",(rs,n)->rs.getObject(1,UUID.class),owner.id());
        return map("items",ids.stream().map(id->get(owner,id)).toList(),"revision",owner.revision());
    }
    public Map<String,Object> get(Runner runner,UUID id){return get(store.owner(runner),id);}
    private Map<String,Object> get(ExplorerStore.Owner owner,UUID id) {
        var rows=store.jdbc().queryForList("SELECT id,state,kind,attempts,error_code,cancel_requested,created_at FROM statshunters.background_jobs WHERE user_id=? AND id=?",owner.id(),id);
        if(rows.isEmpty()) throw new ResponseStatusException(NOT_FOUND,"Import request unavailable.");
        var job=rows.get(0);
        var files=store.jdbc().queryForList("SELECT filename,state,activity_id,error_code FROM statshunters.file_assets WHERE user_id=? AND job_id=? ORDER BY ordinal",owner.id(),id)
                .stream().map(file->map("name",file.get("filename"),"state",file.get("state"),"activityId",file.get("activity_id"),"error",file.get("error_code"))).toList();
        long done=files.stream().filter(file->!"queued".equals(file.get("state"))).count();
        return map("id",id.toString(),"kind",job.get("kind"),"state",job.get("state"),"createdAt",((java.sql.Timestamp)job.get("created_at")).toInstant().toString(),"attempts",job.get("attempts"),"cancelRequested",job.get("cancel_requested"),
                "error",job.get("error_code"),"files",files,"completed",done,"total",files.size(),"revision",owner.revision());
    }
    @Transactional
    public Map<String,Object> cancel(Runner runner,UUID id) {
        var owner=store.lock(runner);get(owner,id);
        store.jdbc().update("UPDATE statshunters.background_jobs SET cancel_requested=true WHERE user_id=? AND id=? AND state IN ('queued','retry','running')",owner.id(),id);
        store.jdbc().update("UPDATE statshunters.file_assets SET state='cancelled' WHERE user_id=? AND job_id=? AND state='queued' AND EXISTS(SELECT 1 FROM statshunters.background_jobs j WHERE j.id=job_id AND j.state IN ('queued','retry'))",owner.id(),id);
        store.jdbc().update("UPDATE statshunters.background_jobs SET state='cancelled',lease_owner=NULL,lease_expires_at=NULL WHERE user_id=? AND id=? AND state IN ('queued','retry')",owner.id(),id);
        return get(owner,id);
    }
}
