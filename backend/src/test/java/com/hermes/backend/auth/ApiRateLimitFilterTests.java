package com.hermes.backend.auth;

import jakarta.servlet.FilterChain;
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
