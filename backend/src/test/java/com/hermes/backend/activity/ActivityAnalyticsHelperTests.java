package com.hermes.backend.activity;

import com.hermes.backend.activity.ActivityAnalyticsHelper.SamplePoint;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ActivityAnalyticsHelperTests {

    private static SamplePoint point(Integer cadence) {
        return new SamplePoint(40.78, -73.96, 0, 0.0, 20.0, null, cadence, null, null);
    }

    @Test
    void averageCadenceIsTheMeanOfTheSamplesThatCarryCadence() {
        List<SamplePoint> points = List.of(point(80), point(90), point(null), point(0), point(100));

        assertThat(ActivityAnalyticsHelper.averageCadence(points, new Activity())).isEqualTo(90.0);
    }

    @Test
    void averageCadenceFallsBackToWhatTheDeviceReportedForTheRun() {
        Activity activity = new Activity();
        activity.setAverageCadence(84.0);

        assertThat(ActivityAnalyticsHelper.averageCadence(List.of(point(null), point(null)), activity)).isEqualTo(84.0);
    }

    @Test
    void aRunWithNoCadenceAnywhereHasNoAverageCadenceInsteadOfFailing() {
        // A run without a cadence sensor, such as a phone-only GPX file, has neither samples nor a device average.
        // Choosing between a primitive and a null Double in one expression used to unbox the null and throw, which
        // turned GET /api/activities/{id}/analytics into a 500 for every such run.
        assertThat(ActivityAnalyticsHelper.averageCadence(List.of(point(null), point(0)), new Activity())).isNull();
        assertThat(ActivityAnalyticsHelper.averageCadence(List.of(), new Activity())).isNull();
    }
}
