package com.hermes.backend.activity;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.util.ArrayList;
import java.util.UUID;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Hibernate's native parameter binding must be covered as well as direct JDBC execution of the SQL. */
@SpringBootTest(properties = {
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.hikari.maximum-pool-size=4",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.jakarta.persistence.query.timeout=3000",
        "app.official-course.startup-seed.enabled=false",
        "app.local-shared-runner.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false"
})
@AutoConfigureMockMvc
class ActivityPointRoutePreviewRepositoryTests {
    @DynamicPropertySource
    static void disposableFileDatabase(DynamicPropertyRegistry properties) throws Exception {
        Path build = Path.of(ActivityPointRoutePreviewRepositoryTests.class.getProtectionDomain().getCodeSource().getLocation().toURI()).getParent();
        Path directory = Files.createTempDirectory(build, "route-preview-h2-");
        properties.add("spring.datasource.url", () -> "jdbc:h2:file:" + directory.resolve("preview").toString().replace('\\', '/') + ";DB_CLOSE_ON_EXIT=FALSE");
    }

    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private AuthService auth;
    @Autowired private MockMvc mvc;

    @Test
    void nativePreviewBindingIsBoundedAndTheEndpointKeepsOnlyOwnedRuns() throws Exception {
        Runner owner = runner();
        Runner other = runner();
        Activity first = run(owner, 1_500);
        Activity second = run(owner, 481);
        Activity foreign = run(other, 500);
        long started = System.nanoTime();
        var result = mvc.perform(get("/api/activities/route-previews")
                        .header("Authorization", "Bearer " + auth.issueSessionToken(owner))
                        .param("ids", first.getId() + "," + foreign.getId() + "," + second.getId()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long millis = (System.nanoTime() - started) / 1_000_000;
        assertThat(millis).as("native preview request must not spend minutes in decimal division").isLessThan(3_000);
        var previews = new ObjectMapper().readTree(result);
        assertThat(previews).hasSize(2);
        assertThat(previews.get(0).get("activityId").asLong()).isEqualTo(first.getId());
        assertThat(previews.get(1).get("activityId").asLong()).isEqualTo(second.getId());
        assertThat(previews.get(0).get("pointCount").asInt()).isEqualTo(1_500);
        assertThat(previews.get(1).get("pointCount").asInt()).isEqualTo(481);
        for (var preview : previews) assertThat(preview.get("points").size()).isBetween(2, 241);
    }

    @Test
    void nativePreviewBindingKeepsAFullPageOfLongRoutesBounded() throws Exception {
        Runner owner = runner();
        Runner other = runner();
        var ids = new ArrayList<Long>();
        for (int index = 0; index < 50; index++) ids.add(run(owner, 2_000).getId());
        for (int index = 0; index < 70; index++) run(index % 2 == 0 ? owner : other, 2_000);
        long started = System.nanoTime();
        var result = mvc.perform(get("/api/activities/route-previews")
                        .header("Authorization", "Bearer " + auth.issueSessionToken(owner))
                        .param("ids", ids.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long millis = (System.nanoTime() - started) / 1_000_000;
        assertThat(millis).as("50 native previews among 240 000 points must not repeat a full scan per sampled row").isLessThan(3_000);
        var previews = new ObjectMapper().readTree(result);
        assertThat(previews).hasSize(50);
        for (int index = 0; index < ids.size(); index++) {
            var preview = previews.get(index);
            assertThat(preview.get("activityId").asLong()).isEqualTo(ids.get(index));
            assertThat(preview.get("pointCount").asInt()).isEqualTo(2_000);
            assertThat(preview.get("points").size()).isEqualTo(224);
        }
    }

    @Test
    void overlappingConcurrentPagesKeepEveryMixedLengthNonsequentialRoute() throws Exception {
        Runner owner = runner();
        Runner other = runner();
        Map<Long, Integer> lengths = new LinkedHashMap<>();
        int[] sizes = {601, 801, 701, 1_401};
        for (int index = 0; index < 121; index++) {
            int size = sizes[index % sizes.length];
            lengths.put(run(owner, size).getId(), size);
            if (index % 3 == 0) run(other, 601);
        }
        List<Long> ids = List.copyOf(lengths.keySet());
        String token = auth.issueSessionToken(owner);
        for (int offset : new int[]{0, 20, 40, 60, 0, 40}) {
            assertMixedPreview(ids.subList(offset, offset + 50), lengths, token);
        }
        for (long id : ids.subList(80, 110)) assertMixedPreview(List.of(id), lengths, token);
        var pool = Executors.newFixedThreadPool(4);
        try {
            for (int round = 0; round < 2; round++) {
                var tasks = new ArrayList<Callable<Void>>();
                for (int offset : new int[]{0, 20, 40, 60}) tasks.add(() -> {
                    List<Long> batch = ids.subList(offset, offset + 50);
                    assertMixedPreview(batch, lengths, token);
                    return null;
                });
                for (var result : pool.invokeAll(tasks, 5, TimeUnit.SECONDS)) result.get();
            }
        } finally {
            pool.shutdownNow();
        }
    }

    private void assertMixedPreview(List<Long> batch, Map<Long, Integer> lengths, String token) throws Exception {
        var body = mvc.perform(get("/api/activities/route-previews")
                        .header("Authorization", "Bearer " + token)
                        .param("ids", batch.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var previews = new ObjectMapper().readTree(body);
        assertThat(previews).hasSize(batch.size());
        for (int index = 0; index < batch.size(); index++) {
            long id = batch.get(index);
            int size = lengths.get(id);
            var preview = previews.get(index);
            assertThat(preview.get("activityId").asLong()).isEqualTo(id);
            assertThat(preview.get("pointCount").asInt()).isEqualTo(size);
            int step = 1 + (size - 1) / 240;
            int expected = 1 + (size - 1) / step + ((size - 1) % step == 0 ? 0 : 1);
            var points = preview.get("points");
            assertThat(points.size()).as("complete geometry for activity %s, length %s", id, size).isEqualTo(expected);
            assertThat(points.get(0).get("latitude").asDouble()).isEqualTo(40 + id * .000001 + .00001);
            assertThat(points.get(expected - 1).get("latitude").asDouble()).isEqualTo(40 + id * .000001 + size * .00001);
            assertThat(points.get(0).get("longitude").asDouble()).isEqualTo(-73 + .00001);
            assertThat(points.get(expected - 1).get("longitude").asDouble()).isEqualTo(-73 + size * .00001);
        }
    }

    private Runner runner() {
        Runner runner = new Runner("preview-native-" + UUID.randomUUID() + "@hermes.test", "ACTIVE");
        runner.setRole("USER");
        runner.setEmailVerified(true);
        return runners.saveAndFlush(runner);
    }

    private Activity run(Runner runner, int points) {
        Activity run = new Activity();
        run.setRunner(runner);
        run.setActivityType(ActivityType.RUN);
        run = activities.saveAndFlush(run);
        var rows = new ArrayList<Object[]>();
        for (int index = 1; index <= points; index++) rows.add(new Object[]{run.getId(), index, 40 + run.getId() * .000001 + index * .00001, -73 + index * .00001});
        jdbc.batchUpdate("insert into activity_points(activity_id,sequence_index,latitude,longitude) values (?,?,?,?)", rows);
        return run;
    }
}
