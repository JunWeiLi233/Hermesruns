package com.hermes.backend;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AdminSecurityFilterTests {

    @Test
    void concealsFrontendAdminLoginPagesWithoutAdminSession() throws ServletException, IOException {
        AuthService authService = mock(AuthService.class);
        AdminSecurityFilter filter = new AdminSecurityFilter(authService);

        for (String path : new String[]{"/admin", "/admin/"}) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();

            filter.doFilter(request, response, chain);

            assertThat(response.getStatus()).isEqualTo(404);
            assertThat(response.getHeader("Cache-Control")).isEqualTo("no-store");
            assertThat(chain.getRequest()).isNull();
        }
        verifyNoInteractions(authService);
    }

    @Test
    void allowsAdminLoginPageWithFreshAdminPortalSession() throws ServletException, IOException {
        AuthService authService = mock(AuthService.class);
        Runner admin = runner("ADMIN", LocalDateTime.now().minusMinutes(5));
        when(authService.findByAuthorizationHeader("Bearer admin-token")).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        when(authService.hasFreshAdminMfa(admin)).thenReturn(true);
        AdminSecurityFilter filter = new AdminSecurityFilter(authService);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/admin");
        request.setCookies(new Cookie("hermes_admin_portal", "admin-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isSameAs(request);
        verify(authService).findByAuthorizationHeader("Bearer admin-token");
    }

    @Test
    void allowsLocalConsoleErrorEndpointToReachController() throws ServletException, IOException {
        AuthService authService = mock(AuthService.class);
        AdminSecurityFilter filter = new AdminSecurityFilter(authService);

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/dev/console-errors");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isSameAs(request);
        verifyNoInteractions(authService);
    }

    @Test
    void stillBlocksOtherDevEndpointsWithoutAdminPrivileges() throws ServletException, IOException {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        AdminSecurityFilter filter = new AdminSecurityFilter(authService);

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/dev/internal-tools");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(chain.getRequest()).isNull();
        verify(authService).findByAuthorizationHeader(null);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/admin/stats",
            "/api/auth/runners",
            "/api/shoe-catalog/admin/models",
            "/api/shoes/admin/all",
            "/api/config/admin/status"
    })
    void blocksEveryKnownAdminApiSurfaceWithoutAdminPrivileges(String path)
            throws ServletException, IOException {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        AdminSecurityFilter filter = new AdminSecurityFilter(authService);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(chain.getRequest()).isNull();
    }

    @Test
    void portalCookieCannotReplaceBearerAuthenticationForAdminApis()
            throws ServletException, IOException {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        AdminSecurityFilter filter = new AdminSecurityFilter(authService);

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/admin/jobs/clear");
        request.setCookies(new Cookie("hermes_admin_portal", "admin-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(chain.getRequest()).isNull();
        verify(authService).findByAuthorizationHeader(null);
    }

    @Test
    void concealsAdminPortalRoutesWithoutPortalSession() throws ServletException, IOException {
        AuthService authService = mock(AuthService.class);
        AdminSecurityFilter filter = new AdminSecurityFilter(authService);

        for (String path : new String[]{"/dashboard", "/dashboard/users", "/workflows"}) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();

            filter.doFilter(request, response, chain);

            assertThat(response.getStatus()).isEqualTo(404);
            assertThat(response.getHeader("Cache-Control")).isEqualTo("no-store");
            assertThat(chain.getRequest()).isNull();
        }
        verifyNoInteractions(authService);
    }

    @Test
    void rejectsNormalRunnerTokenPresentedAsPortalCookie() throws ServletException, IOException {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner("USER", LocalDateTime.now());
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(authService.isAdmin(runner)).thenReturn(false);
        AdminSecurityFilter filter = new AdminSecurityFilter(authService);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/dashboard");
        request.setCookies(new Cookie("hermes_admin_portal", "runner-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(404);
        assertThat(chain.getRequest()).isNull();
        verify(authService).findByAuthorizationHeader("Bearer runner-token");
    }

    @Test
    void allowsFreshAdminPortalSession() throws ServletException, IOException {
        AuthService authService = mock(AuthService.class);
        Runner admin = runner("ADMIN", LocalDateTime.now().minusMinutes(5));
        when(authService.findByAuthorizationHeader("Bearer admin-token")).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        when(authService.hasFreshAdminMfa(admin)).thenReturn(true);
        AdminSecurityFilter filter = new AdminSecurityFilter(authService);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/dashboard/audit");
        request.setCookies(new Cookie("hermes_admin_portal", "admin-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isSameAs(request);
        verify(authService).findByAuthorizationHeader("Bearer admin-token");
    }

    @Test
    void rejectsFreshAdminTokenWithoutFreshMfaProof() throws ServletException, IOException {
        AuthService authService = mock(AuthService.class);
        Runner admin = runner("ADMIN", LocalDateTime.now().minusMinutes(5));
        when(authService.findByAuthorizationHeader("Bearer admin-token")).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        when(authService.hasFreshAdminMfa(admin)).thenReturn(false);
        AdminSecurityFilter filter = new AdminSecurityFilter(authService);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/dashboard");
        request.setCookies(new Cookie("hermes_admin_portal", "admin-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(404);
        assertThat(chain.getRequest()).isNull();
    }

    @Test
    void rejectsExpiredAdminPortalSession() throws ServletException, IOException {
        AuthService authService = mock(AuthService.class);
        Runner admin = runner("ADMIN", LocalDateTime.now().minusHours(9));
        when(authService.findByAuthorizationHeader("Bearer expired-admin-token")).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        AdminSecurityFilter filter = new AdminSecurityFilter(authService);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/dashboard/jobs");
        request.setCookies(new Cookie("hermes_admin_portal", "expired-admin-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(404);
        assertThat(chain.getRequest()).isNull();
    }

    private Runner runner(String role, LocalDateTime tokenIssuedAt) {
        Runner runner = new Runner();
        runner.setRole(role);
        runner.setTokenIssuedAt(tokenIssuedAt);
        return runner;
    }
}
