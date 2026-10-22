package com.hermes.backend.runner;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityBestEffort;
import com.hermes.backend.activity.ActivityBestEffortRepository;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PersonalRecordServiceTest {

    private final ActivityRepository activityRepository = mock(ActivityRepository.class);
    private final ActivityBestEffortRepository bestEfforts = mock(ActivityBestEffortRepository.class);
    private final PersonalRecordService service = new PersonalRecordService(activityRepository, bestEfforts);
    private final Runner runner = runner(7L);

    @Test
    void theDistanceRecordsAreTheBestEffortsStoredForEachRunsAndNoPointsAreRead() {
        Activity fastFiveKm = run(2L, "Fast 5K", 5.0, 1740, LocalDateTime.of(2026, 4, 2, 7, 0));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of(fastFiveKm));
        ActivityBestEffort oneKmEffort = effort(fastFiveKm, 330.4, false);
        ActivityBestEffort fiveKmEffort = effort(fastFiveKm, 1740.0, false);
        when(bestEfforts.findRanked(eq(7L), eq("1km"), any())).thenReturn(List.of(oneKmEffort));
        when(bestEfforts.findRanked(eq(7L), eq("5km"), any())).thenReturn(List.of(fiveKmEffort));

        PersonalRecordService.PersonalRecordsResponse response = service.buildForRunner(runner);

        PersonalRecordService.DistanceRecord oneKm = response.records().get("1km");
        assertThat(oneKm.elapsedSeconds()).isEqualTo(330);
        assertThat(oneKm.paceSecondsPerKm()).isEqualTo(330.4);
        assertThat(oneKm.activityId()).isEqualTo(2L);
        assertThat(oneKm.sourceRunName()).isEqualTo("Fast 5K");
        assertThat(oneKm.sourceDistanceKm()).isEqualTo(5.0);
        assertThat(oneKm.recordedAt()).isEqualTo("2026-04-02T07:00");
        assertThat(oneKm.targetDistanceKm()).isEqualTo(1.0);
        assertThat(oneKm.derivedFromSegment()).isTrue();
        assertThat(response.records().get("5km").elapsedSeconds()).isEqualTo(1740);
    }

    @Test
    void anEstimatedEffortIsNotMarkedAsMeasuredFromASegment() {
        Activity run = run(3L, "No stream", 5.2, 1560, LocalDateTime.of(2026, 4, 3, 7, 0));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of(run));
        ActivityBestEffort estimate = effort(run, 1500.0, true);
        when(bestEfforts.findRanked(eq(7L), eq("5km"), any())).thenReturn(List.of(estimate));

        assertThat(service.buildForRunner(runner).records().get("5km").derivedFromSegment()).isFalse();
    }

    @Test
    void aDistanceWithNoEffortHasNoRecord() {
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of());
        when(bestEfforts.findRanked(any(), any(), any())).thenReturn(List.of());

        assertThat(service.buildForRunner(runner).records()).isEmpty();
    }

    @Test
    void theSixDistancesTheProfilePageCelebratesKeepTheirKeysAndLengths() {
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of());

        List<PersonalRecordService.DistanceDefinition> distances = service.buildForRunner(runner).distances();

        assertThat(distances).extracting(PersonalRecordService.DistanceDefinition::key)
                .containsExactly("1km", "3km", "5km", "10km", "half", "marathon");
        assertThat(distances).extracting(PersonalRecordService.DistanceDefinition::distanceKm)
                .containsExactly(1.0, 3.0, 5.0, 10.0, 21.0975, 42.195);
    }

    @Test
    void theLongestRunTheFastestPaceAndTheMostClimbingStillComeFromTheRuns() {
        Activity longest = run(1L, "Long", 21.0, 6300, LocalDateTime.of(2026, 3, 1, 7, 0));
        Activity quickest = run(2L, "Quick", 5.0, 1250, LocalDateTime.of(2026, 3, 2, 7, 0));
        Activity hilly = run(3L, "Hilly", 8.0, 2800, LocalDateTime.of(2026, 3, 3, 7, 0));
        hilly.setTotalElevationGain(640.0);
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of(hilly, quickest, longest));
        when(bestEfforts.findRanked(any(), any(), any())).thenReturn(List.of());

        PersonalRecordService.PersonalRecordsResponse response = service.buildForRunner(runner);

        assertThat(response.longestRun().activityId()).isEqualTo(1L);
        assertThat(response.fastestPace().activityId()).isEqualTo(2L);
        assertThat(response.fastestPace().primaryValue()).isEqualTo(250.0);
        assertThat(response.mostElevation().activityId()).isEqualTo(3L);
    }

    @Test
    void theAnswerIsKeptUntilItIsEvicted() {
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of());
        when(bestEfforts.findRanked(any(), any(), any())).thenReturn(List.of());

        service.buildForRunner(runner);
        service.buildForRunner(runner);

        verify(activityRepository, times(1)).findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN);
        verify(bestEfforts, times(6)).findRanked(eq(7L), any(), any());
    }

    private static Runner runner(Long id) {
        Runner runner = new Runner();
        runner.setId(id);
        return runner;
    }

    private static ActivityBestEffort effort(Activity run, double effectiveSeconds, boolean estimated) {
        ActivityBestEffort effort = mock(ActivityBestEffort.class);
        when(effort.getActivity()).thenReturn(run);
        when(effort.getEffectiveSeconds()).thenReturn(effectiveSeconds);
        when(effort.isEstimated()).thenReturn(estimated);
        return effort;
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
}
