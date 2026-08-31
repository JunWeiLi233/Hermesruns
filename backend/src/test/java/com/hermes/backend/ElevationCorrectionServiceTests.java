package com.hermes.backend;

import org.junit.jupiter.api.Test;
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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ElevationCorrectionServiceTests {

    @Test
    void computeStatusDoesNotFlagRollingRouteWhenDemAscentMatchesRawAscent() {
        ActivityPointRepository repository = mock(ActivityPointRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        ElevationCorrectionService service = new ElevationCorrectionService(repository, restTemplate);
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
        ElevationCorrectionService service = new ElevationCorrectionService(repository, restTemplate);
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
        ElevationCorrectionService service = new ElevationCorrectionService(repository, restTemplate);
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
        RestTemplate restTemplate = mock(RestTemplate.class);
        ElevationCorrectionService service = new ElevationCorrectionService(repository, restTemplate);
        Activity activity = new Activity();
        List<ActivityPoint> points = List.of(
                point(0, 40.000, -73.000, 10),
                point(1, 40.001, -73.001, 70),
                point(2, 40.002, -73.002, 10)
        );
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
        verify(repository).saveAll(points);
    }

    @Test
    void statusCacheEvictsLeastRecentlyUsedEntriesBeyondCap() {
        ActivityPointRepository repository = mock(ActivityPointRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        ElevationCorrectionService service = new ElevationCorrectionService(repository, restTemplate);

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
        ElevationCorrectionService service = new ElevationCorrectionService(repository, restTemplate);
        Activity activity = correctedProfileActivity(1L);
        when(repository.findByActivityOrderBySequenceIndexAsc(activity)).thenReturn(correctedProfilePoints());
        mockDem(restTemplate, List.of(10, 20, 10));

        service.computeStatus(activity);
        assertEquals(1, service.statusCacheSizeForTests());

        service.recalibrate(activity, null);
        assertEquals(0, service.statusCacheSizeForTests());
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
