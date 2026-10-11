package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * What the records answers say about the analysis behind them, with the services faked: whether they are complete, and
 * that an analysis which fails is a reason to say places may change and not a reason to fail the answer.
 */
class RunRecordsControllerTests {

    private final AuthService authService = mock(AuthService.class);
    private final BestEffortService bestEfforts = mock(BestEffortService.class);
    private final RouteMatchService routes = mock(RouteMatchService.class);
    private final RunRecordsCoordinator coordinator = mock(RunRecordsCoordinator.class);
    private final RunRecordsController controller = new RunRecordsController(authService, bestEfforts, routes, coordinator);
    private final Runner runner = new Runner();

    @BeforeEach
    void aRunnerIsSignedIn() {
        runner.setId(5L);
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(bestEfforts.effortsOf(runner, 9L)).thenReturn(Optional.of(List.of()));
        when(routes.matchesOf(runner, 9L)).thenReturn(Optional.of(new RouteMatchService.Matches(null, 0, false, 0.0, List.of())));
    }

    private boolean complete(ResponseEntity<?> response) {
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Object body = response.getBody();
        if (body instanceof BestEffortService.RunEfforts efforts) {
            return efforts.complete();
        }
        if (body instanceof RunRecordsController.MatchesResponse matches) {
            return matches.complete();
        }
        throw new AssertionError("unexpected body " + body);
    }

    @Test
    void theAnswersAreCompleteWhenNoRunIsWaiting() {
        when(coordinator.ensurePending(eq(runner), any(Duration.class), anyInt())).thenReturn(0L);

        assertThat(complete(controller.runEfforts(9L, "Bearer token"))).isTrue();
        assertThat(complete(controller.matches(9L, "Bearer token"))).isTrue();
        verify(coordinator, org.mockito.Mockito.times(2)).ensureAnalysed(runner, 9L);
    }

    @Test
    void theAnswersSayPlacesMayChangeWhileRunsAreWaiting() {
        when(coordinator.ensurePending(eq(runner), any(Duration.class), anyInt())).thenReturn(3L);

        assertThat(complete(controller.runEfforts(9L, "Bearer token"))).isFalse();
        assertThat(complete(controller.matches(9L, "Bearer token"))).isFalse();
    }

    @Test
    void anAnalysisThatFailsForTheRunAskedAboutDoesNotFailTheAnswer() {
        doThrow(new DataIntegrityViolationException("duplicate key")).when(coordinator).ensureAnalysed(runner, 9L);

        assertThat(complete(controller.runEfforts(9L, "Bearer token"))).isFalse();
        assertThat(complete(controller.matches(9L, "Bearer token"))).isFalse();
        verify(coordinator, never()).ensurePending(any(), any(), anyInt());
    }

    @Test
    void anAnalysisThatFailsForTheOtherRunsDoesNotFailTheAnswerEither() {
        when(coordinator.ensurePending(eq(runner), any(Duration.class), anyInt())).thenThrow(new IllegalStateException("database busy"));

        assertThat(complete(controller.runEfforts(9L, "Bearer token"))).isFalse();
        assertThat(complete(controller.matches(9L, "Bearer token"))).isFalse();
    }

    @Test
    void theAnalysisOfTheWholeHistorySaysSoToo() {
        BestEffortService.Analysis analysis = new BestEffortService.Analysis(true, List.of(), null, 0.0, List.of(), null, List.of(), List.of(), List.of());
        when(bestEfforts.analysis(eq(runner), any(), any(), org.mockito.ArgumentMatchers.anyBoolean())).thenReturn(analysis);

        when(coordinator.ensurePending(eq(runner), any(Duration.class), anyInt())).thenReturn(0L);
        assertThat(controller.analysis("Bearer token", null, null).getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(bestEfforts).analysis(runner, null, null, true);

        when(coordinator.ensurePending(eq(runner), any(Duration.class), anyInt())).thenThrow(new IllegalStateException("database busy"));
        assertThat(controller.analysis("Bearer token", "5km", 2026).getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(bestEfforts).analysis(runner, "5km", 2026, false);
        verify(coordinator, never()).ensureAnalysed(any(), any());
    }

    @Test
    void aRunThatIsNotTheCallersIsStillNotFound() {
        when(bestEfforts.effortsOf(runner, 10L)).thenReturn(Optional.empty());
        when(routes.matchesOf(runner, 10L)).thenReturn(Optional.empty());

        assertThat(controller.runEfforts(10L, "Bearer token").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(controller.matches(10L, "Bearer token").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
