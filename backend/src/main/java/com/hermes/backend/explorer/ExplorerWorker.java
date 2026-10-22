package com.hermes.backend.explorer;

import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** PostgreSQL queue: atomic claims, bounded retries, durable checkpoints and terminal dead-letter state. */
@Component
@ConditionalOnProperty(name="app.explorer.enabled",havingValue="true")
public class ExplorerWorker {
    private final ExplorerStore store;
    private final ExplorerImports imports;
    private final ExplorerMail mail;
    private final ExplorerDeletion deletion;
    private final TransactionTemplate tx;
    public ExplorerWorker(ExplorerStore store,ExplorerImports imports,ExplorerMail mail,ExplorerDeletion deletion,PlatformTransactionManager manager) {
        this.store=store;this.imports=imports;this.mail=mail;this.deletion=deletion;this.tx=new TransactionTemplate(manager);
    }
    @Scheduled(fixedDelayString="${app.explorer.worker-delay-ms:2000}",initialDelayString="${app.explorer.worker-delay-ms:2000}")
    public void tick() {
        deletion.tick();
        Map<String,Object> job=tx.execute(status->{
            store.jdbc().update("UPDATE statshunters.background_jobs SET state=CASE WHEN attempts>=6 THEN 'failed' ELSE 'retry' END,error_code='LEASE_EXPIRED',lease_owner=NULL,lease_expires_at=NULL WHERE state='running' AND lease_expires_at<now()");
            var rows=store.jdbc().queryForList("SELECT j.id,j.user_id,j.kind FROM statshunters.background_jobs j JOIN statshunters.account_profiles p ON p.id=j.user_id AND p.state='active' WHERE j.state IN ('queued','retry') AND j.run_after<=now() ORDER BY j.created_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED");
            if(rows.isEmpty())return null;
            var next=rows.get(0);UUID lease=UUID.randomUUID();
            store.jdbc().update("UPDATE statshunters.background_jobs SET state='running',attempts=attempts+1,lease_owner=?,lease_expires_at=now()+interval '10 minutes',updated_at=now() WHERE id=? AND user_id=?",lease,next.get("id"),next.get("user_id"));
            next.put("lease",lease);return next;
        });
        if(job==null)return;
        UUID id=(UUID)job.get("id"),user=(UUID)job.get("user_id"),lease=(UUID)job.get("lease");
        try {
            if("import".equals(job.get("kind"))) imports.process(user,id,lease);else mail.process(user,id,lease);
            tx.executeWithoutResult(s->{
                imports.assertLease(id,user,lease);
                int failed=store.jdbc().queryForObject("SELECT count(*) FROM statshunters.file_assets WHERE user_id=? AND job_id=? AND state='failed'",Integer.class,user,id);
                store.jdbc().update("UPDATE statshunters.background_jobs SET state=CASE WHEN cancel_requested THEN 'cancelled' WHEN ? THEN 'failed' ELSE 'complete' END,input='{}',lease_owner=NULL,lease_expires_at=NULL,updated_at=now(),error_code=CASE WHEN ? THEN 'FILE_REJECTED' ELSE NULL END WHERE id=? AND user_id=? AND lease_owner=?",failed>0,failed>0,id,user,lease);
            });
        } catch(Exception failure) {
            // Never log source data, filenames, mailbox addresses, tokens or parser exceptions.
            store.jdbc().update("UPDATE statshunters.background_jobs SET state=CASE WHEN attempts>=6 THEN 'failed' ELSE 'retry' END,run_after=now()+interval '30 seconds'*power(2,least(attempts,6)),lease_owner=NULL,lease_expires_at=NULL,error_code='PROCESSING_FAILED',updated_at=now() WHERE id=? AND user_id=? AND lease_owner=?",id,user,lease);
        }
    }
}
