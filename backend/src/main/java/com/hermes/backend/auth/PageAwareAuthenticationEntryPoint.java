package com.hermes.backend.auth;

import com.hermes.backend.infrastructure.web.SpaForwardingController;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;

/**
 * What an anonymous request for something that needs a session gets.
 *
 * <p>The API answers 401 with a JSON error. A browser that opens an address the app does not know (a bookmark of a page that
 * is gone, a mistyped link, {@code /support}) has no session token to send and used to see that JSON in the tab. It gets the
 * app itself instead, with status 404: the client router decides what to show, and a crawler is told the page is not there.</p>
 *
 * <p>Only a {@code GET} or {@code HEAD} that accepts {@code text/html}, outside {@code /api}, for an address that does not end
 * in a file extension, is taken for a page. Everything else (a {@code POST}, a request for {@code /wp-login.php}, anything
 * under {@code /api}) is still the JSON 401, so a script cannot mistake the shell for an answer.</p>
 */
final class PageAwareAuthenticationEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
            throws IOException {
        if (isPageAddress(request)) {
            String shell = SpaForwardingController.readShell();
            if (shell != null) {
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                response.setContentType(MediaType.TEXT_HTML_VALUE);
                response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate");
                response.setHeader(HttpHeaders.PRAGMA, "no-cache");
                response.setHeader(HttpHeaders.EXPIRES, "0");
                response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
                if (!"HEAD".equals(request.getMethod())) {
                    response.getWriter().write(shell);
                }
                return;
            }
        }
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"Invalid or expired session token.\"}");
    }

    static boolean isPageAddress(HttpServletRequest request) {
        String method = request.getMethod();
        if (!"GET".equals(method) && !"HEAD".equals(method)) {
            return false;
        }
        String path = request.getRequestURI();
        if (path == null || path.isEmpty() || "/api".equals(path) || path.startsWith("/api/")) {
            return false;
        }
        if (path.substring(path.lastIndexOf('/') + 1).indexOf('.') >= 0) {
            return false;
        }
        String accept = request.getHeader(HttpHeaders.ACCEPT);
        return accept != null && accept.toLowerCase(Locale.ROOT).contains("text/html");
    }
}
