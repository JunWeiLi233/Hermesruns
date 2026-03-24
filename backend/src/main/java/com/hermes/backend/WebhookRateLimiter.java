package com.hermes.backend;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Simple per-IP rate limit for unauthenticated webhook endpoints (abuse / DoS mitigation).
 */
@Component
public class WebhookRateLimiter {

    private static final int MAX_REQUESTS = 120;
    private static final long WINDOW_MS = 60_000L;

    private static final class Window {
        int count;
        long windowStartMs;
    }

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    public boolean allow(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            clientIp = "unknown";
        }
        final String ip = clientIp;
        Window w = windows.computeIfAbsent(ip, k -> new Window());
        synchronized (w) {
            long now = System.currentTimeMillis();
            if (now - w.windowStartMs > WINDOW_MS) {
                w.count = 0;
                w.windowStartMs = now;
            }
            if (w.count >= MAX_REQUESTS) {
                return false;
            }
            w.count++;
            return true;
        }
    }
}
