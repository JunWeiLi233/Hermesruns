package com.hermes.backend.activity;

import java.util.Collection;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ManualRunReceiptRepository extends JpaRepository<ManualRunReceipt,Long> {
    Optional<ManualRunReceipt> findByRunnerIdAndClientKey(Long runnerId,String clientKey);
    @Modifying @Query("UPDATE ManualRunReceipt r SET r.deleted=true,r.activityId=null,r.startedAt=null,r.timeZone=null,r.distanceMeters=null,r.elapsedSeconds=null,r.name=null WHERE r.activityId IN :ids")
    void markDeleted(@Param("ids") Collection<Long> ids);
    @Modifying @Query("DELETE FROM ManualRunReceipt r WHERE r.runner.id=:runnerId")
    void deleteByOwner(@Param("runnerId") Long runnerId);
}
