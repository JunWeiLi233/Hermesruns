package com.hermes.backend.runner;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityPoint;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.DeletedActivityTombstone;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.admin.RunnerAdminNote;
import com.hermes.backend.coaching.CoachFeedbackAlert;
import com.hermes.backend.coaching.CoachRunnerState;
import com.hermes.backend.coaching.SorenessLog;
import com.hermes.backend.imports.StravaTokenService;
import com.hermes.backend.races.RaceEvent;
import com.hermes.backend.rewards.DigitalCosmeticDrop;
import com.hermes.backend.rewards.DigitalCosmeticTier;
import com.hermes.backend.routing.PlannedRoute;
import com.hermes.backend.shoes.Shoe;
import com.hermes.backend.shoes.ShoeImageAsset;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Deleting an account against a real schema: all of it goes, and only that runner's. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:account-deletion-integration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class AccountDeletionIntegrationTests {

    private static final List<Class<?>> OWNED = List.of(
            Activity.class, DigitalCosmeticDrop.class, Shoe.class, CoachFeedbackAlert.class, CoachRunnerState.class,
            SorenessLog.class, RaceEvent.class, PlannedRoute.class, RunnerAdminNote.class, DeletedActivityTombstone.class);

    @Autowired private AccountDeletionService deletion;
    @Autowired private RunnerRepository runners;
    @Autowired private EntityManager em;
    @Autowired private PlatformTransactionManager transactionManager;
    @MockitoBean private StravaTokenService tokenService;

    private TransactionTemplate tx;

    @BeforeEach
    void setUp() {
        tx = new TransactionTemplate(transactionManager);
    }

    private Runner runner() {
        return runners.saveAndFlush(new Runner("delete-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    /** One row of everything a runner can own, wired together the way the app wires it. */
    private String buildGraph(Runner owner) {
        String imageKey = "image-" + UUID.randomUUID();
        tx.executeWithoutResult(status -> {
            Shoe shoe = new Shoe();
            shoe.setRunner(owner);
            shoe.setBrand("Nike");
            shoe.setModel("Pegasus");
            em.persist(shoe);

            ShoeImageAsset asset = new ShoeImageAsset();
            asset.setIdentityKey(imageKey);
            asset.setRunner(owner);
            em.persist(asset);

            Activity run = new Activity();
            run.setRunner(owner);
            run.setShoe(shoe);
            run.setName("a run");
            run.setActivityType(ActivityType.RUN);
            run.setProvider(ImportProvider.GARMIN);
            run.setDistanceKm(5);
            em.persist(run);

            ActivityPoint point = new ActivityPoint();
            point.setActivity(run);
            point.setSequenceIndex(0);
            point.setLatitude(40);
            point.setLongitude(-73);
            em.persist(point);

            DigitalCosmeticDrop drop = new DigitalCosmeticDrop();
            drop.setRunner(owner);
            drop.setActivity(run);
            drop.setShoe(shoe);
            drop.setTier(DigitalCosmeticTier.MIL_SPEC);
            em.persist(drop);

            CoachFeedbackAlert alert = new CoachFeedbackAlert();
            alert.setRunner(owner);
            alert.setAlertType("LOAD");
            alert.setMessage("easy day");
            alert.setCreatedAt(LocalDateTime.now());
            alert.setDismissed(false);
            alert.setRelatedActivity(run);
            em.persist(alert);

            CoachRunnerState state = new CoachRunnerState();
            state.setRunner(owner);
            em.persist(state);

            SorenessLog soreness = new SorenessLog();
            soreness.setRunner(owner);
            soreness.setDate(LocalDate.now());
            soreness.setLevel("LOW");
            soreness.setCreatedAt(LocalDateTime.now());
            em.persist(soreness);

            RaceEvent race = new RaceEvent();
            race.setRunner(owner);
            race.setName("A race");
            race.setEventDate(LocalDate.now().plusDays(30));
            em.persist(race);

            PlannedRoute route = new PlannedRoute();
            route.setRunner(owner);
            route.setStartLat(40.0);
            route.setStartLng(-73.0);
            route.setTargetDistanceKm(5.0);
            route.setElevationPreference("flat");
            route.setWaypoints("[]");
            route.setActualDistanceKm(5.0);
            route.setElevationGainMeters(10.0);
            route.setEstimatedTimeMinutes(30);
            route.setCreatedAt(LocalDateTime.now());
            em.persist(route);

            RunnerAdminNote note = new RunnerAdminNote();
            note.setRunner(owner);
            note.setNoteText("note about this runner");
            em.persist(note);

            em.persist(new DeletedActivityTombstone(owner, "STRAVA", "ext-" + UUID.randomUUID()));
        });
        return imageKey;
    }

    private long count(Class<?> entity, Long runnerId) {
        String name = em.getMetamodel().entity(entity).getName();
        return em.createQuery("select count(e) from " + name + " e where e.runner.id = :id", Long.class)
                .setParameter("id", runnerId)
                .getSingleResult();
    }

    private long points(Long runnerId) {
        return em.createQuery("select count(p) from ActivityPoint p where p.activity.runner.id = :id", Long.class)
                .setParameter("id", runnerId)
                .getSingleResult();
    }

    @Test
    void deletesEverythingTheRunnerOwnsAndNothingElse() {
        Runner doomed = runner();
        Runner bystander = runner();
        String doomedImage = buildGraph(doomed);
        buildGraph(bystander);
        for (Class<?> entity : OWNED) {
            assertThat(count(entity, doomed.getId())).as("setup: " + entity.getSimpleName()).isEqualTo(1);
        }

        deletion.deleteAccount(doomed.getId());

        assertThat(runners.findById(doomed.getId())).as("the runner row").isEmpty();
        for (Class<?> entity : OWNED) {
            assertThat(count(entity, doomed.getId())).as(entity.getSimpleName() + " of the deleted runner").isZero();
            assertThat(count(entity, bystander.getId())).as(entity.getSimpleName() + " of the other runner").isEqualTo(1);
        }
        assertThat(points(doomed.getId())).isZero();
        assertThat(points(bystander.getId())).isEqualTo(1);
        assertThat(runners.findById(bystander.getId())).isPresent();

        // The catalogue image is shared, so it stays and only loses the link to the deleted runner.
        Long imageOwners = em.createQuery("select count(a) from ShoeImageAsset a where a.identityKey = :key and a.runner is null", Long.class)
                .setParameter("key", doomedImage).getSingleResult();
        assertThat(imageOwners).isEqualTo(1);
    }

    @Test
    void disconnectsStravaFirstSoStravaIsToldToRevokeAccess() {
        Runner owner = runner();
        when(tokenService.isRunnerStravaLinked(any())).thenReturn(true);
        when(tokenService.revokeAtStrava(any())).thenReturn(true);

        deletion.deleteAccount(owner.getId());

        verify(tokenService).revokeAtStrava(any());
        assertThat(runners.findById(owner.getId())).isEmpty();
    }

    @Test
    void doesNotCallStravaForARunnerWhoNeverLinkedIt() {
        Runner owner = runner();
        when(tokenService.isRunnerStravaLinked(any())).thenReturn(false);

        deletion.deleteAccount(owner.getId());

        verify(tokenService, never()).revokeAtStrava(any());
        assertThat(runners.findById(owner.getId())).isEmpty();
    }

    @Test
    void aRunnerWhoIsAlreadyGoneIsANoOp() {
        deletion.deleteAccount(-5L);
        deletion.deleteAccount(null);

        Runner owner = runner();
        deletion.deleteAccount(owner.getId());
        deletion.deleteAccount(owner.getId());
        assertThat(runners.findById(owner.getId())).isEmpty();
    }
}
