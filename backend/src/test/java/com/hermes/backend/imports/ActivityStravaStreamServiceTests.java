package com.hermes.backend.imports;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityDataAccess;
import com.hermes.backend.activity.ActivityPoint;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.auth.SecretEncryptionService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActivityStravaStreamServiceTests {

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static HttpEntity<?> anyHttpEntity() {
        return (HttpEntity) any(HttpEntity.class);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static <T> ParameterizedTypeReference<T> anyTypeRef() {
        return (ParameterizedTypeReference) any(ParameterizedTypeReference.class);
    }

    @Test
    void hydratesMoreThanOneBatchThroughOneAtomicPersistenceCall() {
        ActivityDataAccess activityDataAccess = mock(ActivityDataAccess.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        ActivityStravaStreamService service = new ActivityStravaStreamService(
                activityDataAccess,
                activityRepository,
                runnerRepository,
                secretEncryptionService,
                restTemplate
        );

        Activity activity = new Activity();
        activity.setId(19L);
        activity.setStravaId("strava-19");
        Runner runner = new Runner();
        runner.setStravaAccessToken("stored-token");

        List<List<Double>> latlng = new ArrayList<>();
        for (int index = 0; index < 620; index++) {
            latlng.add(List.of(40.7d + index * 0.0001d, -74.0d - index * 0.0001d));
        }
        List<Map<String, Object>> streams = List.of(Map.of("type", "latlng", "data", latlng));

        when(activityDataAccess.hasPoints(activity)).thenReturn(false);
        when(secretEncryptionService.decrypt("stored-token")).thenReturn("access-token");
        when(restTemplate.exchange(
                anyString(),
                eq(HttpMethod.GET),
                anyHttpEntity(),
                anyTypeRef()
        )).thenReturn(ResponseEntity.ok(streams));

        service.hydrateActivityPointsIfMissing(activity, runner);

        verify(activityDataAccess).savePointsIfAbsentAtomically(
                eq(19L),
                argThat((List<ActivityPoint> points) -> points.size() == 620)
        );
        verify(activityDataAccess, never()).savePoints(anyList());
    }

    @Test
    void malformedStreamWithoutLatLngMakesNoPersistenceCall() {
        ActivityDataAccess activityDataAccess = mock(ActivityDataAccess.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        ActivityStravaStreamService service = new ActivityStravaStreamService(
                activityDataAccess,
                activityRepository,
                runnerRepository,
                secretEncryptionService,
                restTemplate
        );

        Activity activity = new Activity();
        activity.setId(19L);
        List<Map<String, Object>> malformedStreams = List.of(
                Map.of("type", "latlng", "data", "not-a-list")
        );
        when(restTemplate.exchange(
                anyString(),
                eq(HttpMethod.GET),
                anyHttpEntity(),
                anyTypeRef()
        )).thenReturn(ResponseEntity.ok(malformedStreams));

        service.fetchAndCacheStravaStream(activity, "strava-19", "access-token");

        verify(activityDataAccess, never()).savePointsIfAbsentAtomically(anyLong(), anyList());
        verify(activityDataAccess, never()).savePoints(anyList());
    }

    @Test
    void acceptsNumberCoordinatesWhenHydrating() {
        ActivityDataAccess activityDataAccess = mock(ActivityDataAccess.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        ActivityStravaStreamService service = new ActivityStravaStreamService(
                activityDataAccess,
                activityRepository,
                runnerRepository,
                secretEncryptionService,
                restTemplate
        );

        Activity activity = new Activity();
        activity.setId(19L);
        List<List<Number>> latlng = List.of(List.of(40, -74));
        when(restTemplate.exchange(
                anyString(),
                eq(HttpMethod.GET),
                anyHttpEntity(),
                anyTypeRef()
        )).thenReturn(ResponseEntity.ok(List.of(Map.of("type", "latlng", "data", latlng))));

        service.fetchAndCacheStravaStream(activity, "strava-19", "access-token");

        verify(activityDataAccess).savePointsIfAbsentAtomically(
                eq(19L),
                argThat((List<ActivityPoint> points) -> points.size() == 1
                        && points.get(0).getLatitude() == 40d
                        && points.get(0).getLongitude() == -74d)
        );
    }

    @Test
    void noGpsTombstoneSkipsStreamFetchOnRunView() {
        ActivityDataAccess activityDataAccess = mock(ActivityDataAccess.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        ActivityStravaStreamService service = new ActivityStravaStreamService(
                activityDataAccess,
                activityRepository,
                runnerRepository,
                secretEncryptionService,
                restTemplate
        );
        ReflectionTestUtils.setField(service, "noGpsRetryDays", 30);

        Activity activity = new Activity();
        activity.setId(19L);
        activity.setStravaId("strava-19");
        activity.setGpsStreamState("NO_GPS");
        activity.setGpsStreamCheckedAt(LocalDateTime.now().minusDays(1));
        Runner runner = new Runner();
        runner.setStravaAccessToken("stored-token");

        when(activityDataAccess.hasPoints(activity)).thenReturn(false);
        when(secretEncryptionService.decrypt("stored-token")).thenReturn("access-token");

        service.hydrateActivityPointsIfMissing(activity, runner);

        verify(restTemplate, never()).exchange(anyString(), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef());
        verify(activityDataAccess, never()).savePointsIfAbsentAtomically(anyLong(), anyList());
        verify(activityRepository, never()).save(any(Activity.class));
    }

    @Test
    void treadmillStreamWithoutLatLngIsTombstonedForLaterViews() {
        ActivityDataAccess activityDataAccess = mock(ActivityDataAccess.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        ActivityStravaStreamService service = new ActivityStravaStreamService(
                activityDataAccess,
                activityRepository,
                runnerRepository,
                secretEncryptionService,
                restTemplate
        );
        ReflectionTestUtils.setField(service, "noGpsRetryDays", 30);

        Activity activity = new Activity();
        activity.setId(19L);
        List<Map<String, Object>> streamsWithoutLatlng = List.of(
                Map.of("type", "time", "data", List.of(0, 1, 2))
        );
        when(restTemplate.exchange(
                anyString(),
                eq(HttpMethod.GET),
                anyHttpEntity(),
                anyTypeRef()
        )).thenReturn(ResponseEntity.ok(streamsWithoutLatlng));

        service.fetchAndCacheStravaStream(activity, "strava-19", "access-token");

        assertEquals("NO_GPS", activity.getGpsStreamState());
        assertNotNull(activity.getGpsStreamCheckedAt());
        verify(activityRepository).save(activity);
        verify(activityDataAccess, never()).savePointsIfAbsentAtomically(anyLong(), anyList());
    }

    @Test
    void invalidCoordinatesMakeNoPersistenceCall() {
        ActivityDataAccess activityDataAccess = mock(ActivityDataAccess.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        ActivityStravaStreamService service = new ActivityStravaStreamService(
                activityDataAccess,
                activityRepository,
                runnerRepository,
                secretEncryptionService,
                restTemplate
        );

        Activity activity = new Activity();
        activity.setId(19L);
        List<List<?>> invalidLatlng = List.of(
                List.of(Double.NaN, -74d),
                List.of(91d, -74d),
                List.of(40d, 181d),
                List.of("40", -74d)
        );
        when(restTemplate.exchange(
                anyString(),
                eq(HttpMethod.GET),
                anyHttpEntity(),
                anyTypeRef()
        )).thenReturn(ResponseEntity.ok(List.of(Map.of("type", "latlng", "data", invalidLatlng))));

        service.fetchAndCacheStravaStream(activity, "strava-19", "access-token");

        verify(activityDataAccess, never()).savePointsIfAbsentAtomically(anyLong(), anyList());
        verify(activityDataAccess, never()).savePoints(anyList());
    }
}
