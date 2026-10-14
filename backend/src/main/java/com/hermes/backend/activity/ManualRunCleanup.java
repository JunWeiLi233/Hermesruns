package com.hermes.backend.activity;

import com.hermes.backend.runner.RunnerDataPurger;
import java.util.Collection;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
class ManualRunCleanup implements ActivityDeletionHook,RunnerDataPurger {
    private final ManualRunReceiptRepository receipts;
    ManualRunCleanup(ManualRunReceiptRepository receipts){this.receipts=receipts;}
    public Class<?> entity(){return ManualRunReceipt.class;}
    public void beforeActivitiesDeleted(Collection<Long> ids){if(ids!=null&&!ids.isEmpty())receipts.markDeleted(ids);}
    public int order(){return 5;}
    public Set<Class<?>> entities(){return Set.of(ManualRunReceipt.class);}
    public void purge(Long runnerId){receipts.deleteByOwner(runnerId);}
}
