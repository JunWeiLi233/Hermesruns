package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:manual-run-tests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE","spring.datasource.driver-class-name=org.h2.Driver","spring.jpa.hibernate.ddl-auto=create-drop","app.official-course.startup-seed.enabled=false","strava.sync.enabled=false","garmin.wellness.sync.enabled=false","app.coach.nightly.enabled=false","app.local-shared-runner.enabled=false"})
class ManualRunIntegrationTests {
    @Autowired ManualRunService service;
    @Autowired RunnerRepository runners;
    @Autowired ActivityRepository activities;
    @Autowired ManualRunReceiptRepository receipts;
    @Autowired ManualRunCleanup cleanup;
    @Autowired ActivityDataAccess deletion;
    @Autowired PlatformTransactionManager transactions;
    Runner owner(){Runner runner=new Runner();runner.setEmail(UUID.randomUUID()+"@example.com");runner.setPassword("unused");return runners.saveAndFlush(runner);}
    ManualRunService.Request request(String key){return new ManualRunService.Request(key,"2026-10-01T12:00:00Z","America/New_York",5200,1930,"Manual run");}
    @Test void savesRealManualFactsAndReplaysWithoutDuplication(){
        Runner owner=owner();var request=request(UUID.randomUUID().toString());var first=service.save(owner.getId(),request);var replay=service.save(owner.getId(),request);
        assertThat(replay.id()).isEqualTo(first.id());assertThat(replay.replayed()).isTrue();assertThat(activities.countByRunner(owner)).isEqualTo(1);
        Activity actual=activities.findByIdAndRunner(Long.valueOf(first.id()),owner).orElseThrow();assertThat(actual.getProvider()).isEqualTo(ImportProvider.MANUAL);assertThat(actual.getDistanceMeters()).isEqualTo(5200d);assertThat(actual.getDurationSeconds()).isEqualTo(1930);new TransactionTemplate(transactions).executeWithoutResult(status->assertThat(activities.findByIdAndRunner(Long.valueOf(first.id()),owner).orElseThrow().getPoints()).isEmpty());
    }
    @Test void sameKeyCannotWriteAnotherPayload(){Runner owner=owner();String key=UUID.randomUUID().toString();service.save(owner.getId(),request(key));assertThatThrownBy(()->service.save(owner.getId(),new ManualRunService.Request(key,"2026-10-01T12:00:00Z","America/New_York",7000,1930,"Manual run"))).isInstanceOf(ManualRunService.Conflict.class).hasMessage("SAVE_KEY_REUSED");}
    @Test void keysAndReadsAreScopedToTheirOwner(){Runner one=owner(),two=owner();String key=UUID.randomUUID().toString();var a=service.save(one.getId(),request(key));var b=service.save(two.getId(),request(key));assertThat(a.id()).isNotEqualTo(b.id());assertThat(activities.findByIdAndRunner(Long.valueOf(a.id()),two)).isEmpty();}
    @Test void deletionKeepsReplayMarkerAndAccountCleanupRemovesIt(){Runner owner=owner();String key=UUID.randomUUID().toString();var saved=service.save(owner.getId(),request(key));assertThat(deletion.deleteActivityForRunner(Long.valueOf(saved.id()),owner)).isTrue();var marker=receipts.findByRunnerIdAndClientKey(owner.getId(),key).orElseThrow();assertThat(marker.getName()).isNull();assertThat(marker.getStartedAt()).isNull();assertThatThrownBy(()->service.save(owner.getId(),request(key))).hasMessage("RUN_DELETED");new TransactionTemplate(transactions).executeWithoutResult(status->cleanup.purge(owner.getId()));assertThat(receipts.findByRunnerIdAndClientKey(owner.getId(),key)).isEmpty();}
    @Test void invalidNumbersAndInstantsCreateNoRun(){Runner owner=owner();assertThatThrownBy(()->service.save(owner.getId(),new ManualRunService.Request(UUID.randomUUID().toString(),"2026-10-01T12:00:00Z","UTC",-1,200,"Run"))).isInstanceOf(IllegalArgumentException.class);assertThatThrownBy(()->service.save(owner.getId(),new ManualRunService.Request(UUID.randomUUID().toString(),"missing","UTC",1000,200,"Run"))).isInstanceOf(IllegalArgumentException.class);assertThat(activities.countByRunner(owner)).isZero();}
}
