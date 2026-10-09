package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface DeletedActivityTombstoneRepository extends JpaRepository<DeletedActivityTombstone, Long> {

    boolean existsByRunnerAndProviderAndExternalId(Runner runner, String provider, String externalId);

    long countByRunner(Runner runner);

    /** Removes every tombstone of one runner (disconnect, account deletion). Returns the number removed. */
    @Transactional
    @Modifying
    @Query("DELETE FROM DeletedActivityTombstone t WHERE t.runner = :runner")
    int deleteAllByRunner(@Param("runner") Runner runner);
}
