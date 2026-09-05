package com.hermes.backend.auth;

import com.hermes.backend.runner.Runner;
import jakarta.servlet.http.Cookie;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class JwtAuthenticationFilterTests {

    @Test
    void authenticatesFreshAdminPortalCookieOnlyForPortalDocumentRoutes() throws Exception {
        AuthService authService = mock(AuthService.class);
        Runner admin = new Runner();
        admin.setRole("ADMIN");
        admin.setTokenIssuedAt(LocalDateTime.now().minusMinutes(5));
        when(authService.findByAuthorizationHeader("Bearer admin-token")).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(authService);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/dashboard/users");
        request.setCookies(new Cookie("hermes_admin_portal", "admin-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<Authentication> authenticationDuringChain = new AtomicReference<>();

        filter.doFilter(request, response, (ignoredRequest, ignoredResponse) ->
                authenticationDuringChain.set(SecurityContextHolder.getContext().getAuthentication()));

        assertThat(authenticationDuringChain.get()).isNotNull();
        assertThat(authenticationDuringChain.get().getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_ADMIN");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void neverUsesPortalCookieAsAnApiCredential() throws Exception {
        AuthService authService = mock(AuthService.class);
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(authService);

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/admin/jobs/clear");
        request.setCookies(new Cookie("hermes_admin_portal", "admin-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<Authentication> authenticationDuringChain = new AtomicReference<>();

        filter.doFilter(request, response, (ignoredRequest, ignoredResponse) ->
                authenticationDuringChain.set(SecurityContextHolder.getContext().getAuthentication()));

        assertThat(authenticationDuringChain.get()).isNull();
        verifyNoInteractions(authService);
    }
}
