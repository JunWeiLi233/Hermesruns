package com.hermes.backend.summary;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * The controller without the security filter in front of it. The filter turns a bad session away first, so a request never
 * reaches this check in the running app; it is a second boundary and has to hold by itself.
 */
class RunSummaryControllerTests {

    private final AuthService authService = mock(AuthService.class);
    private final RunSummaryService service = mock(RunSummaryService.class);
    private final RunSummaryController controller = new RunSummaryController(authService, service);

    @Test
    void withoutARunnerNothingIsReadAndTheAnswerIsNoSession() {
        when(authService.findByAuthorizationHeader("Bearer gone")).thenReturn(Optional.empty());
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        for (String header : new String[] {"Bearer gone", null}) {
            ResponseEntity<?> answer = controller.summary(1L, header);

            assertThat(answer.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(answer.getBody()).isEqualTo(Map.of("error", "Invalid or expired session token.", "code", "UNAUTHORIZED"));
        }
        verifyNoInteractions(service);
    }

    @Test
    void aRunTheServiceDoesNotHaveIsNotFound() {
        Runner runner = new Runner("summary-controller@hermes.test", "active");
        when(authService.findByAuthorizationHeader("Bearer good")).thenReturn(Optional.of(runner));
        when(service.summarise(runner, 9L)).thenReturn(Optional.empty());

        ResponseEntity<?> answer = controller.summary(9L, "Bearer good");

        assertThat(answer.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(answer.getBody()).isEqualTo(Map.of("error", "Activity not found.", "code", "NOT_FOUND"));
    }

    @Test
    void aSummaryTheServiceHasIsAnswered() {
        Runner runner = new Runner("summary-controller@hermes.test", "active");
        RunSummary summary = new RunSummary(9L, "ready", null, LocalDate.of(2026, 3, 15), List.of());
        when(authService.findByAuthorizationHeader("Bearer good")).thenReturn(Optional.of(runner));
        when(service.summarise(runner, 9L)).thenReturn(Optional.of(summary));

        ResponseEntity<?> answer = controller.summary(9L, "Bearer good");

        assertThat(answer.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(answer.getBody()).isSameAs(summary);
        verify(service).summarise(runner, 9L);
    }
}
