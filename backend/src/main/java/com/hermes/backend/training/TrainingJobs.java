package com.hermes.backend.training;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static com.hermes.backend.training.TrainingStore.*;
import static com.hermes.backend.training.TrainingFailure.check;

/** Private raw-file queue. Work runs outside the short claim transaction; importer deduplicates replay. */
public final class TrainingJobs {
    @FunctionalInterface public interface Importer {Map<String,Object> run(String actor,Path file,String name)throws Exception;}
    final TrainingStore db;final Path root;final Importer importer;
    public TrainingJobs(TrainingStore db,Path root,Importer importer){this.db=db;this.root=root.toAbsolutePath().normalize();this.importer=importer;try{Files.createDirectories(this.root);}catch(IOException e){throw new IllegalStateException("Private upload storage unavailable",e);}}
    Path file(String id){Path path=root.resolve(TrainingStore.id(id)+".upload").normalize();check(path.startsWith(root),500,"INVALID_PRIVATE_PATH");return path;}
    public Map<String,Object> enqueue(String actor,String name,byte[] content,String key){
        check(name!=null&&name.length()<=160&&name.matches("[\\p{L}\\p{N} _().-]+\\.(?i:gpx|tcx|fit|zip|gz)")&&!name.contains(".."),422,"UNSUPPORTED_UPLOAD");check(content!=null&&content.length>0&&content.length<=20*1024*1024,413,"UPLOAD_SIZE_LIMIT");
        String digest;try{digest=HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(content));}catch(Exception e){throw new IllegalStateException(e);}
        return db.command(actor,"FILE_IMPORT",key,map("name",name,"sha256",digest),()->db.lock(actor),()->{
            check(((Number)db.one("select count(*) as total from tw_job where actor_id=? and state in ('queued','retry','running')",actor).get("total")).intValue()<10,429,"IMPORT_QUEUE_LIMIT");
            String id=uuid();try{Files.write(file(id),content,StandardOpenOption.CREATE_NEW);TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCompletion(int status){if(status!=STATUS_COMMITTED)remove(id);}});db.jdbc.update("insert into tw_job(id,actor_id,kind,state,available_at,payload) values(?,?,'import','queued',?,?)",id,actor,System.currentTimeMillis(),db.encode(map("name",name)));}
            catch(Exception e){remove(id);throw new TrainingFailure(503,"IMPORT_QUEUE_UNAVAILABLE");}return map("id",id,"state","queued");
        });
    }
    public Map<String,Object> status(String actor,String id){var j=db.one("select * from tw_job where id=? and actor_id=?",id(id),actor);return map("id",id,"state",j.get("state"),"attempts",j.get("attempts"),"result",j.get("result")==null?null:db.object(j.get("result")),"errorCode",j.get("error_code"));}
    public Map<String,Object> cancel(String actor,String id){return db.atomic(()->{var j=db.one("select * from tw_job where id=? and actor_id=? for update",id(id),actor);String state=(String)j.get("state");
        if(Set.of("queued","retry").contains(state)){db.jdbc.update("update tw_job set state='cancelled' where id=?",id);removeAfterCommit(id);}else if(state.equals("running"))db.jdbc.update("update tw_job set state='cancel_requested' where id=?",id);return status(actor,id);});}
    public boolean workOnce(){TrainingFiles.sweep(db,root);var job=db.atomic(()->{
        var candidates=db.rows("select * from tw_job where kind='import' and ((state in ('queued','retry') and available_at<=?) or (state in ('running','cancel_requested') and lease_until<?)) order by available_at,id fetch first 1 rows only for update",System.currentTimeMillis(),System.currentTimeMillis());
        if(candidates.isEmpty())return null;var j=candidates.get(0);String id=(String)j.get("id");int attempts=((Number)j.get("attempts")).intValue()+1;
        if("cancel_requested".equals(j.get("state"))){db.jdbc.update("update tw_job set state='cancelled',lease_until=null where id=?",id);removeAfterCommit(id);return null;}
        if(attempts>5){db.jdbc.update("update tw_job set state='dead',error_code='RETRY_LIMIT' where id=?",id);removeAfterCommit(id);return null;}
        db.jdbc.update("update tw_job set state='running',attempts=?,lease_until=? where id=?",attempts,System.currentTimeMillis()+600000,id);j.put("attempts",attempts);return j;
    });if(job==null)return false;
        String id=(String)job.get("id"),actor=(String)job.get("actor_id");try{
            var payload=db.object(job.get("payload"));db.atomic(()->{
                // Canonical importer joins this transaction. A cancellation or erased/fenced job
                // rolls back its activity writes before publication.
                try{var imported=importer.run(actor,file(id),(String)payload.get("name"));var current=db.rows("select state,attempts from tw_job where id=? for update",id);
                    check(!current.isEmpty()&&"running".equals(current.get(0).get("state"))&&current.get(0).get("attempts").equals(job.get("attempts")),409,"IMPORT_CANCELLED_OR_FENCED");
                    db.jdbc.update("update tw_job set state='succeeded',result=?,lease_until=null,error_code=null where id=?",db.encode(imported),id);TrainingFiles.enqueue(db,id);db.audit(actor,actor,"IMPORT_COMPLETED");return true;
                }catch(RuntimeException failure){throw failure;}catch(Exception failure){throw new TrainingFailure(503,"IMPORT_FAILED");}
            });
            TrainingFiles.sweep(db,root);
        }catch(Exception failure){int attempts=((Number)job.get("attempts")).intValue();boolean cancelled=db.atomic(()->{boolean changed=db.jdbc.update("update tw_job set state='cancelled',lease_until=null where id=? and attempts=? and state='cancel_requested'",id,attempts)==1;if(changed)TrainingFiles.enqueue(db,id);return changed;});if(cancelled){TrainingFiles.sweep(db,root);return true;}boolean won=db.atomic(()->{boolean changed=db.jdbc.update("update tw_job set state=?,error_code='IMPORT_FAILED',lease_until=null,available_at=? where id=? and attempts=? and state='running'",attempts>=5?"dead":"retry",System.currentTimeMillis()+(1L<<attempts)*1000,id,attempts)==1;if(changed&&attempts>=5)TrainingFiles.enqueue(db,id);return changed;});if(won&&attempts>=5)TrainingFiles.sweep(db,root);}
        return true;
    }
    void remove(String id){var tx=new org.springframework.transaction.support.TransactionTemplate(db.tx.getTransactionManager());tx.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);tx.execute(status->{TrainingFiles.enqueue(db,id);return true;});TrainingFiles.sweep(db,root);}
    void removeAfterCommit(String id){TrainingFiles.enqueue(db,id);TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCommit(){TrainingFiles.sweep(db,root);}});}
    public static MultipartFile upload(Path path,String name){return new MultipartFile(){
        public String getName(){return "file";}public String getOriginalFilename(){return name;}public String getContentType(){return "application/octet-stream";}
        public boolean isEmpty(){return getSize()==0;}public long getSize(){try{return Files.size(path);}catch(IOException e){throw new TrainingFailure(503,"PRIVATE_FILE_MISSING");}}
        public byte[] getBytes()throws IOException{return Files.readAllBytes(path);}public InputStream getInputStream()throws IOException{return Files.newInputStream(path);}
        public void transferTo(File target)throws IOException{Files.copy(path,target.toPath());}
    };}
}
