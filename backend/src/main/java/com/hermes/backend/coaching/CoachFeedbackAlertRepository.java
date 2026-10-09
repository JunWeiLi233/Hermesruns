package com.hermes.backend.coaching;

import com.hermes.backend.runner.Runner;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface CoachFeedbackAlertRepository extends JpaRepository<CoachFeedbackAlert, Long> {
    List<CoachFeedbackAlert> findByRunnerAndDismissedFalseOrderByCreatedAtDesc(Runner runner);

    List<CoachFeedbackAlert> findByRunnerAndMessage(Runner runner, String message);

    Optional<CoachFeedbackAlert> findByIdAndRunner(Long id, Runner runner);

    /** Removes the alerts about the given runs, so deleting those runs never hits the foreign key. */
    @Transactional
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM CoachFeedbackAlert a WHERE a.relatedActivity.id IN :activityIds")
    int deleteByRelatedActivityIds(@Param("activityIds") Collection<Long> activityIds);
}
