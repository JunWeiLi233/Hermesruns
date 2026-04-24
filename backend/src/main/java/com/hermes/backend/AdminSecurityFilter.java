package com.hermes.backend;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Optional;

/**
 * Centralized protection for all admin-only endpoints.
 * Intercepts requests to /api/admin/** and other restricted operator surfaces.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 30)
public class AdminSecurityFilter implements Filter {

    private final AuthService authService;

    public AdminSecurityFilter(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String path = httpRequest.getRequestURI();

        if (isAdminEndpoint(path)) {
            String authHeader = httpRequest.getHeader("Authorization");
            Optional<Runner> adminOptional = authService.findByAuthorizationHeader(authHeader)
                    .filter(authService::isAdmin);

            if (adminOptional.isEmpty()) {
                httpResponse.setStatus(HttpStatus.FORBIDDEN.value());
                httpResponse.setContentType("application/json");
                httpResponse.getWriter().write("{\"error\": \"Admin privileges required.\", \"code\": \"admin_required\"}");
                return;
            }
        }

        chain.doFilter(request, response);
    }

    private boolean isAdminEndpoint(String path) {
        if ("/api/auth/admin-login".equals(path)) {
            return false;
        }
        if ("/api/dev/console-errors".equals(path)) {
            return false;
        }
        // Centralized protection for any path containing "/admin/" or specific admin entry points
        return path.contains("/admin/") ||
               path.startsWith("/api/admin") ||
               path.contains("/admin-login") ||
               path.startsWith("/api/auth/runners") ||
               path.startsWith("/api/shoe-catalog/admin") ||
               path.startsWith("/api/dev/");
    }
}
