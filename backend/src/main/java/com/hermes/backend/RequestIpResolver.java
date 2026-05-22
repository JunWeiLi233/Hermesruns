package com.hermes.backend;

import jakarta.servlet.http.HttpServletRequest;

public final class RequestIpResolver {
    private RequestIpResolver() {}

    /**
     * Best-effort client IP resolution. In production behind a reverse proxy, ensure your proxy is configured
     * to pass X-Forwarded-For and that the app only trusts headers from that proxy.
     */
    public static String clientIp(HttpServletRequest request) {
        if (request == null) return "unknown";
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            // First IP in the chain is the original client (if proxy is configured correctly).
            String first = xff.split(",")[0].trim();
            if (!first.isBlank()) return first;
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) return realIp.trim();
        String ra = request.getRemoteAddr();
        return (ra == null || ra.isBlank()) ? "unknown" : ra;
    }

    public static boolean isHttps(HttpServletRequest request) {
        if (request == null) return false;
        if (request.isSecure()) return true;
        String proto = request.getHeader("X-Forwarded-Proto");
        return proto != null && proto.trim().equalsIgnoreCase("https");
    }
}

