package com.hermes.backend.auth;

import com.hermes.backend.infrastructure.web.RequestIpResolver;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Enforce HTTPS in production. Supports reverse TLS termination via X-Forwarded-Proto.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class HttpsEnforcementFilter implements Filter {
    private static final Logger log = LoggerFactory.getLogger(HttpsEnforcementFilter.class);

    @Value("${hermes.environment:development}")
    private String environment;

    @Value("${app.security.force-https:false}")
    private boolean forceHttps;

    /**
     * Canonical public origin used for HTTPS upgrade redirects. Never trust the
     * request Host / serverName for Location ? containers commonly mirror the
     * client Host header into getServerName().
     */
    @Value("${app.public-base-url:}")
    private String publicBaseUrl;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (!(request instanceof HttpServletRequest req) || !(response instanceof HttpServletResponse res)) {
            chain.doFilter(request, response);
            return;
        }

        boolean explicitHealthEndpoint = "/internal/health".equals(req.getRequestURI());
        boolean railwayRootProbe = "/".equals(req.getRequestURI())
                && "healthcheck.railway.app".equalsIgnoreCase(req.getServerName());
        if ("GET".equalsIgnoreCase(req.getMethod()) && (explicitHealthEndpoint || railwayRootProbe)) {
            res.setStatus(HttpServletResponse.SC_OK);
            res.setContentType("application/json");
            res.setHeader("Cache-Control", "no-store");
            res.getWriter().write("{\"status\":\"ok\"}");
            return;
        }

        boolean prod = environment != null && environment.trim().equalsIgnoreCase("production");
        if (!prod || !forceHttps) {
            chain.doFilter(request, response);
            return;
        }

        if (RequestIpResolver.isHttps(req)) {
            chain.doFilter(request, response);
            return;
        }

        String method = req.getMethod();
        String ip = RequestIpResolver.clientIp(req);
        String uri = req.getRequestURI();

        if ("GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method)) {
            String target = buildHttpsRedirectTarget(req);
            if (target == null) {
                log.warn("Blocked non-HTTPS request with unsafe redirect inputs ip={} method={} uri={}",
                        ip, method, uri);
                res.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                res.setContentType("application/json");
                res.getWriter().write("{\"error\":\"HTTPS required\"}");
                return;
            }
            log.warn("Blocked non-HTTPS request (redirecting) ip={} method={} uri={} location={}",
                    ip, method, uri, target);
            res.setStatus(HttpServletResponse.SC_MOVED_PERMANENTLY);
            res.setHeader("Location", target);
            return;
        }

        log.warn("Blocked non-HTTPS request ip={} method={} uri={}", ip, method, uri);
        res.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        res.setContentType("application/json");
        res.getWriter().write("{\"error\":\"HTTPS required\"}");
    }

    /**
     * Build a same-site HTTPS Location from the configured public base URL plus a
     * validated local path/query. Request Host / serverName are never used for
     * the redirect authority (CodeQL java/unvalidated-url-redirection).
     */
    String buildHttpsRedirectTarget(HttpServletRequest req) {
        URI publicOrigin = resolvePublicOrigin();
        if (publicOrigin == null || publicOrigin.getHost() == null || publicOrigin.getHost().isBlank()) {
            return null;
        }
        String path = sanitizeLocalPath(req.getRequestURI());
        String query = sanitizeQuery(req.getQueryString());
        int port = publicOrigin.getPort();
        String authority = buildAuthority(publicOrigin.getHost(), port > 0 ? port : 443);
        try {
            return new URI("https", authority, path, query, null).toASCIIString();
        } catch (URISyntaxException ex) {
            try {
                return new URI("https", authority, "/", null, null).toASCIIString();
            } catch (URISyntaxException ignored) {
                return null;
            }
        }
    }

    private URI resolvePublicOrigin() {
        if (publicBaseUrl == null || publicBaseUrl.isBlank()) {
            return null;
        }
        try {
            URI configured = URI.create(publicBaseUrl.trim());
            if (configured.getHost() == null || configured.getHost().isBlank()) {
                return null;
            }
            String host = sanitizeServerName(configured.getHost());
            if (host == null) {
                return null;
            }
            int port = configured.getPort();
            return new URI("https", buildAuthority(host, port > 0 ? port : -1), "/", null, null);
        } catch (IllegalArgumentException | URISyntaxException ex) {
            return null;
        }
    }

    static String sanitizeServerName(String serverName) {
        if (serverName == null) {
            return null;
        }
        String host = serverName.trim();
        if (host.isEmpty() || host.length() > 253) {
            return null;
        }
        boolean ipv6Literal = host.startsWith("[") && host.endsWith("]") && host.indexOf(':') > 0;
        if (!ipv6Literal && (host.indexOf('/') >= 0 || host.indexOf('\\') >= 0 || host.indexOf('@') >= 0
                || host.indexOf(' ') >= 0 || host.indexOf(':') >= 0
                || host.indexOf('\r') >= 0 || host.indexOf('\n') >= 0)) {
            return null;
        }
        if (ipv6Literal && (host.indexOf('/') >= 0 || host.indexOf('\\') >= 0 || host.indexOf('@') >= 0
                || host.indexOf(' ') >= 0 || host.indexOf('\r') >= 0 || host.indexOf('\n') >= 0)) {
            return null;
        }
        if (host.contains("://")) {
            return null;
        }
        return host;
    }

    static String sanitizeLocalPath(String requestUri) {
        if (requestUri == null || requestUri.isEmpty()) {
            return "/";
        }
        if (!requestUri.startsWith("/") || requestUri.startsWith("//")
                || requestUri.indexOf('\r') >= 0 || requestUri.indexOf('\n') >= 0
                || requestUri.contains("://")) {
            return "/";
        }
        return requestUri;
    }

    static String sanitizeQuery(String queryString) {
        if (queryString == null || queryString.isEmpty()) {
            return null;
        }
        if (queryString.indexOf('\r') >= 0 || queryString.indexOf('\n') >= 0) {
            return null;
        }
        return queryString;
    }

    private static String buildAuthority(String serverName, int serverPort) {
        if (serverPort <= 0 || serverPort == 443) {
            return serverName;
        }
        return serverName + ":" + serverPort;
    }
}
