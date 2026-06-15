package com.hermes.backend;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Optional;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminSecurityFilterTests {

    @Test
    void rejectsAnonymousAccessToAdminConfigStatus() throws Exception {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        AdminSecurityFilter filter = new AdminSecurityFilter(authService);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        StringWriter body = new StringWriter();

        when(request.getRequestURI()).thenReturn("/api/config/admin/status");
        when(response.getWriter()).thenReturn(new PrintWriter(body));

        filter.doFilter(request, response, chain);

        verify(response).setStatus(403);
        verify(response).setContentType("application/json");
        verify(chain, never()).doFilter(request, response);
        assertThat(body.toString()).contains("admin_required");
    }

    @Test
    void allowsPublicConfigStatusWithoutAdminGate() throws Exception {
        AuthService authService = mock(AuthService.class);
        AdminSecurityFilter filter = new AdminSecurityFilter(authService);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);

        when(request.getRequestURI()).thenReturn("/api/config/status");

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verify(authService, never()).findByAuthorizationHeader(org.mockito.ArgumentMatchers.any());
    }
}
