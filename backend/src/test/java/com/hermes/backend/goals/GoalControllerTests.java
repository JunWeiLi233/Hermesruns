package com.hermes.backend.goals;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * The controller on its own, without the security filter in front of it. The filter turns a missing or bad session away
 * first, so a request never reaches this check in the running app; it is a second boundary, and it has to hold by itself
 * (a runner whose session ends between the two, or a route the filter's list does not cover one day).
 */
class GoalControllerTests {

    private final AuthService authService = mock(AuthService.class);
    private final GoalService service = mock(GoalService.class);
    private final GoalController controller = new GoalController(authService, service);

    private ResponseEntity<?> call(String route, String header) {
        return switch (route) {
            case "list" -> controller.list(header, null);
            case "create" -> controller.create(header, Map.of("period", "WEEK", "metric", "DISTANCE", "target", 20));
            case "change" -> controller.change(1L, header, Map.of("target", 5));
            default -> controller.delete(1L, header);
        };
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"list", "create", "change", "delete"})
    void withoutARunnerNothingIsReadOrChangedAndTheAnswerIsNoSession(String route) {
        when(authService.findByAuthorizationHeader("Bearer gone")).thenReturn(Optional.empty());
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        for (String header : new String[] {"Bearer gone", null}) {
            ResponseEntity<?> answer = call(route, header);

            assertThat(answer.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(answer.getBody()).isEqualTo(Map.of("error", "Invalid or expired session token.", "code", "UNAUTHORIZED"));
        }
        verifyNoInteractions(service);
    }

    @Test
    void aRunnerWhoseSessionHoldsGetsTheirOwnGoalsAndTheRunTheyNamed() {
        Runner runner = new Runner("goal-controller@hermes.test", "active");
        GoalService.GoalsResponse response = new GoalService.GoalsResponse(null, "Z", List.of(), GoalPeriods.ALL, GoalMetrics.ALL, GoalMetrics.MAX_TARGET);
        when(authService.findByAuthorizationHeader("Bearer good")).thenReturn(Optional.of(runner));
        when(service.list(runner, 5L)).thenReturn(response);

        ResponseEntity<?> answer = controller.list("Bearer good", 5L);

        assertThat(answer.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(answer.getBody()).isSameAs(response);
        verify(service).list(eq(runner), eq(5L));
    }

    @Test
    void aRunnerWhoseSessionHoldsCanSetAGoalAndTheServiceIsToldWhatTheyAskedFor() {
        Runner runner = new Runner("goal-controller@hermes.test", "active");
        GoalService.GoalsResponse response = new GoalService.GoalsResponse(null, "Z", List.of(), GoalPeriods.ALL, GoalMetrics.ALL, GoalMetrics.MAX_TARGET);
        when(authService.findByAuthorizationHeader("Bearer good")).thenReturn(Optional.of(runner));
        when(service.create(any(), any(), any(), any())).thenReturn(response);

        ResponseEntity<?> answer = controller.create("Bearer good", Map.of("period", "WEEK", "metric", "DISTANCE", "target", 20));

        assertThat(answer.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        verify(service).create(runner, "WEEK", "DISTANCE", 20);
    }
}
