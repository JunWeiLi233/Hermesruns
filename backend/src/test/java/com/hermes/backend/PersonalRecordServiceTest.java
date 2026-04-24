package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PersonalRecordServiceTest {

    @Test
    void usesFastestSegmentFromLongerRunForDistanceRecords() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        PersonalRecordService service = new PersonalRecordService(activityRepository, activityPointRepository);

        Runner runner = new Runner();

        Activity standaloneOneKm = run(1L, "Standalone 1K", 1.0, 360, LocalDateTime.of(2026, 4, 1, 7, 0));
        Activity fastFiveKm = run(2L, "Fast 5K", 5.0, 1740, LocalDateTime.of(2026, 4, 2, 7, 0));

        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN))
                .thenReturn(List.of(fastFiveKm, standaloneOneKm));

        when(activityPointRepository.findAnalyticsSamplesByActivityIdOrdered(eq(1L)))
                .thenReturn(List.of(
                        sample(0, 0),
                        sample(360, 1000)
                ));

        when(activityPointRepository.findAnalyticsSamplesByActivityIdOrdered(eq(2L)))
                .thenReturn(List.of(
                        sample(0, 0),
                        sample(330, 1000),
                        sample(690, 2000),
                        sample(1050, 3000),
                        sample(1400, 4000),
                        sample(1740, 5000)
                ));

        PersonalRecordService.PersonalRecordsResponse response = service.buildForRunner(runner);
        PersonalRecordService.DistanceRecord oneKmRecord = response.records().get("1km");

        assertNotNull(oneKmRecord);
        assertEquals(330, oneKmRecord.elapsedSeconds());
        assertEquals(2L, oneKmRecord.activityId());
        assertEquals("Fast 5K", oneKmRecord.sourceRunName());
        assertEquals(5.0, oneKmRecord.sourceDistanceKm(), 0.0001);
    }

    private static Activity run(Long id, String name, double distanceKm, int movingSeconds, LocalDateTime startTime) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setName(name);
        activity.setActivityType(ActivityType.RUN);
        activity.setDistanceKm(distanceKm);
        activity.setDistanceMeters(distanceKm * 1000.0);
        activity.setMovingTimeSeconds(movingSeconds);
        activity.setStartTime(startTime);
        return activity;
    }

    private static Object[] sample(double elapsedSeconds, double distanceMeters) {
        return new Object[] {0.0, 0.0, elapsedSeconds, distanceMeters, null, null, null, null, null};
    }
}
