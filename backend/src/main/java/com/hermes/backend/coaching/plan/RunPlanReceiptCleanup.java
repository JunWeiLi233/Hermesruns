package com.hermes.backend.coaching.plan;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class RunPlanReceiptCleanup {
    @PersistenceContext EntityManager em;
    @Scheduled(fixedDelay=3600000,initialDelay=3600000) @Transactional
    // Activation receipts retain rules, release mode and acknowledgement until account erasure.
    // Other command receipts remain short-lived idempotency records.
    public void expire(){var ids=em.createQuery("select r.id from PlanCommand r where r.operation<>'ACTIVATE' and r.expiresAt<:now order by r.expiresAt",UUID.class).setParameter("now",Instant.now()).setMaxResults(500).getResultList();if(!ids.isEmpty())em.createQuery("delete from PlanCommand r where r.id in :ids").setParameter("ids",ids).executeUpdate();}
}
