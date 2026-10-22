package com.hermes.backend.auth;

import com.hermes.backend.infrastructure.web.RequestIpResolver;
import com.hermes.backend.runner.Runner;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;

/**
 * Global abuse protection for /api endpoints (scraping + bot mitigation).
 * Uses the shared rate-limit store (Redis when configured, local memory otherwise).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class ApiRateLimitFilter implements Filter {
    private static final Logger log = LoggerFactory.getLogger(ApiRateLimitFilter.class);

    private final ApiRateLimiter limiter;
    private final AuthService authService;

    @Value("${app.api.rate-limit.global-ip-per-minute:600}")
    private int globalIpLimit = 600;
    @Value("${app.api.rate-limit.global-user-per-minute:900}")
    private int globalUserLimit = 900;
    @Value("${app.api.rate-limit.activity-read-user-per-minute:180}")
    private int activityReadUserLimit = 180;
    @Value("${app.api.rate-limit.auth-read-user-per-minute:90}")
    private int authReadUserLimit = 90;
    @Value("${app.api.rate-limit.checkout-ip-per-minute:5}")
    private int checkoutIpLimit = 5;
    @Value("${app.api.rate-limit.checkout-user-per-minute:5}")
    private int checkoutUserLimit = 5;

    public ApiRateLimitFilter(ApiRateLimiter limiter, AuthService authService) {
        this.limiter = limiter;
        this.authService = authService;
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
        if ("/api/billing/webhook".equals(path) || "/api/strava/webhook".equals(path)) {
            chain.doFilter(request, response);
            return;
        }

        String ip = RequestIpResolver.clientIp(req);
        String method = req.getMethod() == null ? "" : req.getMethod().toUpperCase(Locale.ROOT);

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
        if ("/api/shoes/query-normalization".equals(path)) max = 20;
        if ("/api/billing/checkout".equals(path)) max = checkoutIpLimit;

        // A shared ceiling also covers requests that rotate paths, IDs, and HTTP methods.
        if (!limiter.allow("ip|" + ip + "|all", globalIpLimit, windowSec)) {
            writeTooManyRequests(resp, windowSec, "Too many requests from this network. Please slow down and try again.");
            return;
        }

        String bucket = bucketPath(path);
        String methodBucket = "GET".equals(method) || "HEAD".equals(method) ? "READ" : "WRITE";
        String ipKey = "ip|" + ip + "|" + methodBucket + "|" + bucket;
        if (!limiter.allow(ipKey, max, windowSec)) {
            log.warn("API rate limit hit scope=ip ip={} method={} path={} maxPerWindow={} windowSeconds={}",
                    ip, method, path, max, windowSec);
            writeTooManyRequests(resp, windowSec, "Too many requests from this network. Please slow down and try again.");
            return;
        }

        Optional<Runner> authenticatedRunner = authService.findByAuthorizationHeader(req.getHeader("Authorization"));
        if (authenticatedRunner.isPresent()) {
            if (!limiter.allow("user|" + authenticatedRunner.get().getId() + "|all", globalUserLimit, windowSec)) {
                writeTooManyRequests(resp, windowSec, "Too many requests for this account. Please wait a moment and try again.");
                return;
            }
            int userMax = "/api/billing/checkout".equals(path) ? checkoutUserLimit : authenticatedLimit(max, method);
            if ("GET".equals(method) && path.startsWith("/api/activities")) {
                userMax = activityReadUserLimit;
            }
            if ("READ".equals(methodBucket) && path.startsWith("/api/auth/")) {
                userMax = authReadUserLimit;
            }
            String userKey = "user|" + authenticatedRunner.get().getId() + "|" + methodBucket + "|" + bucket;
            if (!limiter.allow(userKey, userMax, windowSec)) {
                log.warn("API rate limit hit scope=user runnerId={} method={} path={} maxPerWindow={} windowSeconds={}",
                        authenticatedRunner.get().getId(), method, path, userMax, windowSec);
                writeTooManyRequests(resp, windowSec, "Too many requests for this account. Please wait a moment and try again.");
                return;
            }
        }

        chain.doFilter(request, response);
    }

    private static int authenticatedLimit(int baseLimit, String method) {
        if ("GET".equals(method) || "HEAD".equals(method)) {
            return Math.max(baseLimit, Math.round(baseLimit * 1.5f));
        }
        return Math.max(baseLimit, Math.round(baseLimit * 1.25f));
    }

    private static void writeTooManyRequests(HttpServletResponse resp, long windowSec, String message) throws IOException {
        resp.setStatus(429);
        resp.setCharacterEncoding(StandardCharsets.UTF_8.name());
        resp.setContentType(MediaType.APPLICATION_JSON_VALUE);
        resp.setHeader("Retry-After", String.valueOf(windowSec));
        resp.getOutputStream().write((
                "{\"error\":\"" + message + "\",\"code\":\"RATE_LIMITED\",\"retryAfterSeconds\":" + windowSec + "}"
        ).getBytes(StandardCharsets.UTF_8));
    }

    private static String bucketPath(String path) {
        // Coarse bucketing keeps memory bounded and avoids per-id bypasses.
        if (path == null) return "";
        if ("/api/billing/checkout".equals(path) || "/api/shoes/scan-image".equals(path)
                || "/api/shoes/query-normalization".equals(path)) return path;
        if (path.startsWith("/api/activities/") && path.contains("/points")) return "/api/activities/:id/points";
        if (path.equals("/api/activities") || path.startsWith("/api/activities/")) return "/api/activities/*";
        if (path.startsWith("/api/shoes/")) return "/api/shoes/*";
        if (path.startsWith("/api/profile/")) return "/api/profile/*";
        if (path.startsWith("/api/races/")) return "/api/races/*";
        if (path.startsWith("/api/billing/")) return "/api/billing/*";
        if (path.startsWith("/api/auth/")) return "/api/auth/*";
        // Unknown resources must not allocate a bucket per caller-controlled path.
        return "/api/*";
    }
}
