package com.hermes.backend;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simple fixed-window rate limiter.
 * <p>
 * In-memory only: good for single-instance deployments. For multi-instance, use Redis/WAF.
 * Stale windows are evicted when they expire to prevent unbounded memory growth.
 * </p>
 */
@Component
public class ApiRateLimiter {
    private static final class Window {
        int count;
        long windowStartEpochSec;
    }

    private static final int MAX_WINDOWS = 50_000;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    public boolean allow(String key, int maxPerWindow, long windowSeconds) {
        if (key == null || key.isBlank()) key = "unknown";
        final String k = key;

        if (windows.size() > MAX_WINDOWS) {
            evictStaleWindows(windowSeconds);
        }

        Window w = windows.computeIfAbsent(k, ignored -> new Window());
        long now = Instant.now().getEpochSecond();
        synchronized (w) {
            if (now - w.windowStartEpochSec >= windowSeconds) {
                w.count = 0;
                w.windowStartEpochSec = now;
            }
            if (w.count >= maxPerWindow) {
                return false;
            }
            w.count++;
            return true;
        }
    }

    private void evictStaleWindows(long windowSeconds) {
        long now = Instant.now().getEpochSecond();
        windows.entrySet().removeIf(entry -> {
            Window w = entry.getValue();
            synchronized (w) {
                return now - w.windowStartEpochSec >= windowSeconds;
            }
        });
    }

    int windowCount() {
        return windows.size();
    }
}

