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
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Global abuse protection for /api endpoints (scraping + bot mitigation).
 * This is an in-memory limiter designed for single-instance deployments.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class ApiRateLimitFilter implements Filter {
    private static final Logger log = LoggerFactory.getLogger(ApiRateLimitFilter.class);

    private final ApiRateLimiter limiter;

    public ApiRateLimitFilter(ApiRateLimiter limiter) {
        this.limiter = limiter;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (!(request instanceof HttpServletRequest req) || !(response instanceof HttpServletResponse resp)) {
            chain.doFilter(request, response);
            return;
        }

        String path = req.getRequestURI();
        if (path == null || !path.startsWith("/api/")) {
            chain.doFilter(request, response);
            return;
        }

        // Avoid breaking Stripe/Strava webhooks with global throttling.
        if (path.startsWith("/api/billing/webhook") || path.startsWith("/api/strava/webhook")) {
            chain.doFilter(request, response);
            return;
        }

        String ip = RequestIpResolver.clientIp(req);
        String method = req.getMethod() == null ? "" : req.getMethod().toUpperCase();

        // Default: allow moderate scraping resistance.
        int max = 300;
        long windowSec = 60;

        // Tighten read-heavy endpoints often scraped.
        if ("GET".equals(method)) {
            if (path.startsWith("/api/activities") || path.startsWith("/api/profile/heatmap")) {
                max = 120; // /min
            }
        }

        // Tighten write endpoints a bit.
        if (!"GET".equals(method) && !"HEAD".equals(method)) {
            max = 120; // /min
        }

        // Auth endpoints get special handling elsewhere; keep a safety cap here.
        if (path.startsWith("/api/auth/")) {
            max = 60; // /min
        }

        // AI endpoints are expensive; hard cap here too.
        if (path.startsWith("/api/shoes/scan-image")) {
            max = 20; // /min
        }

        String key = ip + "|" + method + "|" + bucketPath(path);
        if (!limiter.allow(key, max, windowSec)) {
            log.warn("API rate limit hit ip={} method={} path={} maxPerMin={}", ip, method, path, max);
            resp.setStatus(429);
            resp.setContentType(MediaType.APPLICATION_JSON_VALUE);
            resp.getOutputStream().write("{\"error\":\"Too many requests\"}".getBytes(StandardCharsets.UTF_8));
            return;
        }

        chain.doFilter(request, response);
    }

    private static String bucketPath(String path) {
        // Coarse bucketing keeps memory bounded and avoids per-id bypasses.
        if (path == null) return "";
        if (path.startsWith("/api/activities/") && path.contains("/points")) return "/api/activities/:id/points";
        if (path.startsWith("/api/shoes/")) return "/api/shoes/*";
        if (path.startsWith("/api/profile/")) return "/api/profile/*";
        if (path.startsWith("/api/races/")) return "/api/races/*";
        return path;
    }
}

