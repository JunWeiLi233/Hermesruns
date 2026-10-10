package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * What the training log reads of a runner's runs: one light row per run, with the effort and the day the effort was filed
 * under when the run has been analysed. A repository of its own, so the log does not have to grow
 * {@code ActivityRepository}. Every method is keyed by the runner.
 */
public interface TrainingLogRepository extends Repository<Activity, Long> {

    /** One run as the log lists it. */
    interface LogRunRow {
        Long getId();

        String getName();

        LocalDateTime getStartTime();

        LocalDateTime getCreatedAt();

        Boolean getStravaApiSourced();

        Double getDistanceKm();

        Double getDistanceMeters();

        Integer getMovingTimeSeconds();

        Long getDurationSeconds();

        Double getElevationGain();

        String getRunType();

        /** The runner's day the effort row filed the run under; null until the run has been analysed. */
        LocalDate getLocalDate();

        Double getEffortScore();

        String getEffortSource();
    }

    /**
     * A runner's runs that started in a window, oldest first. The window is on the clock the run was recorded on, which is
     * the runner's calendar for a Strava run and UTC for a file, so the caller asks for a day more at each end and keeps the
     * runs whose day, on the runner's calendar, falls inside.
     */
    @Query("""
            SELECT a.id AS id, a.name AS name, a.startTime AS startTime, a.createdAt AS createdAt,
                   a.stravaApiSourced AS stravaApiSourced, a.distanceKm AS distanceKm, a.distanceMeters AS distanceMeters,
                   a.movingTimeSeconds AS movingTimeSeconds, a.durationSeconds AS durationSeconds,
                   a.metrics.totalElevationGain AS elevationGain, a.runType AS runType,
                   m.localDate AS localDate, m.effortScore AS effortScore, m.effortSource AS effortSource
            FROM Activity a LEFT JOIN ActivityTrainingMetrics m ON m.activity = a
            WHERE a.runner.id = :runnerId AND a.activityType = :type
              AND COALESCE(a.startTime, a.createdAt) >= :from AND COALESCE(a.startTime, a.createdAt) < :to
            ORDER BY COALESCE(a.startTime, a.createdAt) ASC, a.id ASC
            """)
    List<LogRunRow> findRows(@Param("runnerId") Long runnerId, @Param("type") ActivityType type,
                             @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** What the log needs of a run to tell whether it is older than the first week shown. */
    interface OlderRunRow {
        Long getId();

        String getRunType();

        LocalDateTime getStartTime();

        LocalDateTime getCreatedAt();

        Boolean getStravaApiSourced();

        LocalDate getLocalDate();
    }

    /**
     * The newest runs that started before a moment, so the log can tell whether older runs exist. The caller asks for a day
     * past the first day shown and works out each run's day on the runner's calendar, as it does for the runs it lists.
     */
    @Query("""
            SELECT a.id AS id, a.runType AS runType, a.startTime AS startTime, a.createdAt AS createdAt,
                   a.stravaApiSourced AS stravaApiSourced, m.localDate AS localDate
            FROM Activity a LEFT JOIN ActivityTrainingMetrics m ON m.activity = a
            WHERE a.runner.id = :runnerId AND a.activityType = :type AND COALESCE(a.startTime, a.createdAt) < :before
            ORDER BY COALESCE(a.startTime, a.createdAt) DESC, a.id DESC
            """)
    List<OlderRunRow> findBefore(@Param("runnerId") Long runnerId, @Param("type") ActivityType type,
                                 @Param("before") LocalDateTime before, Pageable page);

    /** The run types a runner has used. */
    @Query("SELECT DISTINCT a.runType FROM Activity a WHERE a.runner.id = :runnerId AND a.runType IS NOT NULL")
    List<String> findRunTypesUsed(@Param("runnerId") Long runnerId);
}
