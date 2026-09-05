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

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (!(request instanceof HttpServletRequest req) || !(response instanceof HttpServletResponse res)) {
            chain.doFilter(request, response);
            return;
        }

        // Railway probes the container over its private HTTP network before
        // exposing a deployment. The existing service probes `/` with the
        // dedicated healthcheck host, while newer installs can use the explicit
        // endpoint. Answer only these data-free GETs locally; a public request
        // for `/` still follows normal HTTPS enforcement and application routing.
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
        // Build the redirect target from the request's own server name rather
        // than the client-supplied `Host` header. The `Host` header is fully
        // attacker-controlled, so echoing it into the `Location` response
        // header created an open redirect (`https://evil.com/...`). The server
        // name reflects the host the container actually served the request on,
        // which is the only destination the redirect should ever target.
        String serverName = req.getServerName();
        int serverPort = req.getServerPort();
        String uri = req.getRequestURI();
        String qs = req.getQueryString();
        String authority = buildAuthority(serverName, serverPort);
        String target = "https://" + authority + uri + (qs == null ? "" : "?" + qs);
        String ip = RequestIpResolver.clientIp(req);

        // For idempotent GET/HEAD, redirect to HTTPS.
        if ("GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method)) {
            log.warn("Blocked non-HTTPS request (redirecting) ip={} method={} host={} uri={}", ip, method, serverName, uri);
            res.setStatus(HttpServletResponse.SC_MOVED_PERMANENTLY);
            res.setHeader("Location", target);
            return;
        }

        // For non-idempotent methods, do not redirect (avoid replay); reject.
        log.warn("Blocked non-HTTPS request ip={} method={} host={} uri={}", ip, method, serverName, uri);
        res.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        res.setContentType("application/json");
        res.getWriter().write("{\"error\":\"HTTPS required\"}");
    }

    /**
     * Reconstruct the host[:port] authority for the redirect target, omitting
     * the port when it is the default for HTTPS (443) so the redirect stays
     * clean. Only hostnames and IPv4/IPv6 literals produced by the servlet
     * container are accepted — never the raw client header.
     */
    private static String buildAuthority(String serverName, int serverPort) {
        if (serverName == null || serverName.isBlank()) {
            return "";
        }
        if (serverPort <= 0 || serverPort == 443) {
            return serverName;
        }
        return serverName + ":" + serverPort;
    }
}
