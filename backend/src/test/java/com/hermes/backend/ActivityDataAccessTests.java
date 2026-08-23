package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.mockito.InOrder;

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
}
