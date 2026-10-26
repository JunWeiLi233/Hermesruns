package com.hermes.backend.story;

import com.hermes.backend.runner.RunnerDataPurger;
import com.hermes.backend.runner.RunnerRows;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
class StoryRunnerDataPurger implements RunnerDataPurger {
    private static final Set<Class<?>> OWNED = Set.of(StoryPreferences.class, StoryChapterProgress.class);
    @PersistenceContext private EntityManager em;
    @Override public int order() { return 15; }
    @Override public Set<Class<?>> entities() { return OWNED; }
    @Override public void purge(Long runnerId) { RunnerRows.deleteAll(em, runnerId, OWNED); }
}
