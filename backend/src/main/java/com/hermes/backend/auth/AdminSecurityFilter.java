package com.hermes.backend.auth;

import com.hermes.backend.runner.Runner;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Centralized protection for all admin-only endpoints.
 * Intercepts requests to /api/admin/** and other restricted operator surfaces.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 30)
public class AdminSecurityFilter implements Filter {

    private final AuthService authService;
    private final AdminAccessGateway adminAccessGateway;

    public AdminSecurityFilter(AuthService authService) {
        this(authService, AdminAccessGateway.disabled());
    }

    @Autowired
    public AdminSecurityFilter(AuthService authService, AdminAccessGateway adminAccessGateway) {
        this.authService = authService;
        this.adminAccessGateway = adminAccessGateway;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String path = httpRequest.getRequestURI();

        if (requiresAdminAccessGateway(path) && !adminAccessGateway.isAllowed(httpRequest)) {
            if (AdminPortalSessionCookie.isAdminPortalPath(path) || isAdminAuthenticationEndpoint(path)) {
                concealAdminPortal(httpResponse);
            } else {
                denyAdminApi(httpResponse);
            }
            return;
        }

        if (AdminPortalSessionCookie.isAdminPortalPath(path)) {
            Optional<Runner> adminOptional = AdminPortalSessionCookie.read(httpRequest)
                    .flatMap(token -> authService.findByAuthorizationHeader("Bearer " + token))
                    .filter(authService::isAdmin)
                    .filter(authService::hasFreshAdminMfa)
                    .filter(AdminPortalSessionCookie::isFresh);

            if (adminOptional.isEmpty()) {
                concealAdminPortal(httpResponse);
                return;
            }
        }

        if (isAdminEndpoint(path)) {
            String authHeader = httpRequest.getHeader("Authorization");
            Optional<Runner> adminOptional = authService.findByAuthorizationHeader(authHeader)
                    .filter(authService::isAdmin)
                    .filter(authService::hasFreshAdminMfa)
                    .filter(AdminPortalSessionCookie::isFresh);

            if (adminOptional.isEmpty()) {
                denyAdminApi(httpResponse);
                return;
            }
        }

        chain.doFilter(request, response);
    }

    private void denyAdminApi(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setHeader("Cache-Control", "no-store");
        response.setContentType("application/json");
        response.getWriter().write("{\"error\": \"Admin privileges required.\", \"code\": \"admin_required\"}");
    }

    private boolean requiresAdminAccessGateway(String path) {
        return AdminPortalSessionCookie.isAdminPortalPath(path)
                || isAdminEndpoint(path)
                || isAdminAuthenticationEndpoint(path);
    }

    private boolean isAdminAuthenticationEndpoint(String path) {
        return "/api/auth/admin-login".equals(path)
                || isPathOrChild(path, "/api/auth/admin-mfa");
    }

    private void concealAdminPortal(HttpServletResponse response) {
        response.setStatus(HttpStatus.NOT_FOUND.value());
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Pragma", "no-cache");
        response.setHeader("X-Content-Type-Options", "nosniff");
    }

    private boolean isAdminEndpoint(String path) {
        if ("/api/auth/admin-login".equals(path)) {
            return false;
        }
        if ("/api/dev/console-errors".equals(path)) {
            return false;
        }
        // Protect API admin surfaces. Admin document routes are handled above.
        return isPathOrChild(path, "/api/admin") ||
               path.contains("/admin-login") ||
               isPathOrChild(path, "/api/auth/runners") ||
               isPathOrChild(path, "/api/shoe-catalog/admin") ||
               isPathOrChild(path, "/api/shoes/admin") ||
               isPathOrChild(path, "/api/config/admin") ||
               isPathOrChild(path, "/api/dev");
    }

    private boolean isPathOrChild(String path, String root) {
        return root.equals(path) || path.startsWith(root + "/");
    }
}
