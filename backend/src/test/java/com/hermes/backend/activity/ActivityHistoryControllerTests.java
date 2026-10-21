package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class ActivityHistoryControllerTests {
    final AuthService auth = mock(AuthService.class);
    final ActivityDataAccess data = mock(ActivityDataAccess.class);
    final ActivityHistoryController controller = new ActivityHistoryController(auth, data);
    final Runner runner = new Runner();

    @Test void usesOneLookAheadRowAndReturnsExistingFeedShape() {
        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(data.findRunsBeforeIdForRunner(runner, 20L, 3)).thenReturn(List.of(run(19), run(18), run(17)));
        var response = controller.page("Bearer token", 2, 20L);
        var body = (ActivityHistoryController.HistoryPage) response.getBody();
        assertThat(body.items()).extracting(item -> item.get("id")).containsExactly(19L, 18L);
        assertThat(body.items().get(0)).containsKeys("shoeName", "activityInstant", "distanceKm");
        assertThat(body.nextBeforeId()).isEqualTo(18L);
        assertThat(body.hasMore()).isTrue();
        verify(data).findRunsBeforeIdForRunner(runner, 20L, 3);
    }

    @Test void capsPageSizeAndSignalsEndWithoutAnExtraQuery() {
        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(data.findRunsBeforeIdForRunner(runner, null, 501)).thenReturn(List.of(run(19)));
        var body = (ActivityHistoryController.HistoryPage) controller.page("Bearer token", 10000, null).getBody();
        assertThat(body.items()).hasSize(1);
        assertThat(body.hasMore()).isFalse();
        assertThat(body.nextBeforeId()).isNull();
        verify(data).findRunsBeforeIdForRunner(runner, null, 501);
        verifyNoMoreInteractions(data);
    }

    @Test void emptyHistoryAndNonPositiveLimitRemainBounded() {
        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(data.findRunsBeforeIdForRunner(runner, null, 2)).thenReturn(List.of());
        var body = (ActivityHistoryController.HistoryPage) controller.page("Bearer token", 0, null).getBody();
        assertThat(body.items()).isEmpty();
        assertThat(body.nextBeforeId()).isNull();
        assertThat(body.hasMore()).isFalse();
        verify(data).findRunsBeforeIdForRunner(runner, null, 2);
    }

    @Test void rejectsInvalidCursorBeforeQueryingHistory() {
        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        assertThat(controller.page("Bearer token", 2, -1L).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        verifyNoInteractions(data);
    }

    @Test void requiresAuthentication() {
        when(auth.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        assertThat(controller.page(null, 2, null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verifyNoInteractions(data);
    }

    private Activity run(long id) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setRunner(runner);
        activity.setName("Run " + id);
        return activity;
    }
}
