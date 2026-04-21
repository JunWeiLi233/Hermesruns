package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CoachFeedbackAlertRepository extends JpaRepository<CoachFeedbackAlert, Long> {
    List<CoachFeedbackAlert> findByRunnerAndDismissedFalseOrderByCreatedAtDesc(Runner runner);

    List<CoachFeedbackAlert> findByRunnerAndMessage(Runner runner, String message);

    Optional<CoachFeedbackAlert> findByIdAndRunner(Long id, Runner runner);
}
