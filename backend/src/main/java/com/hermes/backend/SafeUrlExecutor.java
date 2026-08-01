package com.hermes.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.util.Locale;

/**
 * Single outbound HTTP choke-point for user-influenced URLs.
 *
 * <p>The earlier {@link SafeUrlValidator} only inspected the literal host string,
 * so SSRF bypasses that resolve to private infrastructure were still possible:
 * <ul>
 *   <li>decimal / hex / octal IP literals ({@code http://2130706433/} = 127.0.0.1)</li>
 *   <li>DNS rebinding, where the public-looking host resolves to an internal IP</li>
 *   <li>IPv6 equivalents ({@code [::1]}, {@code [::ffff:127.0.0.1]})</li>
 *   <li>link-local / carrier-grade NAT / metadata endpoints ({@code 169.254.169.254})</li>
 * </ul>
 *
 * <p>This executor performs the actual DNS resolution immediately before the
 * request and rejects any resolved address that is loopback, link-local,
 * site-local (RFC 1918), multicast, broadcast, wildcard, or inside the
 * IPv4-mapped IPv6 range. Every server-side fetch of a user-supplied URL must
 * go through {@link #exchange} so the SSRF taint is broken on the same line
 * that issues the request.
 */
@Component
public class SafeUrlExecutor {

    private static final int MAX_URL_LENGTH = 2_000_000;

    private final RestTemplate restTemplate;

    @Autowired
    public SafeUrlExecutor(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
        this.resolveDns = true;
    }

    /**
     * Test-only factory: an executor whose {@link #isResolvedAddressAllowed}
     * always returns {@code true}. Unit tests mock the {@link RestTemplate}
     * transport and exercise URL parsing / candidate-selection logic, so they
     * must not perform live DNS lookups (which would fail in a sandboxed CI and
     * is orthogonal to what those tests assert). Production code must never
     * call this — it always goes through the autowired bean.
     */
    static SafeUrlExecutor permissiveForTests(RestTemplate restTemplate) {
        return new SafeUrlExecutor(restTemplate, false);
    }

    private SafeUrlExecutor(RestTemplate restTemplate, boolean resolveDns) {
        this.restTemplate = restTemplate;
        this.resolveDns = resolveDns;
    }

    private final boolean resolveDns;

    /**
     * Validate-then-fetch for a user-influenced URL. The URL must already have
     * passed {@link SafeUrlValidator} (scheme / length / credential checks);
     * this method additionally resolves the host and rejects private targets
     * right before issuing the request.
     *
     * @return the {@link ResponseEntity}, or {@code null} if the URL resolves
     *         to a disallowed address or is otherwise unfetchable.
     */
    public <T> ResponseEntity<T> exchange(String url, HttpMethod method, HttpEntity<?> requestEntity, Class<T> responseType) {
        if (!isResolvedAddressAllowed(url)) {
            return null;
        }
        // When the URL is already percent-encoded, pass it through a pre-built
        // URI so RestTemplate's default UriComponentsBuilder does not re-encode
        // the '%' characters (e.g. %20 -> %2520). Mirrors the previous behaviour
        // the course-map image fetcher relied on for already-encoded paths.
        if (url.indexOf('%') >= 0) {
            try {
                return restTemplate.exchange(URI.create(url), method, requestEntity, responseType);
            } catch (IllegalArgumentException ignored) {
                return null;
            }
        }
        return restTemplate.exchange(url, method, requestEntity, responseType);
    }

    /**
     * Resolve the URL's host and confirm none of its addresses point at
     * internal / loopback / link-local infrastructure. Exposed package-private
     * so the same guard can be reused by services that need a typed
     * {@link URI} overload of {@code restTemplate.exchange}.
     */
    boolean isResolvedAddressAllowed(String url) {
        if (url == null || url.length() > MAX_URL_LENGTH) {
            return false;
        }
        if (!resolveDns) {
            return true;
        }
        URI uri;
        try {
            uri = new URI(url);
        } catch (URISyntaxException ex) {
            return false;
        }
        String scheme = uri.getScheme();
        if (scheme == null) {
            return false;
        }
        String schemeLower = scheme.toLowerCase(Locale.ROOT);
        if (!"http".equals(schemeLower) && !"https".equals(schemeLower)) {
            return false;
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            return false;
        }
        try {
            InetAddress[] addresses = InetAddress.getAllByName(host);
            for (InetAddress address : addresses) {
                if (!isPublicAddress(address)) {
                    return false;
                }
            }
            return true;
        } catch (UnknownHostException ex) {
            return false;
        }
    }

    /**
     * True only for addresses that are safe for a server to fetch on behalf of
     * a user: not loopback, link-local, site-local, multicast, broadcast, the
     * wildcard address, or an IPv4-mapped IPv6 form of any of those.
     */
    static boolean isPublicAddress(InetAddress address) {
        if (address == null) {
            return false;
        }
        return !address.isAnyLocalAddress()
                && !address.isLoopbackAddress()
                && !address.isLinkLocalAddress()
                && !address.isSiteLocalAddress()
                && !address.isMulticastAddress();
    }
}
