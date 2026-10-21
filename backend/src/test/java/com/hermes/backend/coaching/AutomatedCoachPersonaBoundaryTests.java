package com.hermes.backend.coaching;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.verify;

/** Real HTTP, authentication, service, JPQL and disposable H2. Fixtures are repository-seeded,
 * not browser imports. The planner spy observes inputs and executes the unmodified real planner. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT, properties = {
        "server.address=127.0.0.1",
        "server.port=8267",
        "spring.datasource.url=jdbc:h2:mem:persona_boundary_r4;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.devtools.restart.enabled=false",
        "app.mail.provider=disabled",
        "app.local-shared-runner.enabled=false",
        "app.local-shared-runner.seed-mock-data=false",
        "app.official-course.startup-seed.enabled=false",
        "app.course-map.bulk-scan.enabled=false",
        "app.course-map.bulk-seed.enabled=false",
        "app.training.async=false",
        "app.training.catchup-on-startup=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "logging.level.org.springframework.boot.security.autoconfigure=OFF"
})
@Import(AutomatedCoachPersonaBoundaryTests.ClockFixture.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@Execution(ExecutionMode.SAME_THREAD)
class AutomatedCoachPersonaBoundaryTests {
    private static final ZoneId ACCOUNT_ZONE = ZoneId.of("America/New_York");
    private static final Instant ORDINARY = Instant.parse("2026-10-11T04:00:00Z");
    private static final long DAY_SECONDS = 86_400;
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    @Autowired private MutableCoachClock clock;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private CoachRunnerStateRepository states;
    @Autowired private AutomatedCoachService service;
    @Autowired private AuthService auth;
    @MockitoSpyBean private PersonalizedRunningPlanner planner;

    @BeforeEach
    void resetClockAndObservation() {
        clock.setInstant(ORDINARY);
        clearInvocations(planner);
    }

    @ParameterizedTest
    @CsvSource({
            "2026-10-11T04:00:00Z,14",
            "2026-03-09T04:30:00Z,15",
            "2026-11-02T04:30:00Z,13"
    })
    void samePersistedLastRunCrossesInclusiveFourteenElapsedDays(String exactTime, int calendarDaysAtExact)
            throws Exception {
        Instant exact = Instant.parse(exactTime);
        Fixture f = fixture(List.of(run(exact.minusSeconds(14 * DAY_SECONDS), 5),
                run(exact.minusSeconds(20 * DAY_SECONDS), 5), run(exact.minusSeconds(27 * DAY_SECONDS), 5)));
        List<Map<String, Object>> rowsBefore = persistedRows(f);
        for (int clockOffset : new int[] {-1, 0, 1}) {
            Instant now = exact.plusSeconds(clockOffset);
            clock.setInstant(now);
            Observation actual = observe(f, now, "exact14-" + exact.getEpochSecond() + "-" + (clockOffset + 1), true);
            assertThat(actual.body().path("runnerState").asText())
                    .as("same persisted latest run; elapsed age %s seconds", 14 * DAY_SECONDS + clockOffset)
                    .isEqualTo(clockOffset <= 0 ? "active" : "comeback");
            assertThat(persistedRows(f)).isEqualTo(rowsBefore);
            if (clockOffset == 0) {
                assertThat(actual.history().daysSinceLastRun()).isEqualTo(calendarDaysAtExact);
            }
            if (clockOffset == 1) {
                assertThat(actual.body().path("coachMessage").asText()).contains("14 days since your last run");
            }
        }
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 2})
    void fewerThanThreeTotalRunsRemainNewEvenWhenTheLastRunIsOutsideFourteenDays(int totalRuns) throws Exception {
        List<Seed> seeds = new ArrayList<>();
        for (int i = 0; i < totalRuns; i++) {
            seeds.add(run(ORDINARY.minusSeconds((14 + i) * DAY_SECONDS + 1), 5));
        }
        Fixture f = fixture(seeds);
        Observation actual = observe(f, ORDINARY, "new-count-" + totalRuns, true);
        assertThat(actual.body().path("runnerState").asText()).isEqualTo("new");
        assertThat(actual.history().totalRuns()).isEqualTo(totalRuns);
    }

    @Test
    void onlyRunRecordsCountTowardTheThirdRunThreshold() throws Exception {
        List<Seed> seeds = new ArrayList<>(List.of(run(ORDINARY.minusSeconds(20 * DAY_SECONDS), 5),
                run(ORDINARY.minusSeconds(27 * DAY_SECONDS), 5),
                new Seed(ORDINARY.minusSeconds(DAY_SECONDS), 40, 3600, ActivityType.NON_RUN)));
        Fixture f = fixture(seeds);
        assertThat(observe(f, ORDINARY, "third-run-before", true).body().path("runnerState").asText()).isEqualTo("new");
        Seed third = run(ORDINARY.minusSeconds(14 * DAY_SECONDS), 5);
        f.seeds().add(third);
        f.ids().add(persist(f.runner(), third).getId());
        service.reaggregateRunner(f.runner().getId());
        clearInvocations(planner);
        Observation exact = observe(f, ORDINARY, "third-run-exact", true);
        assertThat(exact.history().totalRuns()).isEqualTo(3);
        assertThat(exact.body().path("runnerState").asText()).isEqualTo("active");
        clock.setInstant(ORDINARY.plusSeconds(1));
        assertThat(observe(f, ORDINARY.plusSeconds(1), "third-run-outside", true)
                .body().path("runnerState").asText()).isEqualTo("comeback");
    }

    @ParameterizedTest
    @CsvSource({"0.0,comeback", "0.05,comeback", "0.050001,active"})
    void effectivelyZeroPersistedVolumeGuardIsInclusive(double persistedVolume, String expectedPersona)
            throws Exception {
        Fixture f = fixture(List.of(run(ORDINARY.minusSeconds(DAY_SECONDS), 5),
                run(ORDINARY.minusSeconds(20 * DAY_SECONDS), 5), run(ORDINARY.minusSeconds(27 * DAY_SECONDS), 5)));
        // Explicit existing-state fixture: bypass aggregate rounding to test the exact stored guard.
        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(f.runner());
        state.setVolumeKm28d(persistedVolume);
        state.setLastAggregatedAt(LocalDateTime.ofInstant(ORDINARY, ZoneOffset.UTC));
        states.saveAndFlush(state);
        Observation actual = observe(f, ORDINARY, "volume-guard-" + Double.toString(persistedVolume), false);
        assertThat(actual.body().path("state").path("volumeKm28d").asDouble()).isEqualTo(persistedVolume);
        assertThat(actual.body().path("runnerState").asText()).isEqualTo(expectedPersona);
    }

    @ParameterizedTest
    @ValueSource(strings = {"2026-10-11T04:00:00Z", "2026-03-09T04:30:00Z", "2026-11-02T04:30:00Z"})
    void historyCalendarWindowsAreCheckedSeparatelyFromElapsedAggregates(String timestamp) throws Exception {
        Instant now = Instant.parse(timestamp);
        clock.setInstant(now);
        Fixture f = fixture(List.of(
                run(now.minusSeconds(7 * DAY_SECONDS + 1), 1),
                run(now.minusSeconds(7 * DAY_SECONDS), 2),
                run(now.minusSeconds(7 * DAY_SECONDS - 1), 3),
                run(now.minusSeconds(28 * DAY_SECONDS + 1), 4),
                run(now.minusSeconds(28 * DAY_SECONDS), 5),
                run(now.minusSeconds(28 * DAY_SECONDS - 1), 6),
                run(now, 7), run(now.plusSeconds(1), 8)));
        Observation actual = observe(f, now, "history-windows-" + now.getEpochSecond(), true);
        assertThat(actual.body().path("state").path("volumeKm7d").asDouble()).isEqualTo(12);
        assertThat(actual.body().path("state").path("volumeKm28d").asDouble()).isEqualTo(24);
        assertThat(actual.history().volume7Km()).isNotEqualTo(12);
        assertThat(actual.history().volume28Km()).isNotEqualTo(24);
    }

    @Test
    void aFutureRunDoesNotMakeAnEstablishedReturningRunnerActive() throws Exception {
        Fixture f = fixture(List.of(run(ORDINARY.minusSeconds(14 * DAY_SECONDS + 1), 5),
                run(ORDINARY.minusSeconds(20 * DAY_SECONDS), 5), run(ORDINARY.minusSeconds(27 * DAY_SECONDS), 5),
                run(ORDINARY.plusSeconds(1), 32)));
        Observation actual = observe(f, ORDINARY, "future-exclusion", true);
        assertThat(actual.history().totalRuns()).isEqualTo(4);
        assertThat(actual.history().hoursSinceHardRun()).isNull();
        assertThat(actual.body().path("runnerState").asText()).isEqualTo("comeback");
        assertThat(actual.body().path("state").path("volumeKm28d").asDouble()).isEqualTo(15);
    }

    private Fixture fixture(List<Seed> seeds) {
        Runner runner = new Runner("persona-r4-" + UUID.randomUUID() + "@hermes.test", "ACTIVE");
        runner.setRole("USER");
        runner.setTimeZone(ACCOUNT_ZONE.getId());
        runner.setMaxHeartRateBpm(180);
        runner = runners.saveAndFlush(runner);
        List<Long> ids = new ArrayList<>();
        for (Seed seed : seeds) ids.add(persist(runner, seed).getId());
        return new Fixture(runner, new ArrayList<>(seeds), ids, "Bearer " + auth.issueSessionToken(runner));
    }

    private Activity persist(Runner runner, Seed seed) {
        Activity activity = new Activity();
        activity.setRunner(runner);
        activity.setName("persona boundary synthetic fixture");
        activity.setActivityType(seed.type());
        activity.setStartTime(LocalDateTime.ofInstant(seed.instant(), ZoneOffset.UTC));
        activity.setCreatedAt(LocalDateTime.ofInstant(ORDINARY, ZoneOffset.UTC));
        activity.setDistanceKm(seed.km());
        activity.setDistanceMeters(seed.km() * 1000);
        activity.setMovingTimeSeconds(seed.seconds());
        activity.setDurationSeconds((long) seed.seconds());
        return activities.saveAndFlush(activity);
    }

    private static Seed run(Instant instant, double km) {
        return new Seed(instant, km, (int) Math.round(km * 390), ActivityType.RUN);
    }

    private Observation observe(Fixture f, Instant now, String label, boolean checkAggregates) throws Exception {
        clearInvocations(planner);
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:8267/api/coach/today"))
                .timeout(Duration.ofSeconds(20)).header("Authorization", f.bearer()).GET().build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode body = json.readTree(response.body());
        assertThat(response.statusCode()).as("real authenticated coach HTTP status").isEqualTo(200);
        ArgumentCaptor<PersonalizedRunningPlanner.PlannerInput> input =
                ArgumentCaptor.forClass(PersonalizedRunningPlanner.PlannerInput.class);
        verify(planner).plan(input.capture());
        PersonalizedRunningPlanner.RunHistory history = input.getValue().history();
        Map<String, Object> expected = expectedHistory(f.seeds(), now);
        Map<String, Object> observedHistory = historyFields(history);
        Map<String, Object> receipt = new LinkedHashMap<>();
        receipt.put("provenance", "real loopback HTTP/authentication/service/JPQL/H2; repository-seeded synthetic records; supported test Clock; real planner spy only observes input");
        receipt.put("now", now.toString());
        receipt.put("accountZone", ACCOUNT_ZONE.getId());
        receipt.put("expectedHistory", expected);
        receipt.put("observedHistory", observedHistory);
        receipt.put("expectedPersona", expectedPersona(f.seeds(), now, body.path("state").path("volumeKm28d").asDouble()));
        receipt.put("persistedRows", persistedRows(f));
        receipt.put("httpStatus", response.statusCode());
        receipt.put("actualApiBody", body);
        writeReceipt(label, receipt);
        assertThat(body.path("today").path("scheduledDate").asText()).isEqualTo(now.atZone(ACCOUNT_ZONE).toLocalDate().toString());
        assertThat(input.getValue().today()).isEqualTo(now.atZone(ACCOUNT_ZONE).toLocalDate());
        assertThat(observedHistory).containsAllEntriesOf(expected);
        assertThat(body.path("runnerState").asText())
                .isEqualTo(expectedPersona(f.seeds(), now, body.path("state").path("volumeKm28d").asDouble()));
        if (checkAggregates) {
            assertThat(body.path("state").path("volumeKm7d").asDouble()).isEqualTo(elapsedKm(f.seeds(), now, 7));
            assertThat(body.path("state").path("volumeKm28d").asDouble()).isEqualTo(elapsedKm(f.seeds(), now, 28));
        }
        return new Observation(body, history);
    }

    // Independent oracle: fixture instants and epoch seconds, not production temporal helpers,
    // repository-returned membership, reflection into private service methods, or planner output.
    private static Map<String, Object> expectedHistory(List<Seed> seeds, Instant now) {
        LocalDate today = now.atZone(ACCOUNT_ZONE).toLocalDate();
        List<Seed> elapsed90 = seeds.stream().filter(seed -> seed.type() == ActivityType.RUN)
                .filter(seed -> now.getEpochSecond() - seed.instant().getEpochSecond() >= 0)
                .filter(seed -> now.getEpochSecond() - seed.instant().getEpochSecond() <= 90 * DAY_SECONDS).toList();
        List<Seed> calendar28 = elapsed90.stream()
                .filter(seed -> calendarAge(seed, today) >= 0 && calendarAge(seed, today) < 28).toList();
        double km28 = calendar28.stream().mapToDouble(Seed::km).sum();
        double km7 = elapsed90.stream().filter(seed -> calendarAge(seed, today) >= 0 && calendarAge(seed, today) < 7)
                .mapToDouble(Seed::km).sum();
        Instant latest = elapsed90.stream().map(Seed::instant).max(Instant::compareTo).orElse(null);
        Instant hard = elapsed90.stream().filter(seed -> seed.km() >= 16 || seed.seconds() >= 5400)
                .map(Seed::instant).max(Instant::compareTo).orElse(null);
        Map<String, Integer> dayCounts = new LinkedHashMap<>();
        calendar28.forEach(seed -> dayCounts.merge(seed.instant().atZone(ACCOUNT_ZONE).getDayOfWeek().name(), 1, Integer::sum));
        Map<String, Object> expected = new LinkedHashMap<>();
        expected.put("totalRuns", (int) seeds.stream().filter(seed -> seed.type() == ActivityType.RUN).count());
        expected.put("runDays28", (int) calendar28.stream().map(seed -> seed.instant().atZone(ACCOUNT_ZONE).toLocalDate()).distinct().count());
        expected.put("volume7Km", round1(km7 > 0 ? km7 : elapsedKm(seeds, now, 7)));
        expected.put("volume28Km", round1(km28 > 0 ? km28 : elapsedKm(seeds, now, 28)));
        expected.put("averageRunKm", calendar28.isEmpty() ? 0.0 : round1(km28 / calendar28.size()));
        expected.put("longestRunKm28", calendar28.stream().mapToDouble(Seed::km).max().orElse(0.0));
        expected.put("averagePaceSecondsPerKm", km28 == 0 ? 0.0 : round1(calendar28.stream().mapToInt(Seed::seconds).sum() / km28));
        expected.put("highIntensityRatio7d", 0.0);
        expected.put("hoursSinceHardRun", hard == null ? null : (int) ((now.getEpochSecond() - hard.getEpochSecond()) / 3600));
        expected.put("daysSinceLastRun", latest == null ? null : (int) ChronoUnit.DAYS.between(latest.atZone(ACCOUNT_ZONE).toLocalDate(), today));
        expected.put("preferredDayCounts", dayCounts);
        return expected;
    }

    private static long calendarAge(Seed seed, LocalDate today) {
        return ChronoUnit.DAYS.between(seed.instant().atZone(ACCOUNT_ZONE).toLocalDate(), today);
    }

    private static double elapsedKm(List<Seed> seeds, Instant now, int days) {
        return round1(seeds.stream().filter(seed -> seed.type() == ActivityType.RUN)
                .filter(seed -> now.getEpochSecond() - seed.instant().getEpochSecond() >= 0)
                .filter(seed -> now.getEpochSecond() - seed.instant().getEpochSecond() <= days * DAY_SECONDS)
                .mapToDouble(Seed::km).sum());
    }

    private static String expectedPersona(List<Seed> seeds, Instant now, double volume28) {
        if (seeds.stream().filter(seed -> seed.type() == ActivityType.RUN).count() < 3) return "new";
        boolean recent = seeds.stream().filter(seed -> seed.type() == ActivityType.RUN).anyMatch(seed -> {
            long age = now.getEpochSecond() - seed.instant().getEpochSecond();
            return age >= 0 && age <= 14 * DAY_SECONDS;
        });
        return recent && volume28 > 0.05 ? "active" : "comeback";
    }

    private static Map<String, Object> historyFields(PersonalizedRunningPlanner.RunHistory history) {
        Map<String, Object> actual = new LinkedHashMap<>();
        actual.put("totalRuns", history.totalRuns());
        actual.put("runDays28", history.runDays28());
        actual.put("volume7Km", history.volume7Km());
        actual.put("volume28Km", history.volume28Km());
        actual.put("averageRunKm", history.averageRunKm());
        actual.put("longestRunKm28", history.longestRunKm28());
        actual.put("averagePaceSecondsPerKm", history.averagePaceSecondsPerKm());
        actual.put("highIntensityRatio7d", history.highIntensityRatio7d());
        actual.put("hoursSinceHardRun", history.hoursSinceHardRun());
        actual.put("daysSinceLastRun", history.daysSinceLastRun());
        Map<String, Integer> dayCounts = new LinkedHashMap<>();
        history.preferredDayCounts().forEach((day, count) -> dayCounts.put(day.name(), count));
        actual.put("preferredDayCounts", dayCounts);
        return actual;
    }

    private List<Map<String, Object>> persistedRows(Fixture fixture) {
        return activities.findAllById(fixture.ids()).stream().map(row -> {
            Map<String, Object> fields = new LinkedHashMap<>();
            fields.put("id", row.getId());
            fields.put("type", row.getActivityType().name());
            fields.put("utcStart", row.getStartTime().toInstant(ZoneOffset.UTC).toString());
            fields.put("km", row.getDistanceKm());
            fields.put("seconds", row.getDurationSeconds());
            return fields;
        }).toList();
    }

    private void writeReceipt(String label, Map<String, Object> receipt) throws Exception {
        String directory = System.getProperty("hermes.persona.evidence-directory");
        if (directory == null) return;
        Path owned = Path.of("D:/Hermesruns/output/playwright/local-boundary-round-4/persona").toAbsolutePath().normalize();
        Path output = Path.of(directory).toAbsolutePath().normalize();
        if (!output.startsWith(owned) || !label.matches("[a-z0-9.-]+")) throw new IllegalArgumentException("Owned persona evidence only");
        Files.createDirectories(output);
        Files.writeString(output.resolve(label + ".json"), json.writerWithDefaultPrettyPrinter().writeValueAsString(receipt));
    }

    private static double round1(double value) {
        return Math.round(value * 10) / 10.0;
    }

    private record Seed(Instant instant, double km, int seconds, ActivityType type) {}
    private record Fixture(Runner runner, List<Seed> seeds, List<Long> ids, String bearer) {}
    private record Observation(JsonNode body, PersonalizedRunningPlanner.RunHistory history) {}

    @TestConfiguration(proxyBeanMethods = false)
    static class ClockFixture {
        @Bean
        @Primary
        MutableCoachClock personaBoundaryClock() {
            return new MutableCoachClock(ORDINARY);
        }
    }
}
