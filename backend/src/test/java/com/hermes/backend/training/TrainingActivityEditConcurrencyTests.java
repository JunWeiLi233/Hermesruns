package com.hermes.backend.training;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.coaching.ActivityTrainingMetricsRepository;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Both writers share one canonical run; the workspace revision is still its own optimistic edit guard. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:workspace-native-edit;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.training-workspace.enabled=true",
        "app.training-workspace.migrate=true",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class TrainingActivityEditConcurrencyTests {
    @Autowired private TrainingStore db;
    @MockitoSpyBean private TrainingAthletes athletes;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityTrainingMetricsRepository metrics;
    @Autowired private AuthService auth;
    @Autowired private MockMvc requests;

    @AfterEach
    void restoreAthleteReads() {
        Mockito.reset(athletes);
    }

    @Test
    void workspaceRatingCannotOverwriteANativeTitleAndNotesCommittedAfterItsRead() throws Exception {
        Runner runner = runners.saveAndFlush(new Runner("shared-edit-" + UUID.randomUUID() + "@hermes.test", "active"));
        String owner = db.ensure(runner.getId(), "Concurrent editor", "America/New_York");
        Activity activity = new Activity();
        activity.setRunner(runner);
        activity.setName("Original title");
        activity.setNotes("Original notes");
        activity.setActivityType(ActivityType.RUN);
        activity.setProvider(ImportProvider.MANUAL);
        activity.setStartTime(LocalDateTime.of(2026, 10, 14, 12, 0));
        activity.setMovingTimeSeconds(1800);
        activity.setDurationSeconds(1800L);
        activity.setDistanceKm(5d);
        activity.setDistanceMeters(5000d);
        activity = activities.saveAndFlush(activity);
        long activityId = activity.getId();
        Map<String, Object> binding = athletes.fromCanonical(owner, activityId);
        String workspaceId = (String) binding.get("id");
        long revision = ((Number) binding.get("revision")).longValue();
        String bearer = "Bearer " + auth.issueSessionToken(runner);
        var workspaceHasRead = new CountDownLatch(1);
        var nativeCommitted = new CountDownLatch(1);
        doAnswer(call -> {
            Activity oldCopy = (Activity) call.callRealMethod();
            assertThat(oldCopy.getName()).isEqualTo("Original title");
            workspaceHasRead.countDown();
            if (!nativeCommitted.await(15, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Native edit could not finish while the workspace held its profile lock");
            }
            return oldCopy;
        }).when(athletes).canonical(anyMap(), anyString());

        var pool = Executors.newSingleThreadExecutor();
        try {
            var workspace = pool.submit(() -> athletes.effort(owner, workspaceId, Map.of("rpe", 7), revision));
            assertThat(workspaceHasRead.await(10, TimeUnit.SECONDS)).isTrue();
            // The workspace transaction has read the old entity and holds tw_profile, but the native edit can commit.
            requests.perform(patch("/api/activities/{id}", activityId)
                            .header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Native title\",\"notes\":\"Native notes\"}"))
                    .andExpect(status().isOk());
            nativeCommitted.countDown();
            Map<String, Object> saved = workspace.get(20, TimeUnit.SECONDS);
            assertThat(saved.get("title")).isEqualTo("Native title");
            assertThat(saved.get("rpe")).isEqualTo(7);
            assertThat(((Number) saved.get("revision")).longValue()).isEqualTo(revision + 1);

            Activity stored = activities.findById(activityId).orElseThrow();
            assertThat(stored.getName()).isEqualTo("Native title");
            assertThat(stored.getNotes()).isEqualTo("Native notes");
            assertThat(stored.isNameEdited()).isTrue();
            assertThat(stored.getPerceivedExertion()).isEqualTo(7);
            assertThat(metrics.findByActivityIdAndRunnerId(activityId, runner.getId()).orElseThrow()
                    .getPerceivedExertionUsed()).isEqualTo(7);
        } finally {
            nativeCommitted.countDown();
            pool.shutdownNow();
        }
    }
}
