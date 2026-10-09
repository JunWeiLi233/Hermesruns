package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A run whose every metric column is NULL loads with {@code metrics == null}: Hibernate does not build
 * an embedded object for all-null columns. That used to throw from every getter.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:activity-metric-fields;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class ActivityMetricFieldsTests {

    @Autowired private ActivityRepository activities;
    @Autowired private RunnerRepository runners;

    @Test
    void everyGetterAnswersNullWhenThereAreNoMetrics() {
        Activity run = new Activity();
        ReflectionTestUtils.setField(run, "metrics", null);

        assertThat(run.getAverageHeartRate()).isNull();
        assertThat(run.getMaxHeartRate()).isNull();
        assertThat(run.getTotalElevationGain()).isNull();
        assertThat(run.getCalories()).isNull();
        assertThat(run.getAverageCadence()).isNull();
        assertThat(run.getAverageWatts()).isNull();
        assertThat(run.getMaxSpeedMps()).isNull();
        assertThat(run.getSufferScore()).isNull();
        assertThat(run.getRoutePreviewPath()).isNull();
        assertThat(run.getRoutePreviewStartX()).isNull();
        assertThat(run.getRoutePreviewStartY()).isNull();
        assertThat(run.getRoutePreviewFinishX()).isNull();
        assertThat(run.getRoutePreviewFinishY()).isNull();
        assertThat(run.getPacePenaltySecPerKm()).isNull();
        assertThat(run.getWeatherAdjusted()).isNull();
    }

    @Test
    void aSetterCreatesTheMetricsWhenThereAreNone() {
        Activity run = new Activity();
        ReflectionTestUtils.setField(run, "metrics", null);

        run.setAverageHeartRate(151.0);
        run.setWeatherAdjusted(true);

        assertThat(run.getAverageHeartRate()).isEqualTo(151.0);
        assertThat(run.getWeatherAdjusted()).isTrue();
        assertThat(run.getMaxHeartRate()).isNull();
    }

    @Test
    void aRunSavedWithNoMetricsReloadsWithoutThrowingAndCanStillBeUpdated() {
        Runner owner = runners.saveAndFlush(new Runner("metrics-" + UUID.randomUUID() + "@hermes.test", "active"));
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("no sensors");
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setDistanceKm(5);
        Long id = activities.saveAndFlush(run).getId();

        Activity reloaded = activities.findById(id).orElseThrow();
        assertThat(reloaded.getAverageHeartRate()).isNull();
        assertThat(reloaded.getWeatherAdjusted()).isNull();

        reloaded.setAverageHeartRate(148.0);
        activities.saveAndFlush(reloaded);
        assertThat(activities.findById(id).orElseThrow().getAverageHeartRate()).isEqualTo(148.0);
    }
}
