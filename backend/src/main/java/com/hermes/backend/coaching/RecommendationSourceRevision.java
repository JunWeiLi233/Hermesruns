package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityLocalDates;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.routing.RouteHeatmapAnchorService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.HexFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** A digest of committed source data, never of the coach rows rewritten during a read. */
@Service
public class RecommendationSourceRevision {
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final RouteHeatmapAnchorService anchors;

    public RecommendationSourceRevision(JdbcTemplate jdbc, Clock clock, RouteHeatmapAnchorService anchors) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.anchors = anchors;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public String revision(Runner runner) {
        MessageDigest digest;
        try { digest = MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
        for (Object value : Arrays.asList(runner.getId(), LocalDate.now(clock.withZone(ActivityLocalDates.zoneOf(runner))),
                runner.getTimeZone(), runner.getMaxHeartRateBpm(), runner.getRestingHeartRateBpm(),
                runner.getWellnessSleepSource(), runner.getWellnessHrvSource(), runner.getWellnessStressSource(),
                runner.getWellnessRestingHrSource(), runner.isGarminWellnessSyncEnabled(), anchors.sourceRevision(runner.getId()))) {
            add(digest, value == null ? null : value.toString());
        }
        // Scalar run rows only: no GPS streams, routes, credentials or generated recommendations.
        rows(digest, "select id, start_time, created_at, strava_api_sourced, activity_type, distance_km, distance_meters, "
                + "moving_time_seconds, duration_seconds, average_heart_rate, max_heart_rate, perceived_exertion, gps_stream_checked_at "
                + "from activities where runner_id = ? order by id", runner.getId());
        for (String table : new String[]{"daily_sleep_data", "daily_hrv_data", "daily_stress_data", "daily_wellness_summary"}) {
            rows(digest, "select * from " + table + " where runner_id = ? order by id", runner.getId());
        }
        rows(digest, "select id, effort_score, effort_source, hr_zone4_seconds, hr_zone5_seconds, stale "
                + "from activity_training_metrics where runner_id = ? order by id", runner.getId());
        return HexFormat.of().formatHex(digest.digest());
    }

    private void rows(MessageDigest digest, String sql, Long runnerId) {
        add(digest, sql);
        jdbc.query(sql, (RowCallbackHandler) row -> {
            add(digest, "row");
            for (int column = 1; column <= row.getMetaData().getColumnCount(); column++) add(digest, row.getString(column));
        }, runnerId);
    }

    private static void add(MessageDigest digest, String value) {
        byte[] bytes = value == null ? new byte[0] : value.getBytes(StandardCharsets.UTF_8);
        digest.update((value == null ? "null:" : bytes.length + ":").getBytes(StandardCharsets.UTF_8));
        digest.update(bytes);
    }
}
