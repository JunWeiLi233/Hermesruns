package com.hermes.backend.imports;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:garmin-watermark-tests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver"
})
@Transactional
class GarminWellnessWatermarkTests {
    @Autowired private RunnerRepository runners;
    @Autowired private EntityManager entityManager;

    @Test
    void watermarkUpdatePreservesFreshProviderTokenAndDoesNotMoveBackwards() {
        Runner stale = new Runner();
        stale.setEmail("watermark@example.test");
        stale.setStravaRefreshToken("test-old-token");
        runners.saveAndFlush(stale);
        entityManager.clear();
        Runner refreshed = runners.findById(stale.getId()).orElseThrow();
        refreshed.setStravaRefreshToken("test-refreshed-token");
        runners.saveAndFlush(refreshed);
        entityManager.clear();

        LocalDateTime completed = LocalDateTime.of(2026, 9, 4, 12, 0);
        assertThat(runners.recordGarminWellnessSyncSuccess(stale.getId(), completed)).isEqualTo(1);
        assertThat(runners.recordGarminWellnessSyncSuccess(stale.getId(), completed.minusDays(1))).isZero();
        Runner actual = runners.findById(stale.getId()).orElseThrow();
        assertThat(actual.getStravaRefreshToken()).isEqualTo("test-refreshed-token");
        assertThat(actual.getGarminWellnessLastSyncedAt()).isEqualTo(completed);
    }
}
