package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerDataPurger;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/** All of a runner's activities, their GPS points, and the tombstones of runs they deleted. */
@Component
class ActivityRunnerDataPurger implements RunnerDataPurger {

    private static final Set<Class<?>> OWNED = Set.of(Activity.class, DeletedActivityTombstone.class);

    private final ActivityRepository activities;
    private final ActivityDataAccess activityDataAccess;
    private final DeletedActivityTombstoneRepository tombstones;

    @PersistenceContext
    private EntityManager em;

    ActivityRunnerDataPurger(ActivityRepository activities,
                             ActivityDataAccess activityDataAccess,
                             DeletedActivityTombstoneRepository tombstones) {
        this.activities = activities;
        this.activityDataAccess = activityDataAccess;
        this.tombstones = tombstones;
    }

    @Override
    public int order() {
        return 20;
    }

    @Override
    public Set<Class<?>> entities() {
        return OWNED;
    }

    @Override
    public void purge(Long runnerId) {
        Runner runner = em.getReference(Runner.class, runnerId);
        List<Long> ids = activities.findAllIdsByRunner(runner);
        activityDataAccess.purgeActivities(runner, ids);
        tombstones.deleteAllByRunner(runner);
    }
}
