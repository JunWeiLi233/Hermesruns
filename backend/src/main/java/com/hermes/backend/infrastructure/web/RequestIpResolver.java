package com.hermes.backend.infrastructure.web;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.Objects;

public final class RequestIpResolver {

    private static final String FORWARDED_FOR = "X-Forwarded-For";

    /**
     * The connection's own address and the lines of X-Forwarded-For, kept by {@link ClientAddressFilter} before Spring's
     * ForwardedHeaderFilter changes what {@code getRemoteAddr()} says. Request attributes can only be set by the server.
     */
    static final String PEER_ATTRIBUTE = RequestIpResolver.class.getName() + ".peer";
    static final String FORWARDED_FOR_ATTRIBUTE = RequestIpResolver.class.getName() + ".forwardedFor";

    private static volatile TrustedProxies trusted = TrustedProxies.DEFAULT;

    private RequestIpResolver() {}

    /** Called once at start-up with the setting {@code app.security.trusted-proxies}; see {@link ClientAddressConfiguration}. */
    static void configure(TrustedProxies proxies) {
        trusted = Objects.requireNonNull(proxies);
    }

    static TrustedProxies configured() {
        return trusted;
    }

    /**
     * The address of whoever is on the other end, for the limits on guessing passwords, sign-ups and requests, for the traffic
     * monitor and for the logs.
     *
     * <p>It is the address of the connection, unless that connection is a reverse proxy of ours (see {@link TrustedProxies}).
     * Then it is the client the proxy says it got the request from: the last address in {@code X-Forwarded-For} that is not
     * itself one of our proxies. The left of that header is whatever the client chose to write, and is never read. A header on
     * a connection that is not from a proxy is the client's own and is ignored, as is {@code X-Real-IP}.</p>
     *
     * <p>Before this, the first address in the header was the client's, so anyone could be somebody new with each request.</p>
     */
    public static String clientIp(HttpServletRequest request) {
        if (request == null) return "unknown";
        InetAddress peer = TrustedProxies.literal(peerText(request));
        if (peer == null) return "unknown";
        TrustedProxies proxies = trusted;
        if (!proxies.trusts(peer)) return peer.getHostAddress();

        List<String> chain = forwardedFor(request);
        if (chain.isEmpty()) return peer.getHostAddress();
        if (proxies.trustsEveryPeer()) {
            InetAddress last = TrustedProxies.literal(chain.get(chain.size() - 1));
            return (last == null ? peer : last).getHostAddress();
        }
        for (int i = chain.size() - 1; i >= 0; i--) {
            InetAddress hop = TrustedProxies.literal(chain.get(i));
            // A proxy of ours wrote the right-hand end, and it writes addresses. Anything else there is not a header to read.
            if (hop == null) return peer.getHostAddress();
            if (!proxies.trusts(hop)) return hop.getHostAddress();
        }
        // Every hop is one of ours, so the client is inside too: the first address is the one the first proxy saw.
        InetAddress first = TrustedProxies.literal(chain.get(0));
        return (first == null ? peer : first).getHostAddress();
    }

    /**
     * The address of the connection itself, which no header can change: for "is this machine talking to itself" and the like. It is
     * "unknown" for a request that has no connection address.
     */
    public static String peerAddress(HttpServletRequest request) {
        if (request == null) return "unknown";
        InetAddress peer = TrustedProxies.literal(peerText(request));
        return peer == null ? "unknown" : peer.getHostAddress();
    }

    private static String peerText(HttpServletRequest request) {
        Object kept = request.getAttribute(PEER_ATTRIBUTE);
        return kept instanceof String text ? text : request.getRemoteAddr();
    }

    /** The entries of every {@code X-Forwarded-For} line, left to right. */
    private static List<String> forwardedFor(HttpServletRequest request) {
        List<String> lines = new ArrayList<>();
        Object kept = request.getAttribute(FORWARDED_FOR_ATTRIBUTE);
        if (kept instanceof List<?> keptLines) {
            for (Object line : keptLines) {
                if (line instanceof String text) lines.add(text);
            }
        } else {
            Enumeration<String> headers = request.getHeaders(FORWARDED_FOR);
            if (headers != null) {
                lines.addAll(Collections.list(headers));
            } else {
                String single = request.getHeader(FORWARDED_FOR);
                if (single != null) lines.add(single);
            }
        }
        List<String> chain = new ArrayList<>();
        for (String line : lines) {
            if (line == null) continue;
            for (String part : line.split(",")) {
                String entry = part.trim();
                if (!entry.isEmpty()) chain.add(entry);
            }
        }
        return chain;
    }

    public static boolean isHttps(HttpServletRequest request) {
        if (request == null) return false;
        if (request.isSecure()) return true;
        String proto = request.getHeader("X-Forwarded-Proto");
        return proto != null && proto.trim().equalsIgnoreCase("https");
    }
}
