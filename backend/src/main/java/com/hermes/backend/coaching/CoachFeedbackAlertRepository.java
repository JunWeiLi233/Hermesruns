package com.hermes.backend.coaching;

import com.hermes.backend.runner.Runner;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoachFeedbackAlertRepository extends JpaRepository<CoachFeedbackAlert, Long> {
    List<CoachFeedbackAlert> findByRunnerAndDismissedFalseOrderByCreatedAtDesc(Runner runner);

    List<CoachFeedbackAlert> findByRunnerAndMessage(Runner runner, String message);

    Optional<CoachFeedbackAlert> findByIdAndRunner(Long id, Runner runner);
}
