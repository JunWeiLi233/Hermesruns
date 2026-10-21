package com.hermes.backend.runner;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityDeletionHook;
import com.hermes.backend.activity.ActivityPoint;
import jakarta.persistence.EntityManager;
import jakarta.persistence.metamodel.Attribute;
import jakarta.persistence.metamodel.EntityType;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.hibernate.annotations.OnDelete;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Structural guards for deleting data. They read the real entity model, so a new table that points at
 * a runner or at a run cannot be added without also deciding how it is deleted. Each of these used to be
 * a way for "delete this run" or "delete my account" to fail, or to leave data behind, unnoticed.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:data-lifecycle-coverage;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class DataLifecycleCoverageTests {

    /**
     * Entities that keep a runner id on purpose after the account is gone, with the reason. Everything
     * else that stores a runner id as a plain number has to be deleted by a purger.
     */
    private static final Map<String, String> RETAINED_RUNNER_REFERENCES = Map.of(
            "AdminAuditLog", "security audit trail: who did what must outlive the account",
            "AdminBackgroundJob", "operations log of jobs an administrator started",
            "RunnerAdminNote.authorRunnerId", "the author is an administrator, not the runner being written about"
    );

    @Autowired private EntityManager em;
    @Autowired private List<RunnerDataPurger> purgers;
    @Autowired private List<ActivityDeletionHook> hooks;
    @Autowired private PlatformTransactionManager transactionManager;

    private List<EntityType<?>> entitiesOtherThan(Class<?>... excluded) {
        Set<Class<?>> skip = Set.of(excluded);
        return em.getMetamodel().getEntities().stream()
                .filter(entity -> !skip.contains(entity.getJavaType()))
                .collect(Collectors.toList());
    }

    @Test
    void everyEntityThatPointsAtARunnerIsDeletedByAPurger() {
        Set<String> owners = new TreeSet<>();
        for (EntityType<?> entity : entitiesOtherThan(Runner.class)) {
            for (Attribute<?, ?> attribute : entity.getAttributes()) {
                if (attribute.getJavaType() == Runner.class) {
                    owners.add(entity.getJavaType().getSimpleName());
                }
            }
        }
        Set<String> covered = purgers.stream()
                .flatMap(purger -> purger.entities().stream())
                .map(Class::getSimpleName)
                .collect(Collectors.toSet());

        assertThat(owners).as("entities with a foreign key to Runner").isNotEmpty();
        assertThat(covered).as("entities a RunnerDataPurger deletes; add a purger (or list the entity in one)")
                .containsAll(owners);
    }

    @Test
    void everyRunnerIdStoredAsAPlainNumberIsEitherDeletedOrRetainedOnPurpose() {
        List<String> unaccounted = new ArrayList<>();
        Set<String> covered = purgers.stream()
                .flatMap(purger -> purger.entities().stream())
                .map(Class::getSimpleName)
                .collect(Collectors.toSet());
        for (EntityType<?> entity : entitiesOtherThan(Runner.class)) {
            String entityName = entity.getJavaType().getSimpleName();
            for (Attribute<?, ?> attribute : entity.getAttributes()) {
                boolean plainRunnerId = attribute.getJavaType() == Long.class
                        && attribute.getName().toLowerCase().contains("runnerid");
                if (!plainRunnerId) {
                    continue;
                }
                boolean accounted = covered.contains(entityName)
                        || RETAINED_RUNNER_REFERENCES.containsKey(entityName)
                        || RETAINED_RUNNER_REFERENCES.containsKey(entityName + "." + attribute.getName());
                if (!accounted) {
                    unaccounted.add(entityName + "." + attribute.getName());
                }
            }
        }
        assertThat(unaccounted)
                .as("runner ids stored without a foreign key: delete them in a purger, or retain them on purpose with a reason")
                .isEmpty();
    }

    @Test
    void theRetainedListOnlyNamesThingsThatStillExist() {
        // A stale entry would quietly excuse a column that is gone, or one that now needs a purger.
        Set<String> known = new TreeSet<>();
        for (EntityType<?> entity : entitiesOtherThan(Runner.class)) {
            known.add(entity.getJavaType().getSimpleName());
            for (Attribute<?, ?> attribute : entity.getAttributes()) {
                known.add(entity.getJavaType().getSimpleName() + "." + attribute.getName());
            }
        }
        assertThat(known).containsAll(RETAINED_RUNNER_REFERENCES.keySet());
    }

    @Test
    void everyPurgerStatementIsValid() {
        // Runs each purger for a runner that does not exist. That executes every bulk statement, so a
        // mistyped entity or a missing "runner" attribute fails here instead of during a real deletion.
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            purgers.forEach(purger -> purger.purge(-1L));
            status.setRollbackOnly();
        });
    }

    @Test
    void purgersRunInAnOrderThatRespectsTheirForeignKeys() {
        List<String> order = purgers.stream()
                .sorted(java.util.Comparator.comparingInt(RunnerDataPurger::order))
                .flatMap(purger -> purger.entities().stream())
                .map(Class::getSimpleName)
                .toList();

        // Drops point at activities and shoes; activities point at shoes; so drops, then activities, then shoes.
        assertThat(order.indexOf("DigitalCosmeticDrop")).isLessThan(order.indexOf("Activity"));
        assertThat(order.indexOf("Activity")).isLessThan(order.indexOf("Shoe"));
    }

    @Test
    void everyEntityThatPointsAtAnActivityIsHandledWhenTheActivityIsDeleted() {
        Set<Class<?>> hookEntities = hooks.stream().map(ActivityDeletionHook::entity).collect(Collectors.toSet());
        List<String> unhandled = new ArrayList<>();
        for (EntityType<?> entity : entitiesOtherThan(Activity.class, ActivityPoint.class)) {
            for (Attribute<?, ?> attribute : entity.getAttributes()) {
                if (attribute.getJavaType() != Activity.class) {
                    continue;
                }
                boolean cascadesInTheDatabase = attribute.getJavaMember() instanceof Field field
                        && field.isAnnotationPresent(OnDelete.class);
                if (!cascadesInTheDatabase && !hookEntities.contains(entity.getJavaType())) {
                    unhandled.add(entity.getJavaType().getSimpleName() + "." + attribute.getName());
                }
            }
        }
        assertThat(unhandled)
                .as("entities with a foreign key to Activity need an ActivityDeletionHook (or @OnDelete); "
                        + "otherwise deleting that run fails")
                .isEmpty();
    }
}
