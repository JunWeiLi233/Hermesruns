package com.hermes.backend.activity;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Runs the real SQL of {@link ActivityPointRepository#findRoutePreviewSamplesByActivityIds} (the Runs list asks for it
 * once per page load, for every run on the page) against a small schema.
 *
 * <p>The query once passed the sampling step as a bound parameter inside an expression that also read a window
 * function. H2 then worked the window out again for every row: 1 000 points took 3.5 s, 2 000 took 14 s, a 5 km
 * run recorded every second took longer than the 30 s the connection pool waits, and a few page loads held all four
 * connections, so every other request waited too. With the same numbers written into the SQL as literals it took
 * 7 ms, which is how the cause was found.</p>
 *
 * <p>Set HERMES_QUERY_TEST_POSTGRES_URL (a dedicated loopback server) to run the same checks on PostgreSQL.</p>
 */
class ActivityPointRoutePreviewQueryTests {
    private static final int TARGET = 240;

    private Connection connection;
    private JdbcTemplate jdbc;
    private NamedParameterJdbcTemplate namedJdbc;
    private String schema;
    private String sql;
    private long nextPointId = 1;

    @BeforeEach
    void setUp() throws Exception {
        String url = System.getenv("HERMES_QUERY_TEST_POSTGRES_URL");
        boolean postgres = url != null && !url.isBlank();
        if (postgres && !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/postgres")) {
            throw new IllegalArgumentException("Query tests require a dedicated loopback PostgreSQL server");
        }
        if (!postgres) {
            url = "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DEFAULT_NULL_ORDERING=HIGH";
        }
        connection = DriverManager.getConnection(url, postgres ? "postgres" : "sa", "");
        jdbc = new JdbcTemplate(new SingleConnectionDataSource(connection, true));
        namedJdbc = new NamedParameterJdbcTemplate(jdbc);
        schema = "preview_test_" + UUID.randomUUID().toString().replace("-", "");
        jdbc.execute("create schema " + schema);
        jdbc.execute(postgres ? "set search_path to " + schema : "set schema " + schema);
        jdbc.execute("create table activities (id bigint primary key)");
        jdbc.execute("""
                create table activity_points (
                    id bigint primary key, activity_id bigint references activities(id),
                    sequence_index integer not null, latitude double precision, longitude double precision
                )
                """);
        jdbc.execute("create index idx_activity_point_activity on activity_points(activity_id)");
        jdbc.execute("create index idx_activity_point_activity_sequence on activity_points(activity_id, sequence_index)");
        sql = ActivityPointRepository.class.getMethod("findRoutePreviewSamplesByActivityIds", List.class, int.class)
                .getAnnotation(Query.class).value();
    }

    @AfterEach
    void tearDown() throws Exception {
        try {
            if (jdbc != null && schema != null) jdbc.execute("drop schema " + schema + " cascade");
        } finally {
            if (connection != null) connection.close();
        }
    }

    @Test
    void sampleTimeDoesNotGrowWithTheSquareOfARunsLength() {
        run(1, 1_500);
        run(2, 1_500);
        long started = System.nanoTime();
        List<long[]> rows = sample(List.of(1L, 2L));
        long millis = (System.nanoTime() - started) / 1_000_000;
        assertTrue(millis < 2_000, "two 1 500-point runs took " + millis + " ms; with the step as a bound parameter inside the filter this took 3.7 s in memory");
        assertEquals(2 * sampleSizeOf(1_500), rows.size());
    }

    @Test
    void keepsTheFirstPointTheLastPointAndEveryNthPointBetweenThemOfALongRun() {
        run(1, 1_000);
        // 1 000 points, at most 240 wanted: every 5th point (ordinals 1, 6, ... 996) and the last one.
        List<Long> expected = new ArrayList<>();
        for (long sequence = 1; sequence <= 996; sequence += 5) expected.add(sequence);
        expected.add(1_000L);
        List<Long> actual = sample(List.of(1L)).stream().map((row) -> row[1]).toList();
        assertEquals(expected, actual);
    }

    @Test
    void keepsEveryPointOfARunThatIsNotLongerThanTheTarget() {
        run(1, 100);
        run(2, TARGET);
        List<long[]> rows = sample(List.of(1L, 2L));
        assertEquals(100 + TARGET, rows.size());
    }

    @Test
    void samplesEachRunOnItsOwnAndReturnsThemInOrder() {
        run(7, 1_000);
        run(3, 100);
        List<long[]> rows = sample(List.of(7L, 3L));
        assertEquals(100 + sampleSizeOf(1_000), rows.size());
        long previousActivity = -1;
        long previousSequence = -1;
        for (long[] row : rows) {
            assertTrue(row[0] > previousActivity || (row[0] == previousActivity && row[1] > previousSequence),
                    "rows come ordered by run, then by position along it");
            previousActivity = row[0];
            previousSequence = row[1];
        }
        assertEquals(3L, rows.get(0)[0]);
        assertEquals(7L, rows.get(rows.size() - 1)[0]);
    }

    @Test
    void leavesOutPointsWithoutAValidCoordinateAndDoesNotCountThem() {
        jdbc.update("insert into activities values (1)");
        point(1, 1, 40.0, -73.0);
        point(1, 2, 91.0, -73.0);
        point(1, 3, null, -73.0);
        point(1, 4, 40.1, -181.0);
        point(1, 5, 40.2, -73.1);
        List<Long> sequences = sample(List.of(1L)).stream().map((row) -> row[1]).toList();
        assertEquals(List.of(1L, 5L), sequences);
    }

    @Test
    void anotherRunnersIdsThatAreNotAskedForAreNotReturned() {
        run(1, 50);
        run(2, 50);
        assertEquals(50, sample(List.of(2L)).size());
    }

    /** How many rows a run of this many points is thinned to: first, last and every step-th in between. */
    private static int sampleSizeOf(int points) {
        if (points <= TARGET) return points;
        int step = (int) Math.ceil(points * 1.0 / TARGET);
        int kept = 0;
        for (int ordinal = 1; ordinal <= points; ordinal++) {
            if (ordinal == 1 || ordinal == points || (ordinal - 1) % step == 0) kept++;
        }
        return kept;
    }

    private List<long[]> sample(List<Long> activityIds) {
        return namedJdbc.query(sql, Map.of("activityIds", activityIds, "targetPointsPerActivity", TARGET),
                (row, index) -> new long[]{row.getLong(1), row.getLong(4)});
    }

    private void run(long activityId, int points) {
        jdbc.update("insert into activities values (?)", activityId);
        List<Object[]> batch = new ArrayList<>();
        for (int sequence = 1; sequence <= points; sequence++) {
            batch.add(new Object[]{nextPointId++, activityId, sequence, 40.0 + sequence * 0.00001, -73.0 + sequence * 0.00001});
        }
        jdbc.batchUpdate("insert into activity_points values (?, ?, ?, ?, ?)", batch);
    }

    private void point(long activityId, int sequence, Double latitude, Double longitude) {
        jdbc.update("insert into activity_points values (?, ?, ?, ?, ?)", nextPointId++, activityId, sequence, latitude, longitude);
    }
}
