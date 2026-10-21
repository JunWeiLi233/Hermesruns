package com.hermes.backend.training;

import org.junit.jupiter.api.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static com.hermes.backend.training.TrainingStore.map;

class TrainingMessageTests extends TrainingFixture {
 @Test void directConversationWithoutActivityReusesTheSameParticipantsFromEitherSide(){
  var grant=acl.request(coach,athlete,"read",List.of());acl.decide(athlete,(String)grant.get("id"),"accepted");
  var chat=new TrainingMessages(db,acl,teams,new TrainingLibrary(db,acl));
  var first=chat.open(coach,map("kind","direct","peerId",athlete));
  assertThat(chat.open(coach,map("kind","direct","peerId",athlete))).isEqualTo(first);
  assertThat(chat.open(athlete,map("kind","direct","peerId",coach))).isEqualTo(first);
  assertThat(db.rows("select id from tw_conversation where kind='direct' and activity_id is null")).hasSize(1);
 }
 @Test void groupPostingAndSharedWorkoutAccessFollowCurrentMembership(){
  var lib=new TrainingLibrary(db,acl);var chat=new TrainingMessages(db,acl,teams,lib);lib.conversationAccess=chat::canRead;
  String team=(String)teams.create(admin,"Original group").get("id");teams.join(athlete,team);teams.member(admin,team,athlete,"member");
  var group=chat.open(admin,map("kind","group","teamId",team));String cid=(String)group.get("id");
  var w=lib.saveWorkout(admin,null,map("title","Shared session","source","10m @70% Steady","sport","Running"),null);
  chat.send(admin,cid,map("body","An original group note","workoutId",w.get("id")));
  assertThat(lib.workout(athlete,(String)w.get("id"),1)).isNotEmpty();
  teams.update(admin,team,map("posting","staff"),2);
  assertThatThrownBy(()->chat.send(athlete,cid,map("body","Not staff"))).isInstanceOf(TrainingFailure.class);
  teams.member(admin,team,athlete,"removed");
  assertThatThrownBy(()->chat.messages(athlete,cid)).isInstanceOf(TrainingFailure.class);
  assertThatThrownBy(()->lib.workout(athlete,(String)w.get("id"),1)).isInstanceOf(TrainingFailure.class);
 }
 @Test void unrelatedUserCannotReadOrSendInDirectThread(){
  var g=acl.request(coach,athlete,"read",List.of());acl.decide(athlete,(String)g.get("id"),"accepted");
  var chat=new TrainingMessages(db,acl,teams,new TrainingLibrary(db,acl));String id=(String)chat.open(coach,map("kind","direct","peerId",athlete)).get("id");
  chat.send(coach,id,map("body","Original private note"));
  assertThatThrownBy(()->chat.messages(stranger,id)).isInstanceOf(TrainingFailure.class);
  assertThatThrownBy(()->chat.send(stranger,id,map("body","intrusion"))).isInstanceOf(TrainingFailure.class);
 }
 @Test void commandKeyRejectsDifferentContentAndReturnsOnePersistedResult(){
  var count=new java.util.concurrent.atomic.AtomicInteger();String key=UUID.randomUUID().toString();
  var one=db.command(athlete,"test",key,map("value",1),()->{},()->map("count",count.incrementAndGet()));
  var replay=db.command(athlete,"test",key,map("value",1),()->{},()->map("count",count.incrementAndGet()));
  assertThat(replay).isEqualTo(one);assertThat(count.get()).isEqualTo(1);
  assertThatThrownBy(()->db.command(athlete,"test",key,map("value",2),()->{},()->map("count",2))).isInstanceOf(TrainingFailure.class);
  assertThatThrownBy(()->db.command(athlete,"test",key,map("value",1),()->{throw new TrainingFailure(404,"NOT_FOUND");},()->map("count",2))).isInstanceOf(TrainingFailure.class);
 }
 @Test void revocationClosesExistingDirectThreadAndItsWorkoutReferences(){
  var grant=acl.request(coach,athlete,"read",List.of());acl.decide(athlete,(String)grant.get("id"),"accepted");
  var lib=new TrainingLibrary(db,acl);var chat=new TrainingMessages(db,acl,teams,lib);lib.conversationAccess=chat::canRead;
  String cid=(String)chat.open(coach,map("kind","direct","peerId",athlete)).get("id");
  var workout=lib.saveWorkout(athlete,null,map("title","Private reference","source","10m @70% Easy","sport","Running"),null);
  chat.send(athlete,cid,map("body","Private note","workoutId",workout.get("id")));assertThat(chat.messages(coach,cid)).isNotEmpty();
  acl.decide(athlete,(String)grant.get("id"),"revoked");
  assertThatThrownBy(()->chat.messages(coach,cid)).isInstanceOf(TrainingFailure.class);
  assertThatThrownBy(()->chat.send(coach,cid,map("body","Stale access"))).isInstanceOf(TrainingFailure.class);
  assertThatThrownBy(()->lib.workout(coach,(String)workout.get("id"),1)).isInstanceOf(TrainingFailure.class);
 }
}
