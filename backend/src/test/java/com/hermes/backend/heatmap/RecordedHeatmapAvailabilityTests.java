package com.hermes.backend.heatmap;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:recorded-heatmap-unavailable;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.explorer.enabled=false",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class RecordedHeatmapAvailabilityTests {
    @Autowired private MockMvc requests;
    @Autowired private AuthService auth;
    @Autowired private RunnerRepository runners;
    @Autowired private ApplicationContext application;
    @Autowired private JdbcTemplate database;

    @Test
    void disabledStorageReportsUnavailableWithoutExecutingPostgresQueriesAndKeepsTheLegacyMap() throws Exception {
        Runner runner = runners.saveAndFlush(new Runner("map-availability-" + UUID.randomUUID() + "@hermes.test", "active"));
        String bearer = "Bearer " + auth.issueSessionToken(runner);

        requests.perform(get("/api/profile/heatmap/explorer")).andExpect(status().isUnauthorized());
        requests.perform(get("/api/profile/heatmap/explorer").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.available").value(false));
        assertThat(application.getBeansOfType(RecordedHeatmapController.class)).isEmpty();
        requests.perform(get("/api/profile/heatmap/preferences").header("Authorization", bearer))
                .andExpect(status().isNotFound());
        requests.perform(post("/api/profile/heatmap/query").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
        requests.perform(get("/api/profile/heatmap").header("Authorization", bearer)).andExpect(status().isOk());
        assertThat(database.queryForObject("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = 'STATSHUNTERS'", Integer.class))
                .isZero();
    }

    @Test
    void theExistingExplorerFlagStillRegistersThePostgresMapEndpoints() {
        new ApplicationContextRunner().withPropertyValues("app.explorer.enabled=true")
                .withBean(AuthService.class, () -> mock(AuthService.class))
                .withBean(RecordedHeatmapService.class, () -> mock(RecordedHeatmapService.class))
                .withUserConfiguration(RecordedHeatmapController.class)
                .run(context -> assertThat(context).hasSingleBean(RecordedHeatmapController.class));
    }
}
