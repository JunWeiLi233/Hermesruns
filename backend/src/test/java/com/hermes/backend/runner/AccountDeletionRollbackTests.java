package com.hermes.backend.runner;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Deleting an account is all or nothing. A purger that fails part-way (here a deliberately broken one that
 * runs last) must roll back everything the earlier purgers and the runner delete did.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:account-deletion-rollback;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@Import(AccountDeletionRollbackTests.BrokenPurgerConfig.class)
class AccountDeletionRollbackTests {

    @TestConfiguration
    static class BrokenPurgerConfig {
        @Bean
        RunnerDataPurger brokenPurger() {
            return new RunnerDataPurger() {
                @Override
                public int order() {
                    return Integer.MAX_VALUE;
                }

                @Override
                public Set<Class<?>> entities() {
                    return Set.of();
                }

                @Override
                public void purge(Long runnerId) {
                    throw new IllegalStateException("simulated failure after the other purgers ran");
                }
            };
        }
    }

    @Autowired private AccountDeletionService deletion;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;

    @Test
    void aFailureRollsBackEverythingSoNothingIsHalfDeleted() {
        Runner owner = runners.saveAndFlush(new Runner("rollback-" + UUID.randomUUID() + "@hermes.test", "active"));
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("must survive");
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setDistanceKm(5);
        Activity saved = activities.saveAndFlush(run);

        assertThatThrownBy(() -> deletion.deleteAccount(owner.getId()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("simulated failure");

        assertThat(runners.findById(owner.getId())).as("the runner is still there").isPresent();
        assertThat(activities.findById(saved.getId())).as("the activity purger's work was rolled back").isPresent();
    }
}
