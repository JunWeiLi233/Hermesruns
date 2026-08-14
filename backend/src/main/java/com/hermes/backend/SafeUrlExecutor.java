package com.hermes.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.net.HttpURLConnection;
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
 * IPv4-mapped IPv6 range. Redirects are followed manually: each hop must pass
 * the same literal-URL and resolved-address checks, and the underlying
 * transport never auto-follows a 30x, so a public first hop cannot pivot the
 * fetch to internal infrastructure via a redirecting relay. Every server-side
 * fetch of a user-supplied URL must go through {@link #exchange} so the SSRF
 * taint is broken on the same line that issues the request.
 */
@Component
public class SafeUrlExecutor {

    private static final int MAX_URL_LENGTH = 2_000_000;
    private static final int MAX_REDIRECT_HOPS = 5;

    private final RestTemplate restTemplate;

    /**
     * Transport with automatic redirect following disabled, so every redirect
     * hop can be re-validated before it is followed. Built from the shared
     * {@link #restTemplate} when its request factory is a
     * {@link SimpleClientHttpRequestFactory}; otherwise null, which keeps
     * test mocks working through the injected template unchanged.
     */
    private final RestTemplate redirectSafeRestTemplate;

    @Autowired
    public SafeUrlExecutor(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
        this.resolveDns = true;
        this.redirectSafeRestTemplate = copyWithoutAutoRedirects(restTemplate);
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
        this.redirectSafeRestTemplate = null;
    }

    private final boolean resolveDns;

    /**
     * Validate-then-fetch for a user-influenced URL. The URL must already have
     * passed {@link SafeUrlValidator} (scheme / length / credential checks);
     * this method additionally resolves the host and rejects private targets
     * right before issuing the request. Redirects are followed manually and
     * <strong>every hop</strong> must pass the same string + resolved-address
     * checks before it is fetched — the underlying transport never follows a
     * redirect on its own, so a public first hop cannot be used to pivot to
     * internal infrastructure via a 30x.
     *
     * <p>Residual risk: DNS rebinding between the pre-flight resolution here
     * and the transport's own resolution on connect. Closing that fully
     * requires connection-level IP pinning (custom DNS resolver), which is
     * out of scope for this executor.
     *
     * @return the {@link ResponseEntity}, or {@code null} if any hop resolves
     *         to a disallowed address or is otherwise unfetchable.
     */
    public <T> ResponseEntity<T> exchange(String url, HttpMethod method, HttpEntity<?> requestEntity, Class<T> responseType) {
        RestTemplate transport = redirectSafeRestTemplate != null ? redirectSafeRestTemplate : restTemplate;
        HttpMethod hopMethod = method;
        HttpEntity<?> hopEntity = requestEntity;
        String hopUrl = url;
        for (int hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
            if (!isHopAllowed(hopUrl)) {
                return null;
            }
            ResponseEntity<T> response = executeOnce(transport, hopUrl, hopMethod, hopEntity, responseType);
            if (response == null) {
                return null;
            }
            String location = redirectLocation(response);
            if (location == null) {
                return response;
            }
            String nextUrl = resolveRedirectTarget(hopUrl, location);
            if (nextUrl == null) {
                return null;
            }
            if (methodChangesToGet(response.getStatusCode())) {
                hopMethod = HttpMethod.GET;
                hopEntity = new HttpEntity<Void>((Void) null);
            }
            hopUrl = nextUrl;
        }
        // Redirect chain longer than the hop budget: treat as unfetchable.
        return null;
    }

    private <T> ResponseEntity<T> executeOnce(RestTemplate transport, String url, HttpMethod method, HttpEntity<?> requestEntity, Class<T> responseType) {
        try {
            // When the URL is already percent-encoded, pass it through a pre-built
            // URI so RestTemplate's default UriComponentsBuilder does not re-encode
            // the '%' characters (e.g. %20 -> %2520). Mirrors the previous behaviour
            // the course-map image fetcher relied on for already-encoded paths.
            if (url.indexOf('%') >= 0) {
                return transport.exchange(URI.create(url), method, requestEntity, responseType);
            }
            return transport.exchange(url, method, requestEntity, responseType);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    /** A hop is allowed only when it passes the literal URL checks and resolves to public addresses. */
    private boolean isHopAllowed(String url) {
        String validated;
        try {
            validated = SafeUrlValidator.validateHttpUrlOrNull(url, MAX_URL_LENGTH, "url");
        } catch (IllegalArgumentException ex) {
            return false;
        }
        if (validated == null) {
            return false;
        }
        return isResolvedAddressAllowed(validated);
    }

    private static String redirectLocation(ResponseEntity<?> response) {
        HttpStatus status = HttpStatus.resolve(response.getStatusCode().value());
        if (status == null || !status.is3xxRedirection()) {
            return null;
        }
        return response.getHeaders().getFirst(HttpHeaders.LOCATION);
    }

    private static boolean methodChangesToGet(HttpStatusCode status) {
        int code = status.value();
        return code == 301 || code == 302 || code == 303;
    }

    /** Resolve a possibly-relative redirect target against the hop that produced it. */
    private static String resolveRedirectTarget(String currentUrl, String location) {
        if (location == null || location.isBlank()) {
            return null;
        }
        try {
            URI base = new URI(currentUrl);
            URI next = base.resolve(location.trim());
            if (!next.isAbsolute()) {
                return null;
            }
            return next.toString();
        } catch (URISyntaxException ex) {
            return null;
        }
    }

    /**
     * Copy of the given template whose {@link HttpURLConnection} transport has
     * automatic redirect following disabled. Timeouts mirror the shared
     * primary RestTemplate bean in WebConfig (5 s connect / 5 s read); the
     * getters needed to copy them portably only exist on newer Spring
     * versions, and every SafeUrlExecutor consumer uses that primary bean.
     * Returns null when the factory is not a {@link SimpleClientHttpRequestFactory}
     * (e.g. Mockito mocks in tests) so the injected template keeps being used.
     */
    private static RestTemplate copyWithoutAutoRedirects(RestTemplate source) {
        if (source == null) {
            return null;
        }
        try {
            ClientHttpRequestFactory factory = source.getRequestFactory();
            if (!(factory instanceof SimpleClientHttpRequestFactory)) {
                return null;
            }
            SimpleClientHttpRequestFactory noRedirects = new SimpleClientHttpRequestFactory() {
                @Override
                protected void prepareConnection(HttpURLConnection connection, String httpMethod) throws IOException {
                    super.prepareConnection(connection, httpMethod);
                    connection.setInstanceFollowRedirects(false);
                }
            };
            noRedirects.setConnectTimeout(5_000);
            noRedirects.setReadTimeout(5_000);
            return new RestTemplate(noRedirects);
        } catch (Exception ex) {
            return null;
        }
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
