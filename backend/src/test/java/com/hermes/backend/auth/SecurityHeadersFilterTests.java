package com.hermes.backend.auth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityHeadersFilterTests {

    @Test
    void contentSecurityPolicyAllowsBlobImagesForLocalPreviewUrls() throws Exception {
        SecurityHeadersFilter filter = new SecurityHeadersFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        String csp = response.getHeader("Content-Security-Policy");
        assertThat(csp).isNotBlank();
        assertThat(csp).contains("img-src");
        assertThat(csp).contains("blob:");
    }

    @Test
    void contentSecurityPolicyBlocksInlineScripts() throws Exception {
        SecurityHeadersFilter filter = new SecurityHeadersFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        String csp = response.getHeader("Content-Security-Policy");
        String scriptSrc = csp.substring(csp.indexOf("script-src"), csp.indexOf("style-src"));
        assertThat(scriptSrc).doesNotContain("'unsafe-inline'");
        assertThat(scriptSrc).doesNotContain("'unsafe-eval'");
    }

    @Test
    void contentSecurityPolicyAllowsRecaptchaAssetsUsedBySignup() throws Exception {
        SecurityHeadersFilter filter = new SecurityHeadersFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/signup");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        String csp = response.getHeader("Content-Security-Policy");
        assertThat(csp).contains("script-src");
        assertThat(csp).contains("https://www.google.com/recaptcha/");
        assertThat(csp).contains("https://www.gstatic.com/recaptcha/");
        assertThat(csp).contains("frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/");
        assertThat(csp).contains("connect-src");
        assertThat(csp).contains("https://www.google.com/recaptcha/");
    }

    @Test
    void contentSecurityPolicyAllowsMuscleTrainingYoutubeEmbeds() throws Exception {
        SecurityHeadersFilter filter = new SecurityHeadersFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/muscle-training");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        String csp = response.getHeader("Content-Security-Policy");
        assertThat(csp).contains("frame-src");
        assertThat(csp).contains("https://www.youtube-nocookie.com");
    }

    @Test
    void securityHeadersSupportInsightsAndCrossOriginIsolation() throws Exception {
        SecurityHeadersFilter filter = new SecurityHeadersFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getHeader("Cross-Origin-Opener-Policy")).isEqualTo("same-origin");
        assertThat(response.getHeader("Content-Security-Policy"))
                .contains("https://static.cloudflareinsights.com")
                .contains("https://cloudflareinsights.com");
    }
}
