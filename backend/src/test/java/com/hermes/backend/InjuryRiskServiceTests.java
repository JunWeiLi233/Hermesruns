package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class InjuryRiskServiceTests {

    @Test
    void assessmentProvidesTheInjuryPreventionDashboardContract() {
        SorenessLogRepository sorenessLogRepository = mock(SorenessLogRepository.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        Runner runner = runner();
        SorenessLog sorenessLog = new SorenessLog(runner, LocalDate.now(), "LOW", null);

        when(sorenessLogRepository.findByRunnerAndDate(any(Runner.class), any(LocalDate.class)))
                .thenReturn(Optional.of(sorenessLog));
        when(sorenessLogRepository.findByRunnerOrderByDateDesc(runner)).thenReturn(List.of(sorenessLog));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of());

        InjuryRiskService.InjuryRiskAssessment assessment = new InjuryRiskService(sorenessLogRepository, activityRepository)
                .getRiskAssessment(runner);

        assertThat(assessment.combinedRiskScore()).isEqualTo(17);
        assertThat(assessment.recommendation()).isEqualTo("ready");
        assertThat(assessment.acwrTrend()).isEqualTo("flat");
        assertThat(assessment.recentLogs()).extracting(InjuryRiskService.SorenessLogSummary::level)
                .containsExactly("LOW");
        assertThat(assessment.coachAdvice()).isEqualTo(assessment.coachVoice());
    }

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(7L);
        runner.setEmail("runner@hermes.test");
        runner.setRole("USER");
        return runner;
    }
}
