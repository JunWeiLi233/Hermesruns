package com.hermes.backend;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ElevationCorrectionServiceTests {

    @Test
    void computeStatusDoesNotFlagRollingRouteWhenDemAscentMatchesRawAscent() {
        ActivityPointRepository repository = mock(ActivityPointRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        ElevationCorrectionService service = newService(repository, restTemplate);
        Activity activity = new Activity();
        List<ActivityPoint> points = List.of(
                point(0, 40.000, -73.000, 10),
                point(1, 40.001, -73.001, 30),
                point(2, 40.002, -73.002, 15),
                point(3, 40.003, -73.003, 35),
                point(4, 40.004, -73.004, 10)
        );
        when(repository.findByActivityOrderBySequenceIndexAsc(activity)).thenReturn(points);
        mockDem(restTemplate, List.of(12, 31, 16, 36, 12));

        ElevationCorrectionService.ElevationStatus status = service.computeStatus(activity);

        assertFalse(status.flagged());
        assertEquals(40.0, status.totalAscentBarometric(), 0.001);
        assertEquals(39.0, status.totalAscentDem(), 0.001);
        assertTrue(status.variance() < 0.25);
        assertTrue(status.canRecalibrate());
    }

    @Test
    void computeStatusFlagsLargeRawAndDemAscentDiscrepancy() {
        ActivityPointRepository repository = mock(ActivityPointRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        ElevationCorrectionService service = newService(repository, restTemplate);
        Activity activity = new Activity();
        List<ActivityPoint> points = List.of(
                point(0, 40.000, -73.000, 10),
                point(1, 40.001, -73.001, 70),
                point(2, 40.002, -73.002, 10)
        );
        when(repository.findByActivityOrderBySequenceIndexAsc(activity)).thenReturn(points);
        mockDem(restTemplate, List.of(10, 20, 10));

        ElevationCorrectionService.ElevationStatus status = service.computeStatus(activity);

        assertTrue(status.flagged());
        assertEquals(60.0, status.totalAscentBarometric(), 0.001);
        assertEquals(10.0, status.totalAscentDem(), 0.001);
        assertTrue(status.variance() > 0.25);
        assertTrue(status.canRecalibrate());
    }

    @Test
    void computeStatusDoesNotFlagWhenDemProfileCannotBeFetched() {
        ActivityPointRepository repository = mock(ActivityPointRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        ElevationCorrectionService service = newService(repository, restTemplate);
        Activity activity = new Activity();
        List<ActivityPoint> points = List.of(
                point(0, 40.000, -73.000, 10),
                point(1, 40.001, -73.001, 70),
                point(2, 40.002, -73.002, 10)
        );
        when(repository.findByActivityOrderBySequenceIndexAsc(activity)).thenReturn(points);
        mockDem(restTemplate, List.of());

        ElevationCorrectionService.ElevationStatus status = service.computeStatus(activity);

        assertFalse(status.flagged());
        assertEquals(0.0, status.variance(), 0.001);
        assertTrue(status.canRecalibrate());
    }

    @Test
    void recalibrateClearsWarningWhenCorrectedProfileMatchesDemAscent() {
        ActivityPointRepository repository = mock(ActivityPointRepository.class);
        ActivityDataAccess activityDataAccess = mock(ActivityDataAccess.class);
        EntityManager entityManager = mock(EntityManager.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        ElevationCorrectionService service = new ElevationCorrectionService(
                repository, activityDataAccess, entityManager, restTemplate);
        Activity activity = correctedProfileActivity(1L);
        List<ActivityPoint> points = List.of(
                point(0, 40.000, -73.000, 10),
                point(1, 40.001, -73.001, 70),
                point(2, 40.002, -73.002, 10)
        );
        // Raw goes missing (e.g. a provider without a barometric profile) so the
        // batched update must carry the backfill from elevationMeters too.
        points.get(1).setElevationRawMeters(null);
        when(repository.findByActivityOrderBySequenceIndexAsc(activity)).thenReturn(points);
        mockDem(restTemplate, List.of(10, 20, 10));

        ElevationCorrectionService.RecalibrateResult result = service.recalibrate(activity, null);
        ElevationCorrectionService.ElevationStatus status = service.computeStatus(activity);

        assertTrue(result.success());
        assertEquals(3, result.correctedPoints());
        assertEquals(60.0, result.totalAscentRaw(), 0.001);
        assertEquals(10.0, result.totalAscentCorrected(), 0.001);
        assertFalse(status.flagged());
        assertEquals(60.0, status.totalAscentBarometric(), 0.001);
        assertEquals(10.0, status.totalAscentDem(), 0.001);
        assertEquals(0.0, status.variance(), 0.001);
        assertTrue(status.hasCorrectedProfile());

        // Points are persisted with one batched elevation update (same final
        // field values the per-entity saveAll used to write), not a
        // repository saveAll.
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ActivityPoint>> updatedCaptor = ArgumentCaptor.forClass(List.class);
        verify(activityDataAccess).updatePointElevations(eq(1L), updatedCaptor.capture());
        List<ActivityPoint> updatedPoints = updatedCaptor.getValue();
        assertEquals(3, updatedPoints.size());
        assertEquals(10.0, updatedPoints.get(0).getElevationCorrectedMeters(), 0.001);
        assertEquals(20.0, updatedPoints.get(1).getElevationCorrectedMeters(), 0.001);
        assertEquals(10.0, updatedPoints.get(2).getElevationCorrectedMeters(), 0.001);
        assertEquals(10.0, updatedPoints.get(0).getElevationRawMeters(), 0.001);
        assertEquals(70.0, updatedPoints.get(1).getElevationRawMeters(), 0.001);
        assertEquals(10.0, updatedPoints.get(2).getElevationRawMeters(), 0.001);
        verify(repository, never()).saveAll(any());
        // Regression guard: the mutated points are managed entities; unless each
        // one is detached, the commit-time flush dirty-checks them and re-issues
        // the per-entity UPDATE storm the batched statement exists to replace.
        verify(entityManager, times(3)).detach(any(ActivityPoint.class));
    }

    @Test
    void statusCacheEvictsLeastRecentlyUsedEntriesBeyondCap() {
        ActivityPointRepository repository = mock(ActivityPointRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        ElevationCorrectionService service = newService(repository, restTemplate);

        List<Activity> activities = new ArrayList<>();
        for (long id = 1; id <= 256; id++) {
            Activity activity = correctedProfileActivity(id);
            activities.add(activity);
            when(repository.findByActivityOrderBySequenceIndexAsc(activity)).thenReturn(correctedProfilePoints());
            service.computeStatus(activity);
        }
        assertEquals(256, service.statusCacheSizeForTests());

        // Refresh activity 1 so it becomes the most-recently used entry.
        service.computeStatus(activities.get(0));
        verify(repository, times(1)).findByActivityOrderBySequenceIndexAsc(activities.get(0));

        // One more activity evicts the least-recently used entry (activity 2), not activity 1.
        Activity extra = correctedProfileActivity(257L);
        when(repository.findByActivityOrderBySequenceIndexAsc(extra)).thenReturn(correctedProfilePoints());
        service.computeStatus(extra);
        assertEquals(256, service.statusCacheSizeForTests());

        // Activity 1 survived eviction and is still served from the cache.
        service.computeStatus(activities.get(0));
        verify(repository, times(1)).findByActivityOrderBySequenceIndexAsc(activities.get(0));

        // Activity 2 was evicted and must be recomputed from the repository.
        service.computeStatus(activities.get(1));
        verify(repository, times(2)).findByActivityOrderBySequenceIndexAsc(activities.get(1));
    }

    @Test
    void recalibrateStillDropsCachedStatusForRecalibratedActivity() {
        ActivityPointRepository repository = mock(ActivityPointRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        ElevationCorrectionService service = newService(repository, restTemplate);
        Activity activity = correctedProfileActivity(1L);
        when(repository.findByActivityOrderBySequenceIndexAsc(activity)).thenReturn(correctedProfilePoints());
        mockDem(restTemplate, List.of(10, 20, 10));

        service.computeStatus(activity);
        assertEquals(1, service.statusCacheSizeForTests());

        service.recalibrate(activity, null);
        assertEquals(0, service.statusCacheSizeForTests());
    }

    private static ElevationCorrectionService newService(ActivityPointRepository repository, RestTemplate restTemplate) {
        return new ElevationCorrectionService(
                repository,
                mock(ActivityDataAccess.class),
                mock(EntityManager.class),
                restTemplate);
    }

    private static Activity correctedProfileActivity(long id) {
        Activity activity = new Activity();
        activity.setId(id);
        return activity;
    }

    private static List<ActivityPoint> correctedProfilePoints() {
        ActivityPoint first = point(0, 40.000, -73.000, 10);
        first.setElevationCorrectedMeters(10.0);
        ActivityPoint second = point(1, 40.001, -73.001, 30);
        second.setElevationCorrectedMeters(30.0);
        return List.of(first, second);
    }

    private static ActivityPoint point(int sequence, double latitude, double longitude, double elevation) {
        ActivityPoint point = new ActivityPoint();
        point.setSequenceIndex(sequence);
        point.setLatitude(latitude);
        point.setLongitude(longitude);
        point.setElevationMeters(elevation);
        point.setElevationRawMeters(elevation);
        return point;
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static void mockDem(RestTemplate restTemplate, List<? extends Number> elevations) {
        Map<String, Object> body = Map.of("elevation", elevations);
        when(restTemplate.exchange(any(RequestEntity.class), any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(body));
    }
}
