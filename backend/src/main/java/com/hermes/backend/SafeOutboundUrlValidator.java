package com.hermes.backend;

import java.net.URI;
import java.util.Locale;

/**
 * Blocks SSRF when user-controlled URLs are fetched with server-side OAuth (e.g. Garmin push callbackURL).
 */
public final class SafeOutboundUrlValidator {

    private SafeOutboundUrlValidator() {
    }

    /**
     * Garmin activity file callbacks must be HTTPS and hosted under Garmin-controlled hostnames.
     */
    public static boolean isAllowedGarminCallbackUrl(String urlString) {
        if (urlString == null || urlString.isBlank()) {
            return false;
        }
        final URI uri;
        try {
            uri = URI.create(urlString.trim());
        } catch (IllegalArgumentException e) {
            return false;
        }
        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            return false;
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            return false;
        }
        host = host.toLowerCase(Locale.ROOT);
        if (isBlockedHost(host)) {
            return false;
        }
        return host.equals("garmin.com") || host.endsWith(".garmin.com");
    }

    private static boolean isBlockedHost(String host) {
        if (host.equals("localhost")) {
            return true;
        }
        if (host.startsWith("127.")) {
            return true;
        }
        // IPv4 literal — block private / loopback / link-local
        if (host.chars().filter(ch -> ch == '.').count() == 3) {
            String[] p = host.split("\\.");
            if (p.length != 4) {
                return true;
            }
            try {
                int a = Integer.parseInt(p[0]);
                int b = Integer.parseInt(p[1]);
                if (a == 10) {
                    return true;
                }
                if (a == 172 && b >= 16 && b <= 31) {
                    return true;
                }
                if (a == 192 && b == 168) {
                    return true;
                }
                if (a == 169 && b == 254) {
                    return true;
                }
                if (a == 127) {
                    return true;
                }
                if (a == 0 || a == 255) {
                    return true;
                }
                if (a == 100 && b >= 64 && b <= 127) {
                    return true; // CGNAT
                }
            } catch (NumberFormatException e) {
                return true;
            }
        }
        if (host.contains(":")) {
            return true; // IPv6 — disallow literals (Garmin uses hostnames)
        }
        return false;
    }
}
