package com.hermes.backend;

import org.apache.hc.client5.http.DnsResolver;
import org.apache.hc.client5.http.SystemDefaultDnsResolver;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.util.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.time.Duration;
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
     * Transport with automatic redirects disabled and public-only DNS enforced
     * by the connection manager. Test-only executors leave this null and use
     * their explicitly injected mock transport instead.
     */
    private final RestTemplate redirectSafeRestTemplate;

    @Autowired
    public SafeUrlExecutor(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
        this.resolveDns = true;
        this.redirectSafeRestTemplate = createPinnedPublicTransport(restTemplate);
        if (this.redirectSafeRestTemplate == null) {
            throw new IllegalStateException("Safe URL transport could not be initialized.");
        }
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
     * @return the {@link ResponseEntity}, or {@code null} if any hop resolves
     *         to a disallowed address or is otherwise unfetchable.
     */
    public <T> ResponseEntity<T> exchange(String url, HttpMethod method, HttpEntity<?> requestEntity, Class<T> responseType) {
        RestTemplate transport = resolveDns ? redirectSafeRestTemplate : restTemplate;
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
                // The transport revalidates the resolved address at connection time.
                // codeql[java/ssrf]
                return transport.exchange(URI.create(url), method, requestEntity, responseType);
            }
            // The transport revalidates the resolved address at connection time.
            // codeql[java/ssrf]
            return transport.exchange(url, method, requestEntity, responseType);
        } catch (IllegalArgumentException | RestClientException ignored) {
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
     * Builds a transport that validates DNS results at connection time, closing
     * the preflight-to-connect DNS rebinding window. It is only derived from the
     * application's normal simple transport; Mockito and custom test factories
     * continue through the injected template.
     */
    private static RestTemplate createPinnedPublicTransport(RestTemplate source) {
        if (source == null) {
            return null;
        }
        try {
            ClientHttpRequestFactory factory = source.getRequestFactory();
            if (!(factory instanceof SimpleClientHttpRequestFactory)) {
                return null;
            }
            ConnectionConfig connectionConfig = ConnectionConfig.custom()
                    .setConnectTimeout(Timeout.ofSeconds(5))
                    .setSocketTimeout(Timeout.ofSeconds(5))
                    .build();
            var connectionManager = PoolingHttpClientConnectionManagerBuilder.create()
                    .setDnsResolver(new PublicAddressDnsResolver(SystemDefaultDnsResolver.INSTANCE))
                    .setDefaultConnectionConfig(connectionConfig)
                    .build();
            var httpClient = HttpClients.custom()
                    .setConnectionManager(connectionManager)
                    .disableRedirectHandling()
                    .build();
            HttpComponentsClientHttpRequestFactory pinnedFactory =
                    new HttpComponentsClientHttpRequestFactory(httpClient);
            pinnedFactory.setConnectionRequestTimeout(Duration.ofSeconds(5));
            pinnedFactory.setReadTimeout(Duration.ofSeconds(5));
            return new RestTemplate(pinnedFactory);
        } catch (Exception ex) {
            return null;
        }
    }

    /** DNS resolver used by the actual HTTP connection, not only preflight checks. */
    static final class PublicAddressDnsResolver implements DnsResolver {
        private final DnsResolver delegate;

        PublicAddressDnsResolver(DnsResolver delegate) {
            this.delegate = delegate;
        }

        @Override
        public InetAddress[] resolve(String host) throws UnknownHostException {
            InetAddress[] addresses = delegate.resolve(host);
            if (addresses == null || addresses.length == 0) {
                throw new UnknownHostException("Host returned no addresses.");
            }
            for (InetAddress address : addresses) {
                if (!isPublicAddress(address)) {
                    throw new UnknownHostException("Host resolved to a non-public address.");
                }
            }
            return addresses;
        }

        @Override
        public String resolveCanonicalHostname(String host) {
            return host;
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
        return !isReservedAddressRange(address.getAddress())
                && !address.isAnyLocalAddress()
                && !address.isLoopbackAddress()
                && !address.isLinkLocalAddress()
                && !address.isSiteLocalAddress()
                && !address.isMulticastAddress();
    }

    private static boolean isReservedAddressRange(byte[] bytes) {
        if (bytes == null) {
            return true;
        }
        if (bytes.length == 4) {
            int first = bytes[0] & 0xff;
            int second = bytes[1] & 0xff;
            int third = bytes[2] & 0xff;
            return first == 0
                    || first == 100 && second >= 64 && second <= 127
                    || first == 192 && second == 0 && third == 0
                    || first == 192 && second == 0 && third == 2
                    || first == 198 && (second == 18 || second == 19)
                    || first == 198 && second == 51 && third == 100
                    || first == 203 && second == 0 && third == 113
                    || first >= 240;
        }
        if (bytes.length == 16) {
            int first = bytes[0] & 0xff;
            return (first & 0xfe) == 0xfc;
        }
        return true;
    }
}
