package com.hermes.backend.coaching;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class RecommendationRevisionControllerTests {
    @Test
    void revisionUsesOnlyTheAuthenticatedRunnerAndCannotBeCached() {
        AuthService auth = mock(AuthService.class);
        RecommendationSourceRevision sources = mock(RecommendationSourceRevision.class);
        Runner runner = new Runner(); runner.setId(7L);
        when(auth.findByAuthorizationHeader("Bearer account-token")).thenReturn(Optional.of(runner));
        when(sources.revision(runner)).thenReturn("committed-input-digest");
        var response = new RecommendationRevisionController(auth, sources).revision("Bearer account-token");
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("private, no-store");
        assertThat(response.getBody()).isEqualTo(Map.of("revision", "committed-input-digest"));
        verify(sources).revision(runner);
    }

    @Test
    void signedOutRequestsCannotReadASourceRevision() {
        AuthService auth = mock(AuthService.class);
        RecommendationSourceRevision sources = mock(RecommendationSourceRevision.class);
        when(auth.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        assertThat(new RecommendationRevisionController(auth, sources).revision(null).getStatusCode().value()).isEqualTo(401);
        verifyNoInteractions(sources);
    }
}
