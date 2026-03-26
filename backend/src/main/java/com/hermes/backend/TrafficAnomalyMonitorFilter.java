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
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Lightweight suspicious traffic detector (in-memory).
 * Logs bursts of 4xx/5xx/429 for a single IP so operators can spot abuse.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class TrafficAnomalyMonitorFilter implements Filter {
    private static final Logger log = LoggerFactory.getLogger(TrafficAnomalyMonitorFilter.class);

    private static final long WINDOW_SECONDS = 60;
    private static final int WARN_4XX_PER_MIN = 30;
    private static final int WARN_429_PER_MIN = 10;
    private static final int WARN_5XX_PER_MIN = 5;

    private static final class Counter {
        long windowStartEpochSec;
        int any;
        int s4xx;
        int s429;
        int s5xx;
        boolean warned;
    }

    private final ConcurrentHashMap<String, Counter> byIp = new ConcurrentHashMap<>();

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (!(request instanceof HttpServletRequest req) || !(response instanceof HttpServletResponse res)) {
            chain.doFilter(request, response);
            return;
        }

        chain.doFilter(request, response);

        int status = res.getStatus();
        String ip = RequestIpResolver.clientIp(req);
        long now = Instant.now().getEpochSecond();

        Counter c = byIp.computeIfAbsent(ip, k -> new Counter());
        synchronized (c) {
            if (now - c.windowStartEpochSec > WINDOW_SECONDS) {
                c.windowStartEpochSec = now;
                c.any = 0;
                c.s4xx = 0;
                c.s429 = 0;
                c.s5xx = 0;
                c.warned = false;
            }

            c.any++;
            if (status >= 500) c.s5xx++;
            else if (status == 429) c.s429++;
            else if (status >= 400) c.s4xx++;

            if (!c.warned && (c.s4xx >= WARN_4XX_PER_MIN || c.s429 >= WARN_429_PER_MIN || c.s5xx >= WARN_5XX_PER_MIN)) {
                c.warned = true;
                String path = req.getRequestURI();
                String method = req.getMethod();
                String ua = req.getHeader("User-Agent");
                log.warn("Suspicious traffic burst ip={} method={} path={} any={} 4xx={} 429={} 5xx={} ua={}",
                        ip, method, path, c.any, c.s4xx, c.s429, c.s5xx, ua);
            }
        }
    }
}

