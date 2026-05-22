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
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Rate-limits public webhook POST endpoints that cannot use Bearer auth.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 5)
public class WebhookRateLimitFilter implements Filter {

    private final WebhookRateLimiter webhookRateLimiter;

    public WebhookRateLimitFilter(WebhookRateLimiter webhookRateLimiter) {
        this.webhookRateLimiter = webhookRateLimiter;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest req = (HttpServletRequest) request;
        if (!"POST".equalsIgnoreCase(req.getMethod())) {
            chain.doFilter(request, response);
            return;
        }

        String path = req.getRequestURI();
        if (path == null) {
            chain.doFilter(request, response);
            return;
        }

        // Do not rate-limit Stripe webhooks — retries are legitimate; authenticity is enforced by signature.
        boolean webhookPath = path.endsWith("/api/strava/webhook");

        if (!webhookPath) {
            chain.doFilter(request, response);
            return;
        }

        String ip = req.getRemoteAddr();
        if (!webhookRateLimiter.allow(ip)) {
            HttpServletResponse resp = (HttpServletResponse) response;
            resp.setStatus(429);
            resp.setContentType(MediaType.APPLICATION_JSON_VALUE);
            resp.getOutputStream().write("{\"error\":\"Too many requests\"}".getBytes(StandardCharsets.UTF_8));
            return;
        }

        chain.doFilter(request, response);
    }
}
