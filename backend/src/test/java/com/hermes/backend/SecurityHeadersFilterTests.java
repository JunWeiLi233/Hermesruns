package com.hermes.backend;

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
}
