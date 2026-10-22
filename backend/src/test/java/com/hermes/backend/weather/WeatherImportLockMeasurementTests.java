package com.hermes.backend.weather;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.imports.ActivityImportService;
import com.hermes.backend.imports.ImportResult;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Local service-layer measurements. Only the HTTP provider transport is redirected.
 * Importer, parsers, weather logic/cache, owner lock, transactions and coaching are real.
 * Run only through the coordinated round-3 Maven harness; never use a personal database.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:weather-r3-measurement;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=15000",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.hikari.maximum-pool-size=6",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.training.async=false",
        "app.training.catchup-on-startup=false",
        "app.official-course.startup-seed.enabled=false",
        "app.local-shared-runner.enabled=false",
        "app.mail.provider=disabled",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false"
})
class WeatherImportLockMeasurementTests {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final AtomicInteger CALL_IDS = new AtomicInteger();
    private static final AtomicInteger FIXTURE_IDS = new AtomicInteger();
    private static final ThreadLocal<Actor> ACTOR = new ThreadLocal<>();
    private static final ThreadLocal<ClientCall> CURRENT_CALL = new ThreadLocal<>();
    private static final Map<Integer, ClientCall> CALLS = new ConcurrentHashMap<>();
    private static HttpServer stub;
    private static ExecutorService stubExecutor;
    private static boolean transportInstalled;

    @Autowired private ActivityImportService importer;
    @Autowired private RunnerRepository runners;
    @Autowired private DataSource dataSource;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired
    private RestTemplate weatherTransport;

    @BeforeEach
    void installProviderUrlTransportAfterContextInitialization() {
        if (transportInstalled) return;
        // Wrap the actual WebConfig bean after SafeUrlExecutor has derived its separate pinned
        // transport. Keep production converters, error handler and unchanged transport timeouts.
        RestTemplate template = weatherTransport;
        ClientHttpRequestFactory transport = template.getRequestFactory();
        template.setRequestFactory((uri, method) -> {
            if (!List.of("archive-api.open-meteo.com", "api.open-meteo.com").contains(uri.getHost())) {
                throw new IOException("Measurement transport rejects unapproved external provider");
            }
            ClientCall call = CURRENT_CALL.get();
            if (call == null) throw new IOException("Missing local measurement call identity");
            URI local = UriComponentsBuilder.fromUri(uri).scheme("http").host("127.0.0.1")
                    .port(8239).queryParam("measurement_id", call.id).build(true).toUri();
            return transport.createRequest(local, method);
        });
        template.setInterceptors(List.of((request, body, execution) -> {
            Actor actor = ACTOR.get();
            ClientCall call = new ClientCall(CALL_IDS.incrementAndGet(), actor);
            CALLS.put(call.id, call);
            CURRENT_CALL.set(call);
            try {
                var response = execution.execute(request, body);
                call.status = response.getStatusCode().value();
                return response;
            } catch (IOException exception) {
                call.error = exception.getClass().getSimpleName();
                throw exception;
            } finally {
                call.clientEndNs = System.nanoTime();
                CURRENT_CALL.remove();
            }
        }));
        transportInstalled = true;
    }

    @BeforeAll
    static void startOwnedStub() throws Exception {
        // A failed bind never stops or reuses someone else's listener. Atomic bind rechecks ownership.
        stub = HttpServer.create(new InetSocketAddress("127.0.0.1", 8239), 0);
        stubExecutor = Executors.newFixedThreadPool(4);
        stub.setExecutor(stubExecutor);
        stub.createContext("/v1/", WeatherImportLockMeasurementTests::serveWeather);
        stub.start();
        emit(Map.of("kind", "stub-start", "address", "127.0.0.1:8239",
                "pid", ProcessHandle.current().pid(), "providerProvenance", "controlled-local-injection"));
    }

    @AfterAll
    static void stopOwnedStub() throws Exception {
        if (stub != null) stub.stop(0);
        if (stubExecutor != null) {
            stubExecutor.shutdownNow();
            assertThat(stubExecutor.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        }
        emit(Map.of("kind", "stub-stop", "pid", ProcessHandle.current().pid(), "closed", true));
    }

    @Test
    void measureFastDelayedFailingAndTimedOutProviderWithActualImportTransactions() throws Exception {
        for (Plan plan : List.of(new Plan("fast-success", 0, 200),
                new Plan("delayed-success", 2200, 200), new Plan("immediate-503", 0, 503),
                new Plan("delayed-503", 2200, 503), new Plan("read-timeout", 6500, 200))) {
            measurePair(plan, false);
        }
    }

    @Test
    void delayedFailingProviderStillPreservesStructuralDuplicateAtomicity() throws Exception {
        measurePair(new Plan("structural-duplicate-delayed-503", 2200, 503), true);
    }

    @Test
    void failedArchiveAfterWeatherRollsBackAndRetryKeepsPersistedTotals() throws Exception {
        Fixture owner = fixture();
        Instant start = Instant.now().minus(2, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
        var valid = tcx(start, 5000, 900, owner.latitude, "archive-valid");
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry("weather-r3-valid.tcx"));
            zip.write(valid.getBytes());
            zip.closeEntry();
            zip.putNextEntry(new ZipEntry("weather-r3-invalid.tcx"));
            zip.write("not XML".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        Snapshot before = snapshot(owner.runner, Instant.now());
        Actor failed = new Actor("archive", new Plan("archive-rollback-503", 0, 503));
        assertThatThrownBy(() -> runImport(failed, owner.runner, ImportProvider.GARMIN,
                new MockMultipartFile("exports", "weather-r3-broken.zip", "application/zip", bytes.toByteArray())))
                .isInstanceOf(IllegalArgumentException.class);
        Snapshot rolledBack = snapshot(owner.runner, Instant.now());
        assertTotals(rolledBack, 1, 2, 600);
        assertThat(rolledBack.rows).isEqualTo(before.rows);
        assertThat(failed.completionStatus).isEqualTo(TransactionSynchronization.STATUS_ROLLED_BACK);
        Actor retry = new Actor("retry", new Plan("archive-retry-503", 0, 503));
        assertThat(runImport(retry, owner.runner, ImportProvider.GARMIN, valid).importedActivities()).isEqualTo(1);
        Snapshot committed = snapshot(owner.runner, Instant.now());
        assertTotals(committed, 2, 7, 1500);
        assertThat(importCalls(List.of(failed, retry))).hasSize(2).allSatisfy(call -> {
            assertThat(call.status).isEqualTo(503);
            assertThat(call.stubAcceptedNs).isPositive();
            assertThat(call.transactionActive).isTrue();
        });
        emit(Map.of("kind", "archive", "providerProvenance", "controlled-local-HTTP503",
                "before", before, "afterRollback", rolledBack, "afterRetry", committed,
                "failed", failed.metrics(), "retry", retry.metrics(),
                "importRequests", importCalls(List.of(failed, retry))));
    }

    private void measurePair(Plan plan, boolean duplicate) throws Exception {
        Fixture owner = fixture();
        Fixture independent = fixture();
        Instant observation = Instant.now();
        Instant firstStart = observation.minus(3, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
        Instant secondStart = duplicate ? firstStart : observation.minus(2, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
        Actor first = new Actor("first", plan);
        Actor second = new Actor("same-owner-second", new Plan(plan.name, 0, plan.status));
        Actor other = new Actor("independent-owner", new Plan(plan.name, 0, 200));
        var executor = Executors.newFixedThreadPool(3);
        var samples = new ArrayList<LockSample>();
        try (Connection observer = dataSource.getConnection()) {
            var left = executor.submit(() -> runImport(first, owner.runner, ImportProvider.GARMIN,
                    tcx(firstStart, 6000, 1200, owner.latitude, "first")));
            assertThat(first.providerAccepted.await(10, TimeUnit.SECONDS)).as("actual stub received first importer request").isTrue();
            var right = executor.submit(() -> runImport(second, owner.runner, ImportProvider.COROS,
                    tcx(secondStart, duplicate ? 6000 : 7000, duplicate ? 1200 : 1800, owner.latitude, "second")));
            var unrelated = executor.submit(() -> runImport(other, independent.runner, ImportProvider.GARMIN,
                    tcx(firstStart, 4000, 900, independent.latitude, "independent")));
            assertThat(second.enteredTransaction.await(5, TimeUnit.SECONDS)).isTrue();
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(25);
            while (!right.isDone() && System.nanoTime() < deadline) {
                samples.add(lockSample(observer, second.sessionId, first.sessionId));
                TimeUnit.MILLISECONDS.sleep(20);
            }
            ImportResult winner = left.get(10, TimeUnit.SECONDS);
            ImportResult successor = right.get(10, TimeUnit.SECONDS);
            assertThat(unrelated.get(10, TimeUnit.SECONDS).importedActivities()).isEqualTo(1);
            assertThat(winner.importedActivities()).isEqualTo(1);
            assertThat(winner.importedPoints()).isEqualTo(2);
            assertThat(successor.importedActivities()).isEqualTo(duplicate ? 0 : 1);
            assertThat(successor.skippedDuplicates()).isEqualTo(duplicate ? 1 : 0);
            assertThat(successor.importedPoints()).isEqualTo(duplicate ? 0 : 2);
            for (ImportResult result : List.of(winner, successor)) {
                assertThat(result.skippedNonRuns()).isZero();
                assertThat(result.rejectedFiles()).isEmpty();
            }
            Snapshot stored = snapshot(owner.runner, observation);
            assertTotals(stored, duplicate ? 2 : 3, duplicate ? 8 : 15, duplicate ? 1800 : 3600);
            assertThat(stored.rows.get(1).weatherAdjusted).isEqualTo(plan.status == 200 && !plan.name.equals("read-timeout"));
            assertThat(stored.rows.get(1).weatherPenalty).isEqualTo(plan.status == 200 && !plan.name.equals("read-timeout") ? 10 : 0);
            Snapshot independentStored = snapshot(independent.runner, observation);
            assertTotals(independentStored, 2, 6, 1500);
            var firstCalls = importCalls(List.of(first));
            assertThat(firstCalls).hasSize(1);
            assertThat(firstCalls.get(0).transactionActive).as("actual import transaction active during provider request").isTrue();
            assertThat(firstCalls.get(0).stubFinished.await(10, TimeUnit.SECONDS))
                    .as("record actual stub elapsed delay even when the client timed out first").isTrue();
            if (duplicate) assertThat(importCalls(List.of(second))).isEmpty();
            if (plan.delayMs > 0) {
                assertThat(samples).as("DB confirms same owner's update is blocked by first transaction")
                        .anySatisfy(sample -> {
                            assertThat(sample.ownerStatement).isTrue();
                            assertThat(sample.blockedByFirst).isTrue();
                        });
                assertThat(other.commitNs).as("different owner commits before delayed provider completes")
                        .isLessThan(firstCalls.get(0).clientEndNs);
            }
            if (plan.name.equals("read-timeout")) {
                assertThat(firstCalls.get(0).error).isEqualTo("SocketTimeoutException");
                assertThat(firstCalls.get(0).clientElapsedMs()).isBetween(4500.0, 6500.0);
            } else {
                assertThat(firstCalls.get(0).status).isEqualTo(plan.status);
                assertThat(firstCalls.get(0).error).isEmpty();
            }
            assertThat(first.completionStatus).isEqualTo(TransactionSynchronization.STATUS_COMMITTED);
            assertThat(second.completionStatus).isEqualTo(TransactionSynchronization.STATUS_COMMITTED);
            emit(Map.ofEntries(Map.entry("kind", "pair"), Map.entry("case", plan.name),
                    Map.entry("database", observer.getMetaData().getDatabaseProductName()),
                    Map.entry("providerProvenance", "controlled-local-delay-status-injection"),
                    Map.entry("applicationProvenance", "actual-Spring-import-parser-lock-transaction-coaching"),
                    Map.entry("observationInstant", observation.toString()),
                    Map.entry("first", first.metrics()), Map.entry("second", second.metrics()),
                    Map.entry("independentOwner", other.metrics()), Map.entry("lockSamples", samples),
                    Map.entry("importRequests", importCalls(List.of(first, second, other))),
                    Map.entry("ownerPersisted", stored), Map.entry("independentPersisted", independentStored),
                    Map.entry("outcomes", List.of(winner, successor))));
        } finally {
            executor.shutdownNow();
            assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    private ImportResult runImport(Actor actor, Runner runner, ImportProvider provider, MockMultipartFile file) {
        ACTOR.set(actor);
        actor.startNs = System.nanoTime();
        try {
            return new TransactionTemplate(transactionManager).execute(status -> {
                Connection bound = DataSourceUtils.getConnection(dataSource);
                try {
                    actor.sessionId = sessionId(bound);
                } catch (Exception exception) {
                    throw new IllegalStateException("Unable to read own fixture session identity", exception);
                } finally {
                    DataSourceUtils.releaseConnection(bound, dataSource);
                }
                actor.txEnterNs = System.nanoTime();
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override public int getOrder() { return Integer.MIN_VALUE; }
                    @Override public void beforeCommit(boolean readOnly) { actor.beforeCommitNs = System.nanoTime(); }
                    @Override public void afterCommit() { actor.commitNs = System.nanoTime(); }
                    @Override public void afterCompletion(int completion) { actor.completionStatus = completion; }
                });
                actor.enteredTransaction.countDown();
                actor.importing = true;
                try {
                    return importer.importFile(runner, provider, file);
                } finally {
                    actor.importing = false;
                    actor.importReturnNs = System.nanoTime();
                }
            });
        } finally {
            actor.endNs = System.nanoTime();
            ACTOR.remove();
        }
    }

    private Fixture fixture() {
        int id = FIXTURE_IDS.incrementAndGet();
        Runner runner = new Runner("weather-r3-" + UUID.randomUUID() + "@hermes.test", "ACTIVE");
        runner.setTimeZone("UTC");
        runner = runners.saveAndFlush(runner);
        double latitude = 30.0 + id * 0.2;
        assertThat(importer.importFile(runner, ImportProvider.GARMIN,
                tcx(Instant.now().minus(4, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS),
                        2000, 600, latitude, "seed-" + id)).importedActivities()).isEqualTo(1);
        return new Fixture(runner, latitude);
    }

    private static int sessionId(Connection connection) throws Exception {
        String sql = connection.getMetaData().getDatabaseProductName().equals("PostgreSQL")
                ? "select pg_backend_pid()" : "select session_id()";
        try (var statement = connection.createStatement(); var rows = statement.executeQuery(sql)) {
            assertThat(rows.next()).isTrue();
            return rows.getInt(1);
        }
    }

    private static LockSample lockSample(Connection connection, int second, int first) throws Exception {
        boolean pg = connection.getMetaData().getDatabaseProductName().equals("PostgreSQL");
        // Export only classification and IDs, never SQL text or unrelated sessions.
        String sql = pg ? """
                select state, coalesce(wait_event, ''), ? = any(pg_blocking_pids(pid)),
                       lower(query) like '%from runner %' and lower(query) like '%update%'
                  from pg_stat_activity where pid = ?
                """ : """
                select session_state, '', blocker_id = ?,
                       lower(executing_statement) like '%from runner %' and lower(executing_statement) like '%update%'
                  from information_schema.sessions where session_id = ?
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, first);
            statement.setInt(2, second);
            try (ResultSet rows = statement.executeQuery()) {
                if (!rows.next()) return new LockSample(System.nanoTime(), "absent", "", false, false);
                return new LockSample(System.nanoTime(), rows.getString(1), rows.getString(2),
                        rows.getBoolean(3), rows.getBoolean(4));
            }
        }
    }

    private Snapshot snapshot(Runner runner, Instant observation) throws Exception {
        List<StoredRun> runs = new ArrayList<>();
        Map<String, Window> windows = new LinkedHashMap<>();
        Map<String, Window> calendar = new LinkedHashMap<>();
        try (Connection independent = dataSource.getConnection()) {
            try (PreparedStatement query = independent.prepareStatement("""
                    select start_time, distance_km, distance_meters, duration_seconds, moving_time_seconds,
                           pace_penalty_sec_per_km, weather_adjusted,
                           (select count(*) from activity_points p where p.activity_id = a.id)
                      from activities a where runner_id = ? and activity_type = 'RUN' order by start_time
                    """)) {
                query.setLong(1, runner.getId());
                try (ResultSet rows = query.executeQuery()) {
                    while (rows.next()) {
                        LocalDateTime start = rows.getTimestamp(1).toLocalDateTime();
                        runs.add(new StoredRun(start.toString(), rows.getDouble(2), rows.getDouble(3),
                                rows.getLong(4), rows.getLong(5), rows.getInt(6), rows.getBoolean(7), rows.getInt(8)));
                    }
                }
            }
            for (int days : List.of(7, 28, 90)) {
                Instant lower = observation.minus(days, ChronoUnit.DAYS);
                windows.put("elapsed" + days + "d", total(runs.stream().filter(run -> {
                    Instant start = LocalDateTime.parse(run.startUtc).toInstant(ZoneOffset.UTC);
                    return !start.isBefore(lower) && !start.isAfter(observation);
                }).toList()));
            }
            for (StoredRun run : runs) {
                String date = LocalDateTime.parse(run.startUtc).toLocalDate().toString();
                calendar.put(date, total(runs.stream().filter(row -> row.startUtc.startsWith(date)).toList()));
            }
            try (PreparedStatement query = independent.prepareStatement(
                    "select volume_km7d, volume_km28d, minutes_unknown_hr_last7d from coach_runner_state where runner_id = ?")) {
                query.setLong(1, runner.getId());
                try (ResultSet rows = query.executeQuery()) {
                    assertThat(rows.next()).isTrue();
                    return new Snapshot(runs, total(runs), windows, calendar,
                            rows.getDouble(1), rows.getDouble(2), rows.getInt(3));
                }
            }
        }
    }

    private static Window total(List<StoredRun> rows) {
        return new Window(rows.size(), rows.stream().mapToDouble(StoredRun::km).sum(),
                rows.stream().mapToLong(StoredRun::durationSeconds).sum(),
                rows.stream().mapToInt(StoredRun::points).sum());
    }

    private static void assertTotals(Snapshot stored, int count, double km, long seconds) {
        assertThat(stored.total).isEqualTo(new Window(count, km, seconds, count * 2));
        assertThat(stored.rows).allSatisfy(row -> {
            assertThat(row.movingSeconds).isEqualTo(row.durationSeconds);
            assertThat(row.meters).isEqualTo(row.km * 1000);
        });
        assertThat(stored.elapsedWindows.values()).allSatisfy(window -> assertThat(window).isEqualTo(stored.total));
        assertThat(stored.calendarUtc.values().stream().mapToDouble(Window::km).sum()).isEqualTo(km);
        assertThat(stored.coachKm7d).isEqualTo(km);
        assertThat(stored.coachKm28d).isEqualTo(km);
        assertThat(stored.coachUnknownHrMinutes7d).isEqualTo((int) (seconds / 60));
    }

    private static List<ClientCall> importCalls(List<Actor> actors) {
        return CALLS.values().stream().filter(call -> call.inImport && actors.contains(call.actor))
                .sorted(java.util.Comparator.comparingInt(call -> call.id)).toList();
    }

    private static MockMultipartFile tcx(Instant start, double meters, int seconds, double latitude, String notes) {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
                  <Activities><Activity Sport="Running"><Id>%s</Id><Lap StartTime="%s">
                    <TotalTimeSeconds>%d</TotalTimeSeconds><DistanceMeters>%.0f</DistanceMeters>
                    <Track><Trackpoint><Time>%s</Time><Position><LatitudeDegrees>%.4f</LatitudeDegrees><LongitudeDegrees>10</LongitudeDegrees></Position></Trackpoint>
                    <Trackpoint><Time>%s</Time><Position><LatitudeDegrees>%.4f</LatitudeDegrees><LongitudeDegrees>10</LongitudeDegrees></Position></Trackpoint></Track>
                  </Lap><Notes>weather-r3-%s</Notes></Activity></Activities>
                </TrainingCenterDatabase>
                """.formatted(start, start, seconds, meters, start, latitude, start.plusSeconds(seconds), latitude, notes);
        return new MockMultipartFile("exports", "weather-r3-synthetic.tcx", "application/xml", xml.getBytes(StandardCharsets.UTF_8));
    }

    private static void serveWeather(HttpExchange exchange) throws IOException {
        var query = UriComponentsBuilder.fromUri(exchange.getRequestURI()).build().getQueryParams();
        ClientCall call = CALLS.get(Integer.parseInt(query.getFirst("measurement_id")));
        call.stubAcceptedNs = System.nanoTime();
        if (call.actor != null && call.inImport) call.actor.providerAccepted.countDown();
        try {
            if (call.configuredDelayMs > 0) TimeUnit.MILLISECONDS.sleep(call.configuredDelayMs);
            call.stubDelayEndNs = System.nanoTime();
            Map<String, Object> payload;
            if (call.configuredStatus != 200) {
                payload = Map.of("error", true, "reason", "controlled-local-provider-failure");
            } else {
                LocalDate start = LocalDate.parse(query.getFirst("start_date"));
                LocalDate end = LocalDate.parse(query.getFirst("end_date"));
                List<String> dates = new ArrayList<>();
                List<Double> dew = new ArrayList<>();
                for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
                    dates.add(date.toString());
                    dew.add(date.equals(end) ? 18.0 : 10.0);
                }
                payload = Map.of("daily", Map.of("time", dates, "dew_point_2m_mean", dew));
            }
            byte[] response = JSON.writeValueAsBytes(payload);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(call.configuredStatus, response.length);
            exchange.getResponseBody().write(response);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        } catch (IOException exception) {
            // The deliberate read-timeout case closes the client before the stub replies.
            call.stubWriteError = exception.getClass().getSimpleName();
        } finally {
            call.stubEndNs = System.nanoTime();
            exchange.close();
            call.stubFinished.countDown();
        }
    }

    private static void emit(Object value) throws Exception {
        System.out.println("WEATHER_MEASUREMENT " + JSON.writeValueAsString(value));
    }

    private record Plan(String name, int delayMs, int status) {}
    private record Fixture(Runner runner, double latitude) {}
    private record LockSample(long nanoTime, String state, String event, boolean blockedByFirst, boolean ownerStatement) {}
    private record StoredRun(String startUtc, double km, double meters, long durationSeconds,
                             long movingSeconds, int weatherPenalty, boolean weatherAdjusted, int points) {}
    private record Window(int validRuns, double km, long durationSeconds, int points) {}
    private record Snapshot(List<StoredRun> rows, Window total, Map<String, Window> elapsedWindows,
                            Map<String, Window> calendarUtc, double coachKm7d, double coachKm28d,
                            int coachUnknownHrMinutes7d) {}

    private static class Actor {
        final String role;
        final Plan plan;
        final CountDownLatch providerAccepted = new CountDownLatch(1);
        final CountDownLatch enteredTransaction = new CountDownLatch(1);
        volatile boolean importing;
        volatile int sessionId;
        volatile int completionStatus = -1;
        volatile long startNs, txEnterNs, importReturnNs, beforeCommitNs, commitNs, endNs;

        Actor(String role, Plan plan) { this.role = role; this.plan = plan; }

        Map<String, Object> metrics() {
            return Map.ofEntries(Map.entry("role", role), Map.entry("sessionId", sessionId),
                    Map.entry("startNs", startNs), Map.entry("txEnterNs", txEnterNs),
                    Map.entry("importReturnNs", importReturnNs), Map.entry("beforeCommitNs", beforeCommitNs),
                    Map.entry("commitNs", commitNs), Map.entry("endNs", endNs),
                    Map.entry("completionStatus", completionStatus),
                    Map.entry("importElapsedMs", (importReturnNs - txEnterNs) / 1_000_000.0),
                    Map.entry("totalElapsedMs", (endNs - startNs) / 1_000_000.0));
        }
    }

    private static class ClientCall {
        public final int id;
        private final Actor actor;
        public final String role;
        public final boolean inImport;
        public final boolean transactionActive;
        public final int configuredDelayMs;
        public final int configuredStatus;
        public final long clientStartNs = System.nanoTime();
        private final CountDownLatch stubFinished = new CountDownLatch(1);
        public volatile long clientEndNs, stubAcceptedNs, stubDelayEndNs, stubEndNs;
        public volatile int status;
        public volatile String error = "", stubWriteError = "";

        ClientCall(int id, Actor actor) {
            this.id = id;
            this.actor = actor;
            this.role = actor == null ? "setup" : actor.role;
            this.inImport = actor != null && actor.importing;
            this.transactionActive = TransactionSynchronizationManager.isActualTransactionActive();
            this.configuredDelayMs = inImport ? actor.plan.delayMs : 0;
            this.configuredStatus = inImport ? actor.plan.status : 200;
        }

        double clientElapsedMs() { return (clientEndNs - clientStartNs) / 1_000_000.0; }
    }
}
