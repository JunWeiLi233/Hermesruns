package com.hermes.backend.auth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Regression coverage for the encoded-administrative-path bypass: the filter must classify on the
 * decoded servlet path (what the router dispatches) and must refuse a request whose raw and decoded
 * forms disagree on an administrative surface.
 */
class AdminEncodedPathFilterTests {

    @Test
    void encodedAdminPathIsRefusedInsteadOfSkippingGatewayAndFreshMfa() throws Exception {
        AdminSecurityFilter filter = new AdminSecurityFilter(anonymousAuthService());

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/users/export");
        request.setRequestURI("/api/%61dmin/users/export");
        request.setServletPath("/api/admin/users/export");
        request.setContextPath("");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean reachedChain = new AtomicBoolean(false);

        filter.doFilter(request, response, (rq, rs) -> reachedChain.set(true));

        assertThat(reachedChain).isFalse();
        assertThat(response.getStatus()).isEqualTo(403);
    }

    @Test
    void canonicalAdminPathWithoutAdminSessionIsStillDenied() throws Exception {
        AdminSecurityFilter filter = new AdminSecurityFilter(anonymousAuthService());

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/users/export");
        request.setServletPath("/api/admin/users/export");
        request.setContextPath("");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean reachedChain = new AtomicBoolean(false);

        filter.doFilter(request, response, (rq, rs) -> reachedChain.set(true));

        assertThat(reachedChain).isFalse();
        assertThat(response.getStatus()).isEqualTo(403);
    }

    @Test
    void nonAdministrativePathIsUnaffected() throws Exception {
        AdminSecurityFilter filter = new AdminSecurityFilter(anonymousAuthService());

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/races/course-map");
        request.setServletPath("/api/races/course-map");
        request.setContextPath("");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean reachedChain = new AtomicBoolean(false);

        filter.doFilter(request, response, (rq, rs) -> reachedChain.set(true));

        assertThat(reachedChain).isTrue();
    }

    private static AuthService anonymousAuthService() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(any())).thenReturn(Optional.empty());
        return authService;
    }
}
