package com.hermes.backend.explorer;

import com.hermes.backend.activity.*;
import com.hermes.backend.runner.RunnerDataPurger;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Canonical edits fail closed: stale derived geometry/statistics are removed in the same write. */
@Component
@ConditionalOnProperty(name="app.explorer.enabled",havingValue="true")
public class ExplorerInvalidation implements ActivityDeletionHook,ActivityMutationHook,RunnerDataPurger {
    private final ExplorerStore store;
    public ExplorerInvalidation(ExplorerStore store){this.store=store;}
    public int order(){return 5;}
    public Set<Class<?>> entities(){return Set.of();} // Extension uses JDBC, not a second set of canonical JPA entities.
    public Class<?> entity(){return Activity.class;}
    public void purge(Long runnerId){store.jdbc().update("DELETE FROM statshunters.account_profiles WHERE runner_id=?",runnerId);}
    public void beforeActivityChanged(Long id){beforeActivitiesDeleted(List.of(id));}
    @org.springframework.context.event.EventListener
    public void ingested(ActivityIngestedEvent event){bumpCanonical(event.runnerId());}
    @org.springframework.context.event.EventListener
    public void pointsStored(ActivityPointsStoredEvent event){bumpCanonical(event.runnerId());}
    @org.springframework.context.event.EventListener
    public void edited(ActivityEditedEvent event){bumpCanonical(event.runnerId());}
    private void bumpCanonical(Long runner){store.jdbc().update("UPDATE statshunters.account_profiles SET dataset_revision=dataset_revision+1 WHERE runner_id=?",runner);}
    public void beforeActivitiesDeleted(Collection<Long> ids) {
        if(ids.isEmpty())return;
        Map<String,Object> args=Map.of("ids",ids);
        store.named().update("UPDATE statshunters.account_profiles SET dataset_revision=dataset_revision+1 WHERE runner_id IN (SELECT runner_id FROM public.activities WHERE id IN (:ids))",args);
        store.named().update("DELETE FROM statshunters.activity_facts WHERE legacy_activity_id IN (:ids)",args);
    }
}
