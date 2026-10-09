package com.hermes.backend.activity;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Comparator;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class ActivityPointHeatmapCoverageQueryTests {
    private static final double FAST_METERS_PER_SECOND = 5.0;
    private static final double SLOW_METERS_PER_SECOND = 2.0;

    private Connection connection;
    private JdbcTemplate jdbc;
    private NamedParameterJdbcTemplate namedJdbc;
    private String schema;
    private String sql;
    private long pointId;

    @BeforeEach
    void setUp() throws Exception {
        String url = System.getenv("HERMES_QUERY_TEST_POSTGRES_URL");
        boolean postgres = url != null && !url.isBlank();
        if (postgres && !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/postgres")) {
            throw new IllegalArgumentException("Query tests require a dedicated loopback PostgreSQL server");
        }
        connection = DriverManager.getConnection(postgres ? url : "jdbc:h2:mem:" + UUID.randomUUID(),
                postgres ? "postgres" : "sa", "");
        jdbc = new JdbcTemplate(new SingleConnectionDataSource(connection, true));
        jdbc.setQueryTimeout(15);
        namedJdbc = new NamedParameterJdbcTemplate(jdbc);
        schema = "heatmap_test_" + UUID.randomUUID().toString().replace("-", "");
        jdbc.execute("create schema " + schema);
        jdbc.execute(postgres ? "set search_path to " + schema : "set schema " + schema);
        jdbc.execute("create table activities (id bigint primary key, runner_id bigint, activity_type varchar(20))");
        jdbc.execute("""
                create table activity_points (id bigint primary key, activity_id bigint references activities(id),
                    sequence_index integer, latitude double precision, longitude double precision,
                    distance_meters double precision, elapsed_seconds integer)
                """);
        jdbc.execute("create index idx_heatmap_sequence on activity_points(activity_id, sequence_index)");
        sql = ActivityPointRepository.class.getMethod("findHeatmapCoveragePointsByRunnerAndType",
                Long.class, String.class, int.class, int.class).getAnnotation(Query.class).value();
    }

    @AfterEach
    void tearDown() throws Exception {
        try { if (jdbc != null) jdbc.execute("drop schema " + schema + " cascade"); }
        finally { if (connection != null) connection.close(); }
    }

    @Test
    void segmentSpeedFollowsRecordingOrderForEastAndWestBoundRuns() {
        fastThenSlowRun(1, 1);
        fastThenSlowRun(2, -1);

        List<Map<String, Object>> rows = sample(1, 1000);

        assertThat(rows).hasSize(80);
        for (long activityId : List.of(1L, 2L)) {
            List<Map<String, Object>> run = byRecordingOrder(rows, activityId);
            assertThat(run.get(0).get("segment_speed")).isNull();
            for (Map<String, Object> row : run.subList(1, run.size())) {
                double expected = value(row, "sequence_index").intValue() < 20 ? FAST_METERS_PER_SECOND : SLOW_METERS_PER_SECOND;
                assertThat(value(row, "segment_speed").doubleValue()).isCloseTo(expected, within(1e-9));
            }
        }
    }

    @Test
    void stridedSampleKeepsAdjacentPointSpeedInsteadOfSampleGaps() {
        fastThenSlowRun(1, -1);

        List<Map<String, Object>> rows = sample(3, 1000);

        assertThat(rows).hasSize(14);
        for (Map<String, Object> row : rows) {
            int sequence = value(row, "sequence_index").intValue();
            if (sequence == 0) continue;
            double expected = sequence < 20 ? FAST_METERS_PER_SECOND : SLOW_METERS_PER_SECOND;
            assertThat(value(row, "segment_speed").doubleValue()).isCloseTo(expected, within(1e-9));
        }
    }

    @Test
    void missingPointDistanceLeavesSpeedUnknownAndVisitCountEmpty() {
        activity(1, 1, "RUN");
        for (int sequence = 0; sequence < 5; sequence++) {
            jdbc.update("insert into activity_points values (?,?,?,?,?,?,?)",
                    ++pointId, 1L, sequence, 30.0, 120.0 + sequence * .0001, null, sequence * 10);
        }

        assertThat(sample(1, 1000)).hasSize(5).allSatisfy(row -> {
            assertThat(row.get("segment_speed")).isNull();
            assertThat(row.get("visit_count")).isNull();
        });
    }

    @Test
    void isolatesAccountAndActivityType() {
        activity(1, 1, "RUN"); activity(2, 2, "RUN"); activity(3, 1, "RIDE");
        point(1, 0, 120.0, 0, 0);
        point(2, 0, 120.0, 0, 0);
        point(3, 0, 120.0, 0, 0);

        List<Map<String, Object>> rows = sample(1, 1000);

        assertThat(rows).hasSize(1);
        assertThat(value(rows.get(0), "activity_id").longValue()).isEqualTo(1);
    }

    // 40 points along one parallel: 20 fast (5 m/s) segments, then slow (2 m/s).
    private void fastThenSlowRun(long activityId, int direction) {
        activity(activityId, 1, "RUN");
        double distance = 0;
        for (int sequence = 0; sequence < 40; sequence++) {
            if (sequence > 0) distance += (sequence < 20 ? FAST_METERS_PER_SECOND : SLOW_METERS_PER_SECOND) * 10;
            point(activityId, sequence, 120.0 + direction * distance / 100_000.0, distance, sequence * 10);
        }
    }

    private List<Map<String, Object>> byRecordingOrder(List<Map<String, Object>> rows, long activityId) {
        return rows.stream()
                .filter(row -> value(row, "activity_id").longValue() == activityId)
                .sorted(Comparator.comparingInt(row -> value(row, "sequence_index").intValue()))
                .toList();
    }

    private List<Map<String, Object>> sample(int stride, int limit) {
        return namedJdbc.queryForList(sql, Map.of("runnerId", 1L, "activityType", "RUN",
                "strideValue", stride, "limitValue", limit));
    }
    private Number value(Map<String, Object> row, String key) { return (Number) row.get(key); }
    private void activity(long id, long runner, String type) { jdbc.update("insert into activities values (?,?,?)", id, runner, type); }
    private void point(long activity, int sequence, double lng, double distance, int elapsed) {
        jdbc.update("insert into activity_points values (?,?,?,?,?,?,?)", ++pointId, activity, sequence, 30.0, lng, distance, elapsed);
    }
}
