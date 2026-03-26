package com.hermes.backend;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

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
        String host = req.getHeader("Host");
        String uri = req.getRequestURI();
        String qs = req.getQueryString();
        String target = "https://" + (host == null ? "" : host) + uri + (qs == null ? "" : "?" + qs);
        String ip = RequestIpResolver.clientIp(req);

        // For idempotent GET/HEAD, redirect to HTTPS.
        if ("GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method)) {
            log.warn("Blocked non-HTTPS request (redirecting) ip={} method={} host={} uri={}", ip, method, host, uri);
            res.setStatus(HttpServletResponse.SC_MOVED_PERMANENTLY);
            res.setHeader("Location", target);
            return;
        }

        // For non-idempotent methods, do not redirect (avoid replay); reject.
        log.warn("Blocked non-HTTPS request ip={} method={} host={} uri={}", ip, method, host, uri);
        res.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        res.setContentType("application/json");
        res.getWriter().write("{\"error\":\"HTTPS required\"}");
    }
}

