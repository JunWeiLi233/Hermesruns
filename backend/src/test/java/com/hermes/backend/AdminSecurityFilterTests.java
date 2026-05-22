package com.hermes.backend;

import jakarta.servlet.ServletException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AdminSecurityFilterTests {

    @Test
    void allowsFrontendAdminLoginPageToReachSpa() throws ServletException, IOException {
        AuthService authService = mock(AuthService.class);
        AdminSecurityFilter filter = new AdminSecurityFilter(authService);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/admin");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isSameAs(request);
        verifyNoInteractions(authService);
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
}
