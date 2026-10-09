package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Limit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ActivityDataAccess {

    private static final int POINT_INSERT_BATCH_SIZE = 500;
    private static final int POINT_UPDATE_BATCH_SIZE = 500;

    /**
     * Bulk insert for GPS points. JDBC batched because ActivityPoint uses an
     * IDENTITY id, which forces Hibernate into one round trip per row; the
     * batched statement cuts a 3000-point import from ~800ms of insert round
     * trips down to ~25ms on PostgreSQL. Callers must have verified the runner
     * owns the referenced activity (see ActivityPoint ownership rule).
     */
    private static final String INSERT_POINT_SQL = """
            insert into activity_points (activity_id, sequence_index, latitude, longitude,
                elapsed_seconds, distance_meters, elevation_meters, elevation_raw_meters,
                elevation_corrected_meters, heart_rate, cadence, ground_contact_time_ms,
                vertical_oscillation_mm)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;

    /**
     * Bulk elevation rewrite for existing GPS points. JDBC batched because a
     * repository saveAll of the loaded entities issues one UPDATE per point;
     * the batched statement rewrites the same rows in a fraction of the round
     * trips. Only the two elevation columns recalibrate mutates are written;
     * every other column keeps its stored value. The activity_id predicate is
     * a defensive scope: callers pass the owning activity of the loaded points.
     */
    private static final String UPDATE_POINT_ELEVATION_SQL = """
            update activity_points set elevation_raw_meters = ?, elevation_corrected_meters = ?
            where activity_id = ? and id = ?
            """;

    /** Ids per IN list when deleting in bulk; keeps statements well under any driver's parameter limit. */
    private static final int DELETE_CHUNK_SIZE = 500;

    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final JdbcTemplate jdbcTemplate;

    // Optional collaborators, injected by Spring. They stay unset in tests that build this class by hand.
    private List<ActivityDeletionHook> deletionHooks = List.of();
    private DeletedActivityTombstoneRepository tombstones;
    private ApplicationEventPublisher events;

    public ActivityDataAccess(ActivityRepository activityRepository,
                              ActivityPointRepository activityPointRepository,
                              JdbcTemplate jdbcTemplate) {
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Autowired(required = false)
    void setDeletionHooks(List<ActivityDeletionHook> deletionHooks) {
        this.deletionHooks = deletionHooks == null ? List.of() : List.copyOf(deletionHooks);
    }

    @Autowired(required = false)
    void setTombstones(DeletedActivityTombstoneRepository tombstones) {
        this.tombstones = tombstones;
    }

    @Autowired(required = false)
    void setEvents(ApplicationEventPublisher events) {
        this.events = events;
    }

    public List<Activity> findRunsForRunner(Runner runner) {
        return activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN);
    }

    /**
     * Limited run-history read for feed callers that only need the most recent N runs.
     * The cap goes into the query itself, so only N activity rows (and their eager
     * runner/shoe associations) are loaded and mapped.
     */
    public List<Activity> findRunsForRunner(Runner runner, int limit) {
        return activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN, Limit.of(limit));
    }

    public List<Activity> findActivitiesByIdsForRunner(List<Long> ids, Runner runner) {
        return activityRepository.findByIdInAndRunner(ids, runner);
    }

    public Optional<Activity> findActivityForRunner(Long id, Runner runner) {
        return activityRepository.findByIdAndRunner(id, runner);
    }

    /**
     * Deletes an activity owned by {@code runner}. Removes the activity's GPS points
     * first with one bulk delete (the JPA derived delete loads every point entity and
     * deletes row by row), then deletes the activity itself.
     * Returns true if an activity was owned by the runner and deleted, false otherwise.
     */
    @org.springframework.transaction.annotation.Transactional
    public boolean deleteActivityForRunner(Long id, Runner runner) {
        Optional<Activity> owned = activityRepository.findByIdAndRunner(id, runner);
        if (owned.isEmpty()) {
            return false;
        }
        Activity activity = owned.get();
        rememberApiDeletion(runner, activity);
        runDeletionHooks(List.of(activity.getId()));
        deletePointsForActivity(activity.getId());
        activityRepository.delete(activity);
        activityRepository.flush();
        return true;
    }

    /**
     * Permanently deletes the given runs, their GPS points and anything that points at them, scoped to
     * one runner: ids the runner does not own are ignored. Unlike {@link #deleteActivityForRunner} it
     * leaves no tombstone, because it is used when the data itself must go (disconnect, retention,
     * account deletion). Returns how many runs were deleted.
     */
    @Transactional
    public int purgeActivities(Runner runner, Collection<Long> activityIds) {
        if (runner == null || activityIds == null || activityIds.isEmpty()) {
            return 0;
        }
        List<Long> ids = List.copyOf(activityIds);
        int deleted = 0;
        for (int from = 0; from < ids.size(); from += DELETE_CHUNK_SIZE) {
            List<Long> chunk = ids.subList(from, Math.min(from + DELETE_CHUNK_SIZE, ids.size()));
            List<Long> owned = activityRepository.findOwnedIds(runner, chunk);
            if (owned.isEmpty()) {
                continue;
            }
            runDeletionHooks(owned);
            deletePointsForActivities(owned);
            activityRepository.deleteAllByIdInBatch(owned);
            activityRepository.flush();
            deleted += owned.size();
        }
        return deleted;
    }

    private void runDeletionHooks(Collection<Long> activityIds) {
        for (ActivityDeletionHook hook : deletionHooks) {
            hook.beforeActivitiesDeleted(activityIds);
        }
    }

    /** Remembers a deleted API run so the next sync does not re-import it. File imports need no tombstone. */
    private void rememberApiDeletion(Runner runner, Activity activity) {
        String externalId = activity.getStravaId();
        if (tombstones == null || !activity.isStravaApiSourced() || externalId == null || externalId.isBlank()) {
            return;
        }
        if (!tombstones.existsByRunnerAndProviderAndExternalId(runner, DeletedActivityTombstone.PROVIDER_STRAVA, externalId)) {
            tombstones.save(new DeletedActivityTombstone(runner, DeletedActivityTombstone.PROVIDER_STRAVA, externalId));
        }
    }

    private void deletePointsForActivities(List<Long> activityIds) {
        if (activityIds.isEmpty()) {
            return;
        }
        String placeholders = String.join(",", java.util.Collections.nCopies(activityIds.size(), "?"));
        jdbcTemplate.update("delete from activity_points where activity_id in (" + placeholders + ")", activityIds.toArray());
    }

    /**
     * Bulk-deletes all GPS points of one activity. Callers must have verified the
     * runner owns the activity (see ActivityPoint ownership rule).
     */
    public void deletePointsForActivity(Long activityId) {
        if (activityId == null) {
            return;
        }
        jdbcTemplate.update("delete from activity_points where activity_id = ?", activityId);
    }

    public List<ActivityRepository.AnalysisActivitySummaryProjection> findAnalysisSummaries(Runner runner, int boundedLimit) {
        if (boundedLimit > 0) {
            return activityRepository.findAnalysisSummariesByRunnerAndActivityType(
                    runner,
                    ActivityType.RUN,
                    PageRequest.of(0, boundedLimit)
            );
        }
        return activityRepository.findAnalysisSummariesByRunnerAndActivityType(runner, ActivityType.RUN);
    }

    public Page<Activity> findRecentRunsInDistanceBucket(
            Runner runner,
            LocalDateTime beforeTime,
            double minKm,
            double maxKm,
            PageRequest pageRequest
    ) {
        return activityRepository.findRecentRunsInDistanceBucket(
                runner,
                ActivityType.RUN,
                beforeTime,
                minKm,
                maxKm,
                pageRequest
        );
    }

    public void save(Activity activity) {
        activityRepository.save(activity);
    }

    public void saveAll(List<Activity> activities) {
        activityRepository.saveAll(activities);
    }

    public List<Object[]> findRoutePreviewSamplesByActivityIds(List<Long> activityIds, int limit) {
        return activityPointRepository.findRoutePreviewSamplesByActivityIds(activityIds, limit);
    }

    public List<Object[]> findRoutePreviewBboxesByActivityIds(List<Long> activityIds) {
        return activityPointRepository.findRoutePreviewBboxesByActivityIds(activityIds);
    }

    public List<Object[]> findHeatmapCoordsByRunnerAndYear(
            Runner runner,
            LocalDateTime yearStart,
            LocalDateTime yearEnd,
            String startDatePrefix
    ) {
        return activityPointRepository.findHeatmapCoordsByRunnerAndTypeAndYear(
                runner,
                ActivityType.RUN,
                yearStart,
                yearEnd,
                startDatePrefix
        );
    }

    public List<Object[]> findHeatmapCoordsByRunner(Runner runner) {
        return activityPointRepository.findHeatmapCoordsByRunnerAndType(runner, ActivityType.RUN);
    }

    public boolean hasPoints(Activity activity) {
        return activityPointRepository.existsByActivity(activity);
    }

    public List<Object[]> findAnalyticsSamplesByActivityId(Long activityId) {
        return activityPointRepository.findAnalyticsSamplesByActivityIdOrdered(activityId);
    }

    public List<Object[]> findHrSamplesByActivityId(Long activityId) {
        return activityPointRepository.findHrSamplesByActivityIdOrdered(activityId);
    }

    /** A run's heart-rate samples as parallel arrays, in order: seconds from the start, and beats per minute. */
    public record HeartRateStream(int[] elapsedSeconds, int[] heartRates, int size) {
    }

    /**
     * Every heart-rate sample of an activity, oldest first, with no cap on the number of samples (a run is
     * stored with at most 100 000 points). Filled straight from the result set into primitive arrays, so a
     * long run does not become a hundred thousand boxed values.
     *
     * <p>Caller-verified ownership (see the ActivityPoint rule): the caller has already established that the
     * activity belongs to the runner the result is for.</p>
     */
    public HeartRateStream findHeartRateStream(Long activityId) {
        return jdbcTemplate.query(
                "select elapsed_seconds, heart_rate from activity_points "
                        + "where activity_id = ? and heart_rate is not null and elapsed_seconds is not null "
                        + "order by sequence_index asc",
                rows -> {
                    int[] elapsed = new int[1024];
                    int[] heartRate = new int[1024];
                    int size = 0;
                    while (rows.next()) {
                        if (size == elapsed.length) {
                            elapsed = java.util.Arrays.copyOf(elapsed, size * 2);
                            heartRate = java.util.Arrays.copyOf(heartRate, size * 2);
                        }
                        elapsed[size] = rows.getInt(1);
                        heartRate[size] = rows.getInt(2);
                        size++;
                    }
                    return new HeartRateStream(elapsed, heartRate, size);
                },
                activityId);
    }

    /** Whether any stored point of the activity carries a heart rate. Caller-verified ownership, as above. */
    public boolean hasHeartRatePoints(Long activityId) {
        Integer found = jdbcTemplate.queryForObject(
                "select count(*) from (select 1 from activity_points where activity_id = ? and heart_rate is not null limit 1) t",
                Integer.class,
                activityId);
        return found != null && found > 0;
    }

    public List<Object[]> findLatLngByActivityId(Long activityId) {
        return activityPointRepository.findLatLngByActivityIdOrdered(activityId);
    }

    public void savePoints(List<ActivityPoint> points) {
        if (points == null || points.isEmpty()) {
            return;
        }
        jdbcTemplate.batchUpdate(INSERT_POINT_SQL, points, POINT_INSERT_BATCH_SIZE, ActivityDataAccess::bindPointInsert);
    }

    @Transactional
    public boolean savePointsIfAbsentAtomically(Long activityId, List<ActivityPoint> points) {
        if (activityId == null || points == null || points.isEmpty()) {
            return false;
        }

        Activity lockedActivity = activityRepository.findByIdForUpdate(activityId)
                .orElseThrow(() -> new IllegalArgumentException("Activity not found: " + activityId));
        if (activityPointRepository.existsByActivity(lockedActivity)) {
            return false;
        }

        for (ActivityPoint point : points) {
            point.setActivity(lockedActivity);
        }
        jdbcTemplate.batchUpdate(INSERT_POINT_SQL, points, POINT_INSERT_BATCH_SIZE, ActivityDataAccess::bindPointInsert);
        if (events != null && lockedActivity.getRunner() != null) {
            // The run was saved before its stream was fetched, so what is computed from the points has to be
            // computed again now that they are here. Listeners wait for this transaction to commit.
            events.publishEvent(new ActivityPointsStoredEvent(lockedActivity.getRunner().getId(), activityId));
        }
        return true;
    }

    /**
     * Batched update of the elevation columns recalibrate rewrites. Callers must
     * have verified the runner owns the activity (see ActivityPoint ownership
     * rule) and must have loaded the points for that same activity. Runs inside
     * the caller's transaction; managed point entities should be detached after
     * this call so the commit-time flush does not re-issue per-entity updates.
     */
    public void updatePointElevations(Long activityId, List<ActivityPoint> points) {
        if (activityId == null || points == null || points.isEmpty()) {
            return;
        }
        jdbcTemplate.batchUpdate(UPDATE_POINT_ELEVATION_SQL, points, POINT_UPDATE_BATCH_SIZE,
                (ps, point) -> bindPointElevationUpdate(activityId, ps, point));
    }

    private static void bindPointInsert(PreparedStatement ps, ActivityPoint point) throws SQLException {
        Activity activity = point.getActivity();
        if (activity == null || activity.getId() == null) {
            throw new IllegalArgumentException("ActivityPoint batch insert requires a persisted activity");
        }
        ps.setLong(1, activity.getId());
        ps.setInt(2, point.getSequenceIndex());
        ps.setDouble(3, point.getLatitude());
        ps.setDouble(4, point.getLongitude());
        setNullableInt(ps, 5, point.getElapsedSeconds());
        setNullableDouble(ps, 6, point.getDistanceMeters());
        setNullableDouble(ps, 7, point.getElevationMeters());
        setNullableDouble(ps, 8, point.getElevationRawMeters());
        setNullableDouble(ps, 9, point.getElevationCorrectedMeters());
        setNullableInt(ps, 10, point.getHeartRate());
        setNullableInt(ps, 11, point.getCadence());
        setNullableDouble(ps, 12, point.getGroundContactTimeMs());
        setNullableDouble(ps, 13, point.getVerticalOscillationMm());
    }

    private static void bindPointElevationUpdate(Long activityId, PreparedStatement ps, ActivityPoint point) throws SQLException {
        if (point.getId() == null) {
            throw new IllegalArgumentException("ActivityPoint elevation update requires a persisted point");
        }
        setNullableDouble(ps, 1, point.getElevationRawMeters());
        setNullableDouble(ps, 2, point.getElevationCorrectedMeters());
        ps.setLong(3, activityId);
        ps.setLong(4, point.getId());
    }

    private static void setNullableInt(PreparedStatement ps, int index, Integer value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.INTEGER);
        } else {
            ps.setInt(index, value);
        }
    }

    private static void setNullableDouble(PreparedStatement ps, int index, Double value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.DOUBLE);
        } else {
            ps.setDouble(index, value);
        }
    }
}
