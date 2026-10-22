package com.hermes.backend.auth;

import com.hermes.backend.runner.Runner;
import jakarta.servlet.FilterChain;
import java.util.Map;
import java.util.Optional;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class ApiRateLimitFilterTests {
    @Test
    void changingResourceIdsCannotBypassActivityWriteLimit() throws Exception {
        ApiRateLimitFilter filter = new ApiRateLimitFilter(new ApiRateLimiter(), mock(AuthService.class));
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse last = null;
        for (int i = 0; i < 121; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("DELETE", "/api/activities/" + i);
            request.setRemoteAddr("192.0.2.1");
            last = new MockHttpServletResponse();
            filter.doFilter(request, last, chain);
        }
        assertThat(last.getStatus()).isEqualTo(429);
        assertThat(last.getHeader("Retry-After")).isEqualTo("60");
    }

    @Test
    void activityReadsStillStopAtTheProductionDefaultAcrossChangingNetworkAddresses() throws Exception {
        AuthService auth = mock(AuthService.class);
        Runner owner = new Runner(); owner.setId(71L);
        when(auth.findByAuthorizationHeader("Bearer owner")).thenReturn(Optional.of(owner));
        ApiRateLimitFilter filter = new ApiRateLimitFilter(new ApiRateLimiter(), auth);
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse last = activityReads(filter, chain, 181);
        assertThat(last.getStatus()).isEqualTo(429);
        verify(chain, times(180)).doFilter(any(), any());
    }

    @Test
    void authReadsStillStopAtNinetyAcrossChangingAddressesPathsAndReadMethods() throws Exception {
        AuthService auth = mock(AuthService.class);
        Runner owner = new Runner(); owner.setId(71L);
        when(auth.findByAuthorizationHeader("Bearer owner")).thenReturn(Optional.of(owner));
        ApiRateLimitFilter filter = new ApiRateLimitFilter(new ApiRateLimiter(), auth);
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse last = authReads(filter, chain, 91, false);
        assertThat(last.getStatus()).isEqualTo(429);
        assertThat(last.getHeader("Retry-After")).isEqualTo("60");
        verify(chain, times(90)).doFilter(any(), any());
    }

    @Test
    void isolatedAuthReadOverrideDoesNotRaiseAuthWritesNetworkReadsCheckoutOrActivityWrites() throws Exception {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("isolated-browser-fixture", Map.of(
                    "app.api.rate-limit.auth-read-user-per-minute", "10000",
                    "app.api.rate-limit.activity-read-user-per-minute", "10000",
                    "app.api.rate-limit.global-user-per-minute", "10000")));
            AuthService auth = mock(AuthService.class);
            Runner owner = new Runner(); owner.setId(71L);
            when(auth.findByAuthorizationHeader("Bearer owner")).thenReturn(Optional.of(owner));
            context.registerBean(AuthService.class, () -> auth);
            context.registerBean(ApiRateLimiter.class, () -> new ApiRateLimiter());
            context.registerBean(ApiRateLimitFilter.class);
            context.refresh();
            ApiRateLimitFilter filter = context.getBean(ApiRateLimitFilter.class);
            FilterChain chain = mock(FilterChain.class);
            assertThat(authReads(filter, chain, 200, false).getStatus()).isEqualTo(200);
            verify(chain, times(200)).doFilter(any(), any());

            MockHttpServletResponse authWrite = null;
            for (int i = 0; i < 76; i++) {
                authWrite = request(filter, chain, "POST", "/api/auth/strava/auto-sync", "203.0.113." + (i + 1));
            }
            assertThat(authWrite.getStatus()).isEqualTo(429);
            verify(chain, times(275)).doFilter(any(), any());
            assertThat(authReads(filter, chain, 61, true).getStatus()).isEqualTo(429);
            verify(chain, times(335)).doFilter(any(), any());

            MockHttpServletResponse checkout = null;
            for (int i = 0; i < 6; i++) {
                checkout = request(filter, chain, "POST", "/api/billing/checkout", "192.0.2.21");
            }
            assertThat(checkout.getStatus()).isEqualTo(429);
            verify(chain, times(340)).doFilter(any(), any());
            MockHttpServletResponse activityWrite = null;
            for (int i = 0; i < 121; i++) {
                activityWrite = request(filter, chain, "PATCH", "/api/activities/" + i, "192.0.2.22");
            }
            assertThat(activityWrite.getStatus()).isEqualTo(429);
            verify(chain, times(460)).doFilter(any(), any());
        }
    }

    private static MockHttpServletResponse authReads(ApiRateLimitFilter filter, FilterChain chain, int count, boolean sameIp) throws Exception {
        MockHttpServletResponse last = null;
        for (int i = 0; i < count; i++) {
            String method = i % 2 == 0 ? "GET" : "HEAD";
            String route = i % 2 == 0 ? "/api/auth/strava/auto-sync" : "/api/auth/protected/ping";
            last = request(filter, chain, method, route, sameIp ? "192.0.2.20" : "203.0.113." + (i + 1));
        }
        return last;
    }

    private static MockHttpServletResponse request(ApiRateLimitFilter filter, FilterChain chain, String method, String route, String ip) throws Exception {
        var request = new MockHttpServletRequest(method, route);
        request.setRemoteAddr(ip); request.addHeader("Authorization", "Bearer owner");
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        return response;
    }

    @Test
    void isolatedActivityReadOverrideDoesNotRaiseWriteOrCheckoutLimits() throws Exception {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("isolated-browser-fixture", Map.of(
                    "app.api.rate-limit.activity-read-user-per-minute", "10000",
                    "app.api.rate-limit.global-user-per-minute", "10000")));
            AuthService auth = mock(AuthService.class);
            Runner owner = new Runner(); owner.setId(71L);
            when(auth.findByAuthorizationHeader("Bearer owner")).thenReturn(Optional.of(owner));
            context.registerBean(AuthService.class, () -> auth);
            context.registerBean(ApiRateLimiter.class, () -> new ApiRateLimiter());
            context.registerBean(ApiRateLimitFilter.class);
            context.refresh();
            ApiRateLimitFilter filter = context.getBean(ApiRateLimitFilter.class);
            FilterChain chain = mock(FilterChain.class);
            assertThat(activityReads(filter, chain, 200).getStatus()).isEqualTo(200);
            verify(chain, times(200)).doFilter(any(), any());

            MockHttpServletResponse write = null;
            for (int i = 0; i < 121; i++) {
                var request = new MockHttpServletRequest("PATCH", "/api/activities/" + i);
                request.setRemoteAddr("198.51.100.1"); request.addHeader("Authorization", "Bearer owner");
                write = new MockHttpServletResponse(); filter.doFilter(request, write, chain);
            }
            assertThat(write.getStatus()).isEqualTo(429);
            MockHttpServletResponse checkout = null;
            for (int i = 0; i < 6; i++) {
                var request = new MockHttpServletRequest("POST", "/api/billing/checkout");
                request.setRemoteAddr("198.51.100.2"); request.addHeader("Authorization", "Bearer owner");
                checkout = new MockHttpServletResponse(); filter.doFilter(request, checkout, chain);
            }
            assertThat(checkout.getStatus()).isEqualTo(429);
        }
    }

    private static MockHttpServletResponse activityReads(ApiRateLimitFilter filter, FilterChain chain, int count) throws Exception {
        MockHttpServletResponse last = null;
        for (int i = 0; i < count; i++) {
            var request = new MockHttpServletRequest("GET", "/api/activities/" + i + "/training-metrics");
            request.setRemoteAddr("192.0.2." + (i + 1)); request.addHeader("Authorization", "Bearer owner");
            last = new MockHttpServletResponse(); filter.doFilter(request, last, chain);
        }
        return last;
    }

    @Test
    void checkoutHasDedicatedLimitAndFakeWebhookSuffixIsThrottled() throws Exception {
        ApiRateLimitFilter filter = new ApiRateLimitFilter(new ApiRateLimiter(), mock(AuthService.class));
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse last = null;
        for (int i = 0; i < 6; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/billing/checkout");
            last = new MockHttpServletResponse();
            filter.doFilter(request, last, chain);
        }
        assertThat(last.getStatus()).isEqualTo(429);
        ApiRateLimiter limiter = mock(ApiRateLimiter.class);
        when(limiter.allow(anyString(), anyInt(), anyLong())).thenReturn(false);
        filter = new ApiRateLimitFilter(limiter, mock(AuthService.class));
        last = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("POST", "/api/billing/webhook-fake"), last, chain);
        assertThat(last.getStatus()).isEqualTo(429);
        last = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("POST", "/api/billing/webhook"), last, chain);
        assertThat(last.getStatus()).isEqualTo(200);
    }
}
