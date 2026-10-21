package com.hermes.backend.explorer;

import com.hermes.backend.activity.*;
import com.hermes.backend.auth.ApiRateLimiter;
import com.hermes.backend.imports.*;
import com.hermes.backend.runner.*;
import java.io.IOException;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;
import static com.hermes.backend.explorer.ExplorerJson.*;

@Service
@ConditionalOnProperty(name="app.explorer.enabled",havingValue="true")
public class ExplorerImports {
    private final ExplorerStore store;
    private final RunnerRepository runners;
    private final ActivityImportService importer;
    private final ActivityRepository activities;
    private final List<ActivityFileParser> parsers;
    private final TransactionTemplate tx;
    private final ApiRateLimiter rates;
    public ExplorerImports(ExplorerStore store,RunnerRepository runners,ActivityImportService importer,ActivityRepository activities,
            List<ActivityFileParser> parsers,PlatformTransactionManager manager,ApiRateLimiter rates) {
        this.store=store;this.runners=runners;this.importer=importer;this.activities=activities;this.parsers=parsers;this.tx=new TransactionTemplate(manager);this.rates=rates;
    }
    record Upload(String filename,String format,byte[] bytes,String hash) {}
    public Map<String,Object> enqueue(Runner runner,List<MultipartFile> files,boolean attested,String key) throws IOException {
        if(!attested) throw new ResponseStatusException(BAD_REQUEST,"Confirm independent source permission.");
        if(key==null||!key.matches("[A-Za-z0-9_-]{8,128}")) throw new ResponseStatusException(BAD_REQUEST,"An Idempotency-Key is required.");
        if(files==null||files.isEmpty()||files.size()>20) throw new ResponseStatusException(BAD_REQUEST,"Choose between one and twenty files.");
        if(!rates.allow("explorer-import:"+runner.getId(),30,3600)) throw new ResponseStatusException(TOO_MANY_REQUESTS,"Import rate limit reached.");
        List<Upload> uploads=new ArrayList<>();long total=0;
        for(MultipartFile file:files) {
            if(file.isEmpty()||file.getSize()>50L*1024*1024||(total+=file.getSize())>100L*1024*1024) throw new ResponseStatusException(PAYLOAD_TOO_LARGE,"File or batch size limit exceeded.");
            String name=Objects.toString(file.getOriginalFilename(),"");
            if(name.length()>180||name.chars().anyMatch(Character::isISOControl)||name.contains("/")||name.contains("\\")) throw new ResponseStatusException(BAD_REQUEST,"Use a plain source filename.");
            String format=name.substring(name.lastIndexOf('.')+1).toUpperCase(Locale.ROOT);
            if(!Set.of("GPX","TCX","FIT").contains(format)) throw new ResponseStatusException(BAD_REQUEST,"Use FIT, GPX or TCX source files.");
            byte[] bytes=file.getBytes();uploads.add(new Upload(name,format,bytes,hash(bytes)));
        }
        String requestHash=hash(write(uploads.stream().map(u->map("name",u.filename,"format",u.format,"hash",u.hash)).toList()));
        return tx.execute(status->{
            var owner=store.lock(runner);
            var previous=store.jdbc().queryForList("SELECT id,request_hash FROM statshunters.background_jobs WHERE user_id=? AND dedupe_key=?",owner.id(),key);
            if(!previous.isEmpty()) {
                if(!requestHash.equals(previous.get(0).get("request_hash"))) throw new ResponseStatusException(CONFLICT,"The idempotency key was used with different files.");
                return map("id",previous.get(0).get("id"));
            }
            long stored=store.jdbc().queryForObject("SELECT coalesce(sum(octet_length(bytes)),0) FROM statshunters.file_assets WHERE user_id=?",Long.class,owner.id());
            if(stored+totalBytes(uploads)>1024L*1024*1024) throw new ResponseStatusException(PAYLOAD_TOO_LARGE,"This account has reached its 1 GiB source storage limit.");
            UUID job=UUID.randomUUID();store.jdbc().update("INSERT INTO statshunters.background_jobs(id,user_id,kind,dedupe_key,request_hash) VALUES(?,?,'import',?,?)",job,owner.id(),key,requestHash);
            int ordinal=0;for(var upload:uploads) store.jdbc().update("INSERT INTO statshunters.file_assets(id,user_id,job_id,ordinal,filename,format,source_hash,classification,attested_at,bytes) VALUES(?,?,?,?,?,?,?,'authorized_file',now(),?)",
                    UUID.randomUUID(),owner.id(),job,ordinal++,upload.filename,upload.format,upload.hash,upload.bytes);
            return map("id",job.toString());
        });
    }
    private long totalBytes(List<Upload> uploads){return uploads.stream().mapToLong(u->u.bytes.length).sum();}
    /** One file is one transaction. Checkpoints and projection publish with the canonical write. */
    void process(UUID user,UUID job,UUID lease) {
        List<UUID> files=store.jdbc().query("SELECT id FROM statshunters.file_assets WHERE user_id=? AND job_id=? AND state='queued' ORDER BY ordinal",(rs,n)->rs.getObject(1,UUID.class),user,job);
        for(UUID file:files) {
            var source=store.jdbc().queryForMap("SELECT filename,format,bytes FROM statshunters.file_assets WHERE id=? AND user_id=? AND job_id=?",file,user,job);
            ParsedActivityData parsed;
            ExplorerGeometry.Prepared prepared;
            try {
                String format=(String)source.get("format");
                parsed=parsers.stream().filter(p->p.supports(format)).findFirst().orElseThrow().parseForExplorer((String)source.get("filename"),(byte[])source.get("bytes"));
                prepared=ExplorerGeometry.prepare(parsed);
                if(parsed.distanceMeters()!=null && ExplorerGeometry.finite(parsed.distanceMeters())==null) throw new IllegalArgumentException("Invalid source distance.");
                if(parsed.durationSeconds()!=null && (parsed.durationSeconds()<0||parsed.durationSeconds()>315576000L)) throw new IllegalArgumentException("Invalid source duration.");
            } catch(IllegalArgumentException invalid) {
                tx.executeWithoutResult(s->{assertLease(job,user,lease);store.jdbc().update("UPDATE statshunters.file_assets SET state='failed',error_code='INVALID_SOURCE' WHERE id=? AND user_id=?",file,user);});continue;
            }
            tx.executeWithoutResult(status->{
                Long runnerId=store.jdbc().queryForObject("SELECT runner_id FROM statshunters.account_profiles WHERE id=?",Long.class,user);
                Runner runner=runners.findByIdForUpdate(runnerId).filter(r->!r.isDeleted()).orElseThrow();
                var owner=store.lock(runner);assertLease(job,user,lease);
                boolean cancelled=Boolean.TRUE.equals(store.jdbc().queryForObject("SELECT cancel_requested FROM statshunters.background_jobs WHERE id=? AND user_id=?",Boolean.class,job,user));
                if(cancelled) {store.jdbc().update("UPDATE statshunters.file_assets SET state='cancelled' WHERE user_id=? AND job_id=? AND state='queued'",user,job);return;}
                var asset=store.jdbc().queryForMap("SELECT * FROM statshunters.file_assets WHERE id=? AND user_id=? FOR UPDATE",file,user);
                if(!"queued".equals(asset.get("state"))) return;
                String digest=(String)asset.get("source_hash");
                var duplicate=store.jdbc().queryForList("SELECT legacy_activity_id FROM statshunters.activity_facts WHERE user_id=? AND source_hash=?",user,digest);
                if(!duplicate.isEmpty()) {store.jdbc().update("UPDATE statshunters.file_assets SET state='duplicate',activity_id=? WHERE id=? AND user_id=?",duplicate.get(0).get("legacy_activity_id"),file,user);return;}
                long points=store.jdbc().queryForObject("SELECT coalesce(sum(point_count),0) FROM statshunters.activity_facts WHERE user_id=?",Long.class,user);
                if(points+parsed.points().size()>2_000_000) {store.jdbc().update("UPDATE statshunters.file_assets SET state='failed',error_code='ACCOUNT_POINT_LIMIT' WHERE id=? AND user_id=?",file,user);return;}
                Activity activity=activities.findByRunnerAndProviderAndSourceChecksum(runner,ImportProvider.MANUAL,digest).orElseGet(()->importer.importIndependentActivity(runner,(String)asset.get("filename"),digest,parsed));
                UUID fact=UUID.randomUUID();String sport=ExplorerGeometry.sport(parsed),subtype=ExplorerGeometry.subtype(parsed.source().originalSubtype());
                Double distance=parsed.distanceMeters();
                // GPX has geometry-derived distance; remove artificial jumps between source segments.
                if("GPX".equals(asset.get("format"))) distance=prepared.distanceM();
                var all=prepared.segments().stream().flatMap(Collection::stream).toList();
                Map<String,Object> bounds=all.isEmpty()?null:map("south",all.stream().mapToDouble(p->((Number)p.get("lat")).doubleValue()).min().orElseThrow(),"north",all.stream().mapToDouble(p->((Number)p.get("lat")).doubleValue()).max().orElseThrow(),
                        "west",all.stream().mapToDouble(p->((Number)p.get("lon")).doubleValue()).min().orElseThrow(),"east",all.stream().mapToDouble(p->((Number)p.get("lon")).doubleValue()).max().orElseThrow());
                Map<String,Object> metadata=map("bounds",bounds,"averageHr",ExplorerGeometry.finite(parsed.averageHeartRate()),"quality",map("precision","full-source","breaks",prepared.breaks(),"movingTimeEstimated",!"FIT".equals(asset.get("format")),"gridVersion","z14-half-open-v1","retainedCellCount",prepared.cells().size()),
                        "source",map("classification","authorized_file","format",asset.get("format"),"filename",asset.get("filename"),"hash",digest,"attestedAt",((Timestamp)asset.get("attested_at")).toInstant().toString(),
                                "originalSport",parsed.source().originalSport(),"originalSubtype",parsed.source().originalSubtype(),"recordedOffset",parsed.source().recordedOffset()));
                store.jdbc().update("""
                    INSERT INTO statshunters.activity_facts(id,user_id,runner_id,legacy_activity_id,source_hash,start_at,name,sport,subtype,commute,trainer,gear,distance_m,moving_seconds,elapsed_seconds,ascent_m,point_count,metadata)
                    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb)
                    """,fact,user,runnerId,activity.getId(),digest,Timestamp.from(parsed.startTime().toInstant(ZoneOffset.UTC)),limitName(parsed.name()),sport,subtype,parsed.source().commute(),parsed.source().trainer(),safeGear(parsed.source().gear()),
                        distance,parsed.durationSeconds(),parsed.source().elapsedSeconds(),prepared.ascentM(),parsed.points().size(),write(metadata));
                store.jdbc().update("INSERT INTO statshunters.track_segments(user_id,activity_id,segments) VALUES(?,?,?::jsonb)",user,fact,write(prepared.segments()));
                List<String> cells=new ArrayList<>(prepared.cells());
                store.jdbc().batchUpdate("INSERT INTO statshunters.activity_tiles(user_id,activity_id,x,y) VALUES(?,?,?,?)",cells,500,(statement,cell)->{String[] xy=cell.split(":");statement.setObject(1,user);statement.setObject(2,fact);statement.setInt(3,Integer.parseInt(xy[0]));statement.setInt(4,Integer.parseInt(xy[1]));});
                store.jdbc().update("UPDATE statshunters.file_assets SET state='complete',activity_id=? WHERE id=? AND user_id=?",activity.getId(),file,user);store.bump(owner);
            });
        }
    }
    private String limitName(String name){return name==null||name.isBlank()?"Imported activity":name.substring(0,Math.min(255,name.length())).replaceAll("[\\p{Cntrl}]","");}
    private String safeGear(String name){return name==null?null:name.substring(0,Math.min(160,name.length())).replaceAll("[\\p{Cntrl}]","");}
    void assertLease(UUID job,UUID user,UUID lease) {
        int count=store.jdbc().queryForObject("SELECT count(*) FROM statshunters.background_jobs WHERE id=? AND user_id=? AND state='running' AND lease_owner=? AND lease_expires_at>now()",Integer.class,job,user,lease);
        if(count!=1) throw new IllegalStateException("Job lease expired.");
        store.jdbc().update("UPDATE statshunters.background_jobs SET lease_expires_at=now()+interval '10 minutes' WHERE id=? AND user_id=? AND lease_owner=?",job,user,lease);
    }
}
