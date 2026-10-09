package com.hermes.backend.activity;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.HashMap;
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

class ActivityPointHeatmapSpatialQueryTests {
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
        connection = DriverManager.getConnection(postgres ? url : "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL",
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
        sql = ActivityPointRepository.class.getMethod("findHeatmapSpatialPointsByRunnerAndType", Long.class, String.class,
                double.class, double.class, double.class, double.class, double.class, double.class, int.class, int.class)
                .getAnnotation(Query.class).value();
    }

    @AfterEach
    void tearDown() throws Exception {
        try { if (jdbc != null) jdbc.execute("drop schema " + schema + " cascade"); }
        finally { if (connection != null) connection.close(); }
    }

    @Test
    void countsDistinctRunsAndPreservesSparseStreetCoverageWithinBudget() {
        for (int run = 1; run <= 25; run++) {
            activity(run, 1, "RUN");
            for (int point = 0; point < 16; point++) {
                point(run, point, 30.0001 + (point / 4) * .00025, 120.0001 + (point % 4) * .00025, point * 10, point * 3);
            }
        }
        activity(100, 1, "RUN");
        for (int point = 0; point < 12; point++) point(100, point, 30.0021 + point * .001, 120.0101, point * 10, point * 3);
        List<Map<String, Object>> result = sample(16, 16);
        assertThat(result).hasSizeLessThanOrEqualTo(16);
        assertThat(result.stream().filter(row -> value(row, "visit_count").longValue() == 25).count()).isGreaterThan(1);
        assertThat(result.stream().filter(row -> value(row, "activity_id").longValue() == 100).count()).isEqualTo(12);
        for (Map<String, Object> row : result) {
            assertThat(jdbc.queryForObject("select count(*) from activity_points where activity_id=? and latitude=? and longitude=?",
                    Integer.class, row.get("activity_id"), row.get("latitude"), row.get("longitude"))).isPositive();
        }
    }

    @Test
    void denseRecordingFromOneRunIsStillOneVisit() {
        activity(1, 1, "RUN");
        for (int point = 0; point < 400; point++) point(1, point, 30.0001 + (point % 4) * .0002, 120.0001, point, point);
        List<Map<String, Object>> result = sample(20, 20);
        assertThat(result).hasSizeLessThanOrEqualTo(4).isNotEmpty();
        assertThat(result).allSatisfy(row -> assertThat(value(row, "visit_count").longValue()).isEqualTo(1));
    }

    @Test
    void isolatesAccountActivityTypeAndViewport() {
        activity(1, 1, "RUN"); activity(2, 2, "RUN"); activity(3, 1, "RIDE");
        point(1, 0, 30.0001, 120.0001, 0, 0);
        point(1, 1, 50, 140, 1, 1);
        point(2, 0, 30.0001, 120.0001, 0, 0);
        point(3, 0, 30.0001, 120.0001, 0, 0);
        List<Map<String, Object>> result = sample(20, 20);
        assertThat(result).hasSize(1);
        assertThat(value(result.get(0), "activity_id").longValue()).isEqualTo(1);
        assertThat(value(result.get(0), "visit_count").longValue()).isEqualTo(1);
    }

    @Test
    void usesAdjacentRecordedPointForSpeedInsteadOfSampleGaps() {
        activity(1, 1, "RUN");
        point(1, 0, 30.0001, 120.0001, 0, 0);
        point(1, 1, 30.00011, 120.00011, 100, 10);
        point(1, 2, 30.00012, 120.00012, 120, 20);
        List<Map<String, Object>> result = sample(20, 20);
        assertThat(result).hasSize(1);
        assertThat(value(result.get(0), "sequence_index").intValue()).isEqualTo(2);
        assertThat(value(result.get(0), "segment_speed").doubleValue()).isEqualTo(2);
    }

    @Test
    void keepsGeographicExtremesWhenCoverageExceedsBudget() {
        activity(1, 1, "RUN");
        for (int point = 0; point < 18; point++) point(1, point, 30.0001 + point * .001, 120.0001, point, point);
        List<Map<String, Object>> result = sample(5, 10);
        assertThat(result).hasSize(10);
        assertThat(result.stream().mapToDouble(row -> value(row, "latitude").doubleValue()).max().orElseThrow()).isGreaterThan(30.015);
        assertThat(result.stream().mapToDouble(row -> value(row, "latitude").doubleValue()).min().orElseThrow()).isLessThan(30.001);
    }

    @Test
    void returnsEmptyWithoutGpsInViewport() { assertThat(sample(20, 20)).isEmpty(); }

    private List<Map<String, Object>> sample(int coverageLimit, int limit) {
        Map<String, Object> params = new HashMap<>(Map.of("runnerId", 1L, "activityType", "RUN", "south", 30.0,
                "west", 120.0, "north", 30.02, "east", 120.02, "latitudeCellSize", .001, "longitudeCellSize", .001));
        params.put("coverageLimit", coverageLimit); params.put("limitValue", limit);
        return namedJdbc.queryForList(sql, params);
    }
    private Number value(Map<String, Object> row, String key) { return (Number) row.get(key); }
    private void activity(long id, long runner, String type) { jdbc.update("insert into activities values (?,?,?)", id, runner, type); }
    private void point(long activity, int sequence, double lat, double lng, double distance, int elapsed) {
        jdbc.update("insert into activity_points values (?,?,?,?,?,?,?)", ++pointId, activity, sequence, lat, lng, distance, elapsed);
    }
}
