package com.hermes.backend.admin;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.races.GeneratedRaceGpxAsset;
import com.hermes.backend.races.GeneratedRaceGpxPersistenceService;
import com.hermes.backend.races.MarathonRouteMatchAndExportService.MarathonRouteMatchAndExportResult;
import com.hermes.backend.races.MarathonRoutePipelineRequest;
import com.hermes.backend.races.MarathonRoutePipelineService;
import com.hermes.backend.races.MarathonRoutePipelineService.PipelineResult;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The pipeline runs on a worker thread and the finished job, result included, is sent back as JSON on a later request.
 * The result holds the saved GPX asset, whose runner is a lazy association: for a race that already had an asset it is a
 * proxy of a session that closed with the worker's transaction, which nothing can read any more.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:admin-route-extraction-status;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class AdminRouteExtractionJobStatusTests {

    @Autowired private AdminRouteExtractionController controller;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private GeneratedRaceGpxPersistenceService persistence;
    @MockitoBean private MarathonRoutePipelineService pipeline;

    private Runner admin() {
        Runner admin = new Runner("route-admin-" + UUID.randomUUID() + "@hermes.test", "active");
        admin.setRole("ADMIN");
        return runners.saveAndFlush(admin);
    }

    private GeneratedRaceGpxAsset save(Runner runner, String raceId) {
        return persistence.save(runner, raceId, "Race", "City", "Country", "https://race.example", 42.195, "<gpx/>");
    }

    /** Runs a job whose pipeline ends with this asset and waits for it to finish. */
    private String finishedJobWith(Runner admin, GeneratedRaceGpxAsset asset) throws InterruptedException {
        when(pipeline.runPipeline(any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PipelineResult(null, null,
                        new MarathonRouteMatchAndExportResult(List.of(), "<gpx/>", asset, "note")));
        String bearer = "Bearer " + authService.issueSessionToken(admin);
        ResponseEntity<?> started = controller.runPipeline(bearer,
                new MarathonRoutePipelineRequest("race-x", "Race", "City", "Country", "Web", 42.2, "Path"));
        @SuppressWarnings("unchecked")
        String jobId = ((Map<String, String>) started.getBody()).get("jobId");
        long deadline = System.currentTimeMillis() + 15_000;
        while (System.currentTimeMillis() < deadline) {
            if (((AdminRouteExtractionController.JobStatus) controller.getJobStatus(bearer, jobId).getBody()).state
                    == AdminRouteExtractionController.JobState.SUCCESS) {
                break;
            }
            Thread.sleep(20);
        }
        return jobId;
    }

    private MockMvc requests() {
        return MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void theStatusOfAJobThatReplacedAnExistingAssetCanBeRead() throws Exception {
        Runner admin = admin();
        String raceId = "race-" + UUID.randomUUID();
        save(admin, raceId);
        GeneratedRaceGpxAsset replaced = save(admin, raceId);
        String jobId = finishedJobWith(admin, replaced);

        requests().perform(get("/api/admin/marathon-pipeline/jobs/{id}", jobId)
                        .header("Authorization", "Bearer " + authService.issueSessionToken(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("SUCCESS"));
    }

    @Test
    void theStatusOfAJobThatSavedANewAssetCanBeRead() throws Exception {
        Runner admin = admin();
        GeneratedRaceGpxAsset created = save(admin, "race-" + UUID.randomUUID());
        String jobId = finishedJobWith(admin, created);

        requests().perform(get("/api/admin/marathon-pipeline/jobs/{id}", jobId)
                        .header("Authorization", "Bearer " + authService.issueSessionToken(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("SUCCESS"))
                .andExpect(jsonPath("$.result.matchExportResult.persistedAsset.raceName").value("Race"));
    }
}
