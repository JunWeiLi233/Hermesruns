package com.hermes.backend.entertainment;

import com.hermes.backend.runner.*;
import jakarta.persistence.*;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
class EntertainmentRunnerDataPurger implements RunnerDataPurger {
    @PersistenceContext private EntityManager em;
    private final RunnerRepository runners;
    private final EntertainmentService service;
    EntertainmentRunnerDataPurger(RunnerRepository runners,EntertainmentService service) { this.runners=runners; this.service=service; }
    public int order() { return 14; }
    public Set<Class<?>> entities() {
        return Set.of(EntertainmentPreferences.class,EntertainmentMemory.class,EntertainmentMission.class,EntertainmentReceipt.class,
            EntertainmentGroup.class,EntertainmentMember.class,EntertainmentSlot.class,EntertainmentInvite.class);
    }
    public void purge(Long runnerId) {
        // AccountDeletionService invokes inside its transaction; same first lock as every feature command.
        if(runners.findByIdForUpdate(runnerId).isEmpty()) return;
        List<String> affected=em.createQuery("""
            select distinct g.id from EntertainmentGroup g
            where g.runner.id=:owner
               or g.id in (select m.mosaic.id from EntertainmentMember m where m.runner.id=:owner)
               or g.id in (select i.mosaic.id from EntertainmentInvite i where i.recipientAccountId=:recipient)
            order by g.id
            """,String.class).setParameter("owner",runnerId).setParameter("recipient",runnerId.toString()).getResultList();
        for(String id:affected) {
            EntertainmentGroup g=service.existingLockedGroup(id);
            if(g==null) continue; // Concurrent owner deletion already removed all children.
            if(g.runner.getId().equals(runnerId)) service.eraseGroup(g);
            else {
                service.clearMember(id,runnerId);
                g.revision++; g.lastRequestId=null;
            }
        }
        em.flush();
        RunnerRows.deleteAll(em,runnerId,List.of(EntertainmentReceipt.class,EntertainmentMemory.class,EntertainmentMission.class,EntertainmentPreferences.class));
    }
}
