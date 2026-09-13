package com.hermes.backend.activity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Connection;
import java.sql.DriverManager;
import java.time.LocalDateTime;
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
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class ActivityPointLatestLocationQueryTests {
    private Connection connection;
    private JdbcTemplate jdbc;
    private NamedParameterJdbcTemplate namedJdbc;
    private String schema;
    private String sql;
    private boolean postgres;
    private long pointId;

    @BeforeEach
    void setUp() throws Exception {
        String url = System.getenv("HERMES_QUERY_TEST_POSTGRES_URL");
        postgres = url != null && !url.isBlank();
        if (postgres && !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/postgres")) {
            throw new IllegalArgumentException("Query tests require a dedicated loopback PostgreSQL server");
        }
        if (!postgres) {
            url = "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DEFAULT_NULL_ORDERING=HIGH";
        }
        connection = DriverManager.getConnection(url, postgres ? "postgres" : "sa", "");
        jdbc = new JdbcTemplate(new SingleConnectionDataSource(connection, true));
        namedJdbc = new NamedParameterJdbcTemplate(jdbc);
        schema = "query_test_" + UUID.randomUUID().toString().replace("-", "");
        jdbc.execute("create schema " + schema);
        jdbc.execute(postgres ? "set search_path to " + schema : "set schema " + schema);
        jdbc.execute("""
                create table activities (
                    id bigint primary key, runner_id bigint, activity_type varchar(20),
                    start_time timestamp, created_at timestamp
                )
                """);
        jdbc.execute("""
                create table activity_points (
                    id bigint primary key, activity_id bigint references activities(id),
                    sequence_index integer not null, latitude double precision, longitude double precision
                )
                """);
        jdbc.execute("create index idx_activity_runner_type on activities(runner_id, activity_type)");
        jdbc.execute("create index idx_activity_point_activity_sequence on activity_points(activity_id, sequence_index)");
        sql = ActivityPointRepository.class.getMethod("findLatestLatLngByRunnerAndType", Long.class, String.class)
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
    void returnsEmptyWithoutEligiblePoints() {
        assertTrue(latest(1, "RUN").isEmpty());
        activity(1, 1, "RUN", "2026-09-01T08:00", null);
        point(1, 1, null, 20.0);
        point(1, 2, 10.0, null);
        point(1, 3, 91.0, 20.0);
        point(1, 4, 10.0, -181.0);
        assertTrue(latest(1, "RUN").isEmpty());
    }

    @Test
    void choosesLatestActivityBeforeSequenceAndPointId() {
        activity(1, 1, "RUN", "2026-08-01T08:00", null);
        activity(2, 1, "RUN", "2026-09-01T08:00", null);
        point(2, 9, 12.0, 22.0);
        point(2, 2, 11.0, 21.0);
        point(1, 9999, 31.0, 41.0);
        assertCoordinate(1, "RUN", 12, 22);
    }

    @Test
    void skipsNewerActivitiesWithoutValidCoordinates() {
        activity(1, 1, "RUN", "2026-09-01T08:00", null);
        activity(2, 1, "RUN", "2026-09-02T08:00", null);
        activity(3, 1, "RUN", "2026-09-03T08:00", null);
        point(1, 1, 10.0, 20.0);
        point(2, 1, -91.0, 20.0);
        assertCoordinate(1, "RUN", 10, 20);
    }

    @Test
    void skipsInvalidTrailingPointsAndAcceptsCoordinateBoundaries() {
        activity(1, 1, "RUN", "2026-09-01T08:00", null);
        point(1, 1, -90.0, -180.0);
        point(1, 2, 90.0, 180.0);
        point(1, 3, null, 20.0);
        point(1, 4, 10.0, Double.NaN);
        point(1, 5, Double.POSITIVE_INFINITY, 20.0);
        point(1, 6, 10.0, Double.NEGATIVE_INFINITY);
        assertCoordinate(1, "RUN", 90, 180);
    }

    @Test
    void preservesRunnerAndActivityTypeIsolation() {
        activity(1, 1, "RUN", "2026-08-01T08:00", null);
        activity(2, 2, "RUN", "2026-09-01T08:00", null);
        activity(3, 1, "RIDE", "2026-09-02T08:00", null);
        point(1, 1, 10.0, 20.0);
        point(2, 1, 30.0, 40.0);
        point(3, 1, 50.0, 60.0);
        assertCoordinate(1, "RUN", 10, 20);
        assertCoordinate(2, "RUN", 30, 40);
        assertCoordinate(1, "RIDE", 50, 60);
        assertTrue(latest(3, "RUN").isEmpty());
    }

    @Test
    void usesCreatedAtOnlyWhenStartTimeIsMissing() {
        activity(1, 1, "RUN", "2026-08-01T08:00", "2026-10-01T08:00");
        activity(2, 1, "RUN", null, "2026-09-01T08:00");
        point(1, 10, 10.0, 20.0);
        point(2, 1, 30.0, 40.0);
        assertCoordinate(1, "RUN", 30, 40);
    }

    @Test
    void ordersTimestampTiesByPointSequenceAcrossActivities() {
        activity(1, 1, "RUN", "2026-09-01T08:00", null);
        activity(2, 1, "RUN", null, "2026-09-01T08:00");
        point(1, 10, 10.0, 20.0);
        point(2, 2, 30.0, 40.0);
        assertCoordinate(1, "RUN", 10, 20);
    }

    @Test
    void preservesNullTimestampOrdering() {
        activity(1, 1, "RUN", "2026-09-01T08:00", null);
        activity(2, 1, "RUN", null, null);
        point(1, 10, 10.0, 20.0);
        point(2, 1, 30.0, 40.0);
        assertCoordinate(1, "RUN", 30, 40);
    }

    @Test
    void postgresSortsOnlyOnePointPerActivity() throws Exception {
        assumeTrue(postgres, "Set HERMES_QUERY_TEST_POSTGRES_URL for the PostgreSQL query-plan regression");
        jdbc.execute("""
                insert into activities
                select n, 1, 'RUN', timestamp '2026-01-01' + n * interval '1 minute', null
                from generate_series(1, 120) n
                """);
        jdbc.execute("""
                insert into activity_points
                select (a.id-1)*2000+p, a.id, p, 10.0, 20.0
                from activities a cross join generate_series(1, 2000) p
                """);
        jdbc.execute("analyze activities");
        jdbc.execute("analyze activity_points");
        String plan = namedJdbc.queryForObject("explain (analyze, buffers, format json) " + sql,
                Map.of("runnerId", 1L, "activityType", "RUN"), String.class);
        JsonNode root = new ObjectMapper().readTree(plan).get(0).get("Plan");
        assertTrue(maxSortInputRows(root) <= 120,
                () -> "Location lookup must not sort the full GPS history: " + root);
        assertTrue(root.path("Shared Hit Blocks").asLong() + root.path("Shared Read Blocks").asLong() < 2000,
                () -> "Location lookup must use bounded index probes: " + root);
        assertCoordinate(1, "RUN", 10, 20);
    }

    private long maxSortInputRows(JsonNode node) {
        long maximum = 0;
        if (node.path("Node Type").asText().contains("Sort")) {
            for (JsonNode child : node.path("Plans")) {
                maximum = Math.max(maximum, child.path("Actual Rows").asLong());
            }
        }
        for (JsonNode child : node.path("Plans")) maximum = Math.max(maximum, maxSortInputRows(child));
        return maximum;
    }

    private List<double[]> latest(long runnerId, String type) {
        return namedJdbc.query(sql, Map.of("runnerId", runnerId, "activityType", type),
                (row, index) -> new double[]{row.getDouble(1), row.getDouble(2)});
    }

    private void assertCoordinate(long runnerId, String type, double latitude, double longitude) {
        List<double[]> result = latest(runnerId, type);
        assertEquals(1, result.size());
        assertEquals(latitude, result.get(0)[0]);
        assertEquals(longitude, result.get(0)[1]);
    }

    private void activity(long id, long runnerId, String type, String start, String created) {
        jdbc.update("insert into activities values (?,?,?,?,?)", id, runnerId, type,
                start == null ? null : LocalDateTime.parse(start),
                created == null ? null : LocalDateTime.parse(created));
    }

    private void point(long activityId, int sequence, Double latitude, Double longitude) {
        jdbc.update("insert into activity_points values (?,?,?,?,?)", ++pointId, activityId, sequence, latitude, longitude);
    }
}
