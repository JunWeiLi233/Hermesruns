package com.hermes.backend.coaching;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class CoachLibraryControllerTests {
    @Test void authenticatesEveryRequestAndOnlyLoadsTheBearerOwnersRecommendations() {
        var auth = mock(AuthService.class); var coach = mock(AutomatedCoachService.class);
        var a = new Runner("a@example.test", "active"); var b = new Runner("b@example.test", "active");
        when(auth.findByAuthorizationHeader("Bearer a")).thenReturn(Optional.of(a));
        when(auth.findByAuthorizationHeader("Bearer b")).thenReturn(Optional.of(b));
        when(auth.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        var first = new AutomatedCoachService.CoachLibraryDto(List.of(), null, "CONFIRMED", null, false, "a-plan");
        var second = new AutomatedCoachService.CoachLibraryDto(List.of(), null, "HISTORY", null, false, null);
        when(coach.getWorkoutLibrary(a)).thenReturn(first); when(coach.getWorkoutLibrary(b)).thenReturn(second);
        var controller = new CoachController(auth, coach, mock(ReadinessService.class));
        assertThat(controller.getWorkoutLibrary(null).getStatusCode().value()).isEqualTo(401);
        assertThat(controller.getWorkoutLibrary("Bearer a").getBody()).isSameAs(first);
        assertThat(controller.getWorkoutLibrary("Bearer b").getBody()).isSameAs(second);
        assertThat(controller.getWorkoutLibrary("Bearer a").getHeaders().getCacheControl()).contains("no-store");
        verify(coach, times(2)).getWorkoutLibrary(a); verify(coach).getWorkoutLibrary(b); verifyNoMoreInteractions(coach);
    }
}
