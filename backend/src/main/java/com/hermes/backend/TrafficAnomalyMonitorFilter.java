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
import java.time.Duration;

/**
 * Lightweight suspicious traffic detector.
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

    private final TrafficAnomalyStore trafficAnomalyStore;

    public TrafficAnomalyMonitorFilter(TrafficAnomalyStore trafficAnomalyStore) {
        this.trafficAnomalyStore = trafficAnomalyStore;
    }

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
        TrafficAnomalyStore.Snapshot snapshot = trafficAnomalyStore.record(
                ip,
                status,
                Duration.ofSeconds(WINDOW_SECONDS),
                WARN_4XX_PER_MIN,
                WARN_429_PER_MIN,
                WARN_5XX_PER_MIN
        );
        if (snapshot.warning()) {
            String path = req.getRequestURI();
            String method = req.getMethod();
            String ua = req.getHeader("User-Agent");
            log.warn("Suspicious traffic burst ip={} method={} path={} any={} 4xx={} 429={} 5xx={} ua={}",
                    ip, method, path, snapshot.any(), snapshot.s4xx(), snapshot.s429(), snapshot.s5xx(), ua);
        }
    }
}
