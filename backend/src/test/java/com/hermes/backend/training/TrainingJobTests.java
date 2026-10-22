package com.hermes.backend.training;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static com.hermes.backend.training.TrainingStore.map;

class TrainingJobTests extends TrainingFixture {
 @TempDir Path dir;
 @Test void importIsDurableOwnerScopedAndDeletesItsPrivateRawFile(){
  var count=new java.util.concurrent.atomic.AtomicInteger();var jobs=new TrainingJobs(db,dir,(actor,path,name)->{count.incrementAndGet();return map("state","imported");});
  var j=jobs.enqueue(athlete,"original.gpx","<gpx/>".getBytes(),UUID.randomUUID().toString());String id=(String)j.get("id");
  assertThatThrownBy(()->jobs.status(stranger,id)).isInstanceOf(TrainingFailure.class);
  assertThat(jobs.workOnce()).isTrue();assertThat(jobs.workOnce()).isFalse();assertThat(count.get()).isEqualTo(1);
  assertThat(jobs.status(athlete,id).get("state")).isEqualTo("succeeded");try(var files=Files.list(dir)){assertThat(files.toList()).isEmpty();}catch(Exception e){throw new RuntimeException(e);}
 }
 @Test void failedJobsRetryWithoutLeakingPayloadInStatus(){
  var jobs=new TrainingJobs(db,dir,(actor,path,name)->{throw new IllegalArgumentException("private source details");});
  String id=(String)jobs.enqueue(athlete,"original.tcx","<tcx/>".getBytes(),UUID.randomUUID().toString()).get("id");jobs.workOnce();
  assertThat(jobs.status(athlete,id).toString()).doesNotContain("private source details",dir.toString());
  assertThat(jobs.status(athlete,id).get("state")).isEqualTo("retry");
 }
 @Test void uploadLimitsTraversalAndCancellationAreEnforced(){
  var jobs=new TrainingJobs(db,dir,(actor,path,name)->map("state","imported"));
  assertThatThrownBy(()->jobs.enqueue(athlete,"../../secrets.txt",new byte[]{1},UUID.randomUUID().toString())).isInstanceOf(TrainingFailure.class);
  String id=(String)jobs.enqueue(athlete,"original.fit",new byte[]{1},UUID.randomUUID().toString()).get("id");jobs.cancel(athlete,id);
  assertThat(jobs.workOnce()).isFalse();assertThat(jobs.status(athlete,id).get("state")).isEqualTo("cancelled");
 }
 @Test void expiredAttemptCannotOverwriteOrDeleteANewerClaim(){
  var jobs=new TrainingJobs(db,dir,(actor,path,name)->{String id=path.getFileName().toString().replace(".upload","");independent(()->db.jdbc.update("update tw_job set attempts=2,state='running' where id=?",id));return map("state","imported");});
  String id=(String)jobs.enqueue(athlete,"original.gpx",new byte[]{1},UUID.randomUUID().toString()).get("id");jobs.workOnce();
  assertThat(jobs.status(athlete,id).get("state")).isEqualTo("running");assertThat(Files.exists(jobs.file(id))).isTrue();
 }
 void independent(Runnable work){var tx=new org.springframework.transaction.support.TransactionTemplate(db.tx.getTransactionManager());tx.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);tx.execute(status->{work.run();return true;});}
 @Test void runningCancellationRollsBackImportWritesAndRemovesRawFile(){
  var jobs=new TrainingJobs(db,dir,(actor,path,name)->{String id=path.getFileName().toString().replace(".upload","");db.jdbc.update("insert into tw_season(id,athlete_id,payload) values(?,?,?)",UUID.randomUUID().toString(),actor,"{}");independent(()->db.jdbc.update("update tw_job set state='cancel_requested' where id=?",id));return map("state","imported");});
  String id=(String)jobs.enqueue(athlete,"original.gpx",new byte[]{1},UUID.randomUUID().toString()).get("id");jobs.workOnce();
  assertThat(jobs.status(athlete,id).get("state")).isEqualTo("cancelled");assertThat(db.rows("select id from tw_season where athlete_id=?",athlete)).isEmpty();assertThat(Files.exists(jobs.file(id))).isFalse();
 }
 @Test void failedPrivateDeletionRetainsAnAccountIndependentRetryHandle()throws Exception{
  String id=UUID.randomUUID().toString();Path blocked=dir.resolve(id+".upload");Files.createDirectory(blocked);Files.writeString(blocked.resolve("blocker"),"synthetic");
  TrainingFiles.enqueue(db,id);TrainingFiles.sweep(db,dir);assertThat(db.rows("select id from tw_file_cleanup where id=?",id)).hasSize(1);
  Files.delete(blocked.resolve("blocker"));TrainingFiles.sweep(db,dir);assertThat(Files.exists(blocked)).isFalse();assertThat(db.rows("select id from tw_file_cleanup where id=?",id)).isEmpty();
 }
 @Test void terminalStateAndCleanupHandleCommitTogetherEvenWhenDeletionFails()throws Exception{
  var jobs=new TrainingJobs(db,dir,(actor,path,name)->{Files.delete(path);Files.createDirectory(path);Files.writeString(path.resolve("blocker"),"synthetic");return map("state","imported");});
  String id=(String)jobs.enqueue(athlete,"original.gpx",new byte[]{1},UUID.randomUUID().toString()).get("id");jobs.workOnce();
  assertThat(jobs.status(athlete,id).get("state")).isEqualTo("succeeded");assertThat(db.rows("select id from tw_file_cleanup where id=?",id)).hasSize(1);
  Files.delete(jobs.file(id).resolve("blocker"));jobs.workOnce();assertThat(db.rows("select id from tw_file_cleanup where id=?",id)).isEmpty();assertThat(Files.exists(jobs.file(id))).isFalse();
 }
}
