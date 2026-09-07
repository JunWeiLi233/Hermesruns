package com.hermes.backend.auth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityHeadersFilterTests {

    @Test
    void cloudflareDetectionNonceIsUnpredictableAndUniquePerResponse() throws Exception {
        SecurityHeadersFilter filter = new SecurityHeadersFilter();
        java.util.Set<String> nonces = new java.util.HashSet<>();
        for (int i = 0; i < 20; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/login");
            request.addHeader("Content-Security-Policy", "script-src 'nonce-attacker'");
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, new MockFilterChain());

            String csp = response.getHeader("Content-Security-Policy");
            java.util.regex.Matcher matcher = java.util.regex.Pattern
                    .compile("'nonce-([A-Za-z0-9+/]+={0,2})'").matcher(csp);
            assertThat(matcher.find()).as("Cloudflare needs a response-header nonce").isTrue();
            String nonce = matcher.group(1);
            assertThat(java.util.Base64.getDecoder().decode(nonce)).hasSizeGreaterThanOrEqualTo(16);
            assertThat(nonces.add(nonce)).as("Never reuse a nonce across responses").isTrue();
            assertThat(csp).doesNotContain("nonce-attacker");
        }
    }

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
