package com.hermes.backend.activity;
import com.hermes.backend.runner.*;
import jakarta.persistence.*;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
class ManualRunExport implements RunnerDataExportContributor {
    @PersistenceContext EntityManager em;
    public String filename(){return "manual-run-receipts.json";}
    public Object export(Runner runner){return em.createQuery("select r from ManualRunReceipt r where r.runner.id=:id",ManualRunReceipt.class).setParameter("id",runner.getId()).getResultList().stream().map(r->{
        var entry=new java.util.LinkedHashMap<String,Object>();entry.put("clientKey",r.getClientKey());entry.put("deleted",r.isDeleted());entry.put("activityId",r.getActivityId()==null?null:r.getActivityId().toString());return entry;
    }).toList();}
}
