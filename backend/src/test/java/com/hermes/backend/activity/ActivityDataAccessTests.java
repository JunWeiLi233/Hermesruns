package com.hermes.backend.activity;

import java.lang.reflect.Method;
import java.sql.PreparedStatement;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ParameterizedPreparedStatementSetter;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActivityDataAccessTests {

    @Test
    void atomicallyHydratesPointsLocksParentBeforeCheckingAndInserting() throws Exception {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        ActivityDataAccess activityDataAccess = new ActivityDataAccess(
                activityRepository,
                activityPointRepository,
                jdbcTemplate
        );

        Activity lockedActivity = new Activity();
        lockedActivity.setId(19L);
        ActivityPoint point = new ActivityPoint();
        point.setLatitude(40.7d);
        point.setLongitude(-74.0d);
        List<ActivityPoint> points = List.of(point);

        when(activityRepository.findByIdForUpdate(19L)).thenReturn(Optional.of(lockedActivity));
        when(activityPointRepository.existsByActivity(lockedActivity)).thenReturn(false);

        assertTrue(activityDataAccess.savePointsIfAbsentAtomically(19L, points));
        assertSame(lockedActivity, point.getActivity());

        InOrder inOrder = inOrder(activityRepository, activityPointRepository, jdbcTemplate);
        inOrder.verify(activityRepository).findByIdForUpdate(19L);
        inOrder.verify(activityPointRepository).existsByActivity(lockedActivity);
        inOrder.verify(jdbcTemplate).batchUpdate(anyString(), eq(points), eq(500), any());
        verify(jdbcTemplate, times(1)).batchUpdate(anyString(), eq(points), eq(500), any());

        Method method = ActivityDataAccess.class.getMethod(
                "savePointsIfAbsentAtomically",
                Long.class,
                List.class
        );
        assertNotNull(method.getAnnotation(Transactional.class));
    }

    @Test
    void atomicallyHydratesPointsSkipsInsertWhenLockedActivityAlreadyHasPoints() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        ActivityDataAccess activityDataAccess = new ActivityDataAccess(
                activityRepository,
                activityPointRepository,
                jdbcTemplate
        );

        Activity lockedActivity = new Activity();
        lockedActivity.setId(19L);
        List<ActivityPoint> points = List.of(new ActivityPoint());

        when(activityRepository.findByIdForUpdate(19L)).thenReturn(Optional.of(lockedActivity));
        when(activityPointRepository.existsByActivity(lockedActivity)).thenReturn(true);

        assertFalse(activityDataAccess.savePointsIfAbsentAtomically(19L, points));

        verify(activityRepository).findByIdForUpdate(19L);
        verify(activityPointRepository).existsByActivity(lockedActivity);
        verify(jdbcTemplate, never()).batchUpdate(anyString(), anyList(), anyInt(), any());
    }

    @Test
    void savePointsUsesFixedBatchSizeForOversizedInput() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        ActivityDataAccess activityDataAccess = new ActivityDataAccess(
                activityRepository,
                activityPointRepository,
                jdbcTemplate
        );

        Activity activity = new Activity();
        activity.setId(19L);
        List<ActivityPoint> points = new ArrayList<>();
        for (int index = 0; index < 620; index++) {
            ActivityPoint point = new ActivityPoint();
            point.setActivity(activity);
            points.add(point);
        }

        activityDataAccess.savePoints(points);

        verify(jdbcTemplate).batchUpdate(anyString(), eq(points), eq(500), any());
    }

    @Test
    void updatePointElevationsBatchesAtFixedSizeAndBindsOnlyElevationColumns() throws Exception {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        ActivityDataAccess activityDataAccess = new ActivityDataAccess(
                activityRepository,
                activityPointRepository,
                jdbcTemplate
        );

        ActivityPoint point = new ActivityPoint();
        point.setId(101L);
        point.setElevationRawMeters(10.0);
        point.setElevationCorrectedMeters(12.5);
        // A point whose raw elevation stayed null (no barometric profile, no
        // backfill source) must bind SQL NULL, exactly like the old saveAll.
        ActivityPoint missingRawPoint = new ActivityPoint();
        missingRawPoint.setId(102L);
        missingRawPoint.setElevationCorrectedMeters(13.5);
        List<ActivityPoint> points = List.of(point, missingRawPoint);

        activityDataAccess.updatePointElevations(19L, points);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<ParameterizedPreparedStatementSetter<ActivityPoint>> setterCaptor = ArgumentCaptor
                .forClass(ParameterizedPreparedStatementSetter.class);
        verify(jdbcTemplate).batchUpdate(
                contains("update activity_points"), eq(points), eq(500), setterCaptor.capture());

        PreparedStatement preparedStatement = mock(PreparedStatement.class);
        setterCaptor.getValue().setValues(preparedStatement, point);
        verify(preparedStatement).setDouble(1, 10.0);
        verify(preparedStatement).setDouble(2, 12.5);
        verify(preparedStatement).setLong(3, 19L);
        verify(preparedStatement).setLong(4, 101L);

        PreparedStatement missingRawStatement = mock(PreparedStatement.class);
        setterCaptor.getValue().setValues(missingRawStatement, missingRawPoint);
        verify(missingRawStatement).setNull(1, Types.DOUBLE);
        verify(missingRawStatement).setDouble(2, 13.5);
        verify(missingRawStatement).setLong(3, 19L);
        verify(missingRawStatement).setLong(4, 102L);
    }

    @Test
    void updatePointElevationsSkipsBatchWhenActivityIdMissing() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        ActivityDataAccess activityDataAccess = new ActivityDataAccess(
                activityRepository,
                activityPointRepository,
                jdbcTemplate
        );

        activityDataAccess.updatePointElevations(null, List.of(new ActivityPoint()));

        verify(jdbcTemplate, never()).batchUpdate(anyString(), anyList(), anyInt(), any());
    }

    @Test
    void updatePointElevationsBinderRejectsUnpersistedPoint() throws Exception {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        ActivityDataAccess activityDataAccess = new ActivityDataAccess(
                activityRepository,
                activityPointRepository,
                jdbcTemplate
        );

        ActivityPoint point = new ActivityPoint();
        point.setId(101L);
        List<ActivityPoint> points = List.of(point);

        activityDataAccess.updatePointElevations(19L, points);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<ParameterizedPreparedStatementSetter<ActivityPoint>> setterCaptor = ArgumentCaptor
                .forClass(ParameterizedPreparedStatementSetter.class);
        verify(jdbcTemplate).batchUpdate(anyString(), eq(points), eq(500), setterCaptor.capture());

        assertThrows(IllegalArgumentException.class,
                () -> setterCaptor.getValue().setValues(mock(PreparedStatement.class), new ActivityPoint()));
    }
}
