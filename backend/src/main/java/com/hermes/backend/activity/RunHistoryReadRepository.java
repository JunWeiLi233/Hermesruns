package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Narrow scalar index for whole-history aggregates; full entities are loaded only for the page. */
public interface RunHistoryReadRepository extends Repository<Activity, Long> {
    @Query("""
            select a.id as id, a.name as name, a.startTime as startTime, a.startDate as startDate,
                   a.createdAt as createdAt, a.stravaApiSourced as stravaApiSourced,
                   a.distanceKm as distanceKm, a.distanceMeters as distanceMeters,
                   a.movingTimeSeconds as movingTimeSeconds
            from Activity a where a.runner = :runner
              and a.activityType = com.hermes.backend.activity.ActivityType.RUN order by a.id desc
            """)
    List<HistoryIndex> findHistoryIndex(@Param("runner") Runner runner);

    @EntityGraph(attributePaths = {"runner", "shoe", "shoe.runner"})
    @Query("select a from Activity a where a.runner = :runner and a.id in :ids "
            + "and a.activityType = com.hermes.backend.activity.ActivityType.RUN")
    List<Activity> findPageItems(@Param("runner") Runner runner, @Param("ids") Collection<Long> ids);

    interface HistoryIndex {
        Long getId();
        String getName();
        LocalDateTime getStartTime();
        String getStartDate();
        LocalDateTime getCreatedAt();
        Boolean getStravaApiSourced();
        Double getDistanceKm();
        Double getDistanceMeters();
        Integer getMovingTimeSeconds();
    }
}
