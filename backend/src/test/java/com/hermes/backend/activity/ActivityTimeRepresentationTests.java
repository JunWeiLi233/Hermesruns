package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import java.time.LocalDateTime;
import java.util.Map;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class ActivityTimeRepresentationTests {
    private Activity run(String utc, boolean strava) {
        Runner runner = new Runner();
        runner.setTimeZone("America/New_York");
        Activity activity = new Activity();
        activity.setRunner(runner);
        activity.setStartTime(LocalDateTime.parse(utc));
        activity.setStartDate(utc);
        activity.setStravaApiSourced(strava);
        activity.setDistanceKm(1.0);
        return activity;
    }

    @Test void fileFeedKeepsHistoryAndAddsUnambiguousInstantAndAccountDate() {
        Activity activity = run("2026-10-05T03:55:00", false);
        Map<String, Object> body = ActivityRoutePreviewHelper.toRunFeedItem(activity);
        assertThat(String.valueOf(body.get("activityInstant"))).isEqualTo("2026-10-05T03:55:00Z");
        assertThat(String.valueOf(body.get("accountLocalDate"))).isEqualTo("2026-10-04");
        assertThat(String.valueOf(body.get("accountLocalTime"))).isEqualTo("23:55");
        assertThat(body.get("timeRepresentation")).isEqualTo("UTC_INSTANT");
        assertThat(activity.getStartTime()).isEqualTo(LocalDateTime.parse("2026-10-05T03:55:00"));
        assertThat(body.get("startTime")).isEqualTo(activity.getStartTime());
        assertThat(body.get("distanceKm")).isEqualTo(1.0);
    }

    @Test void fileFeedUsesBothSidesOfDstTransitions() {
        String[][] samples = {{"2026-03-08T06:55:00", "01:55"}, {"2026-03-08T07:05:00", "03:05"}, {"2025-11-02T05:55:00", "01:55"}, {"2025-11-02T06:05:00", "01:05"}};
        for (String[] sample : samples) {
            Map<String, Object> body = ActivityRoutePreviewHelper.toRunFeedItem(run(sample[0], false));
            assertThat(String.valueOf(body.get("accountLocalTime"))).isEqualTo(sample[1]);
        }
    }

    @Test void stravaWallTimeDoesNotInventAnInstantOrShiftStoredClock() {
        Map<String, Object> body = ActivityRoutePreviewHelper.toRunFeedItem(run("2026-10-05T03:55:00", true));
        assertThat(body).containsKey("activityInstant");
        assertThat(body.get("activityInstant")).isNull();
        assertThat(body.get("timeRepresentation")).isEqualTo("STRAVA_LOCAL_WALL_TIME");
        assertThat(String.valueOf(body.get("accountLocalDate"))).isEqualTo("2026-10-05");
        assertThat(String.valueOf(body.get("accountLocalTime"))).isEqualTo("03:55");
    }
}
