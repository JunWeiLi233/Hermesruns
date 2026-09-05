package com.hermes.backend.auth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HttpsEnforcementFilterTests {

    @Test
    void railwayRootHealthProbeReturnsOkWithoutChangingThePublicHomeRoute() throws Exception {
        HttpsEnforcementFilter filter = productionFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/");
        request.setServerName("healthcheck.railway.app");
        request.setServerPort(8080);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(200, response.getStatus());
        assertEquals("application/json", response.getContentType());
        assertEquals("{\"status\":\"ok\"}", response.getContentAsString());
        assertNull(response.getHeader("Location"));
    }

    @Test
    void internalHealthProbeReturnsOkWithoutHttpsRedirectInProduction() throws Exception {
        HttpsEnforcementFilter filter = productionFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/health");
        request.setServerName("healthcheck.railway.app");
        request.setServerPort(8080);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(200, response.getStatus());
        assertEquals("application/json", response.getContentType());
        assertEquals("{\"status\":\"ok\"}", response.getContentAsString());
        assertNull(response.getHeader("Location"));
    }

    @Test
    void similarlyNamedHttpPathStillRequiresHttps() throws Exception {
        HttpsEnforcementFilter filter = productionFilter("https://healthcheck.railway.app:8080");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/health/details");
        request.setServerName("healthcheck.railway.app");
        request.setServerPort(8080);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(301, response.getStatus());
        assertEquals("https://healthcheck.railway.app:8080/internal/health/details", response.getHeader("Location"));
    }

    @Test
    void httpsRedirectUsesConfiguredPublicBaseUrlNotClientHostHeader() throws Exception {
        HttpsEnforcementFilter filter = productionFilter("https://app.hermesruns.com");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/profile");
        request.setServerName("evil.example");
        request.setServerPort(443);
        request.addHeader("Host", "evil.example");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(301, response.getStatus());
        assertEquals("https://app.hermesruns.com/profile", response.getHeader("Location"));
    }

    @Test
    void protocolRelativePathFallsBackToRootOnConfiguredHost() throws Exception {
        HttpsEnforcementFilter filter = productionFilter("https://app.hermesruns.com");
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setMethod("GET");
        request.setServerName("app.hermesruns.com");
        request.setServerPort(443);
        request.setRequestURI("//evil.example/phish");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(301, response.getStatus());
        assertEquals("https://app.hermesruns.com/", response.getHeader("Location"));
    }

    @Test
    void missingPublicBaseUrlRejectsInsteadOfRedirecting() throws Exception {
        HttpsEnforcementFilter filter = productionFilter("");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/profile");
        request.setServerName("app.hermesruns.com");
        request.setServerPort(443);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(400, response.getStatus());
        assertNull(response.getHeader("Location"));
        assertTrue(response.getContentAsString().contains("HTTPS required"));
    }

    @Test
    void sanitizeLocalPathRejectsSchemeBearingValues() {
        assertEquals("/", HttpsEnforcementFilter.sanitizeLocalPath("https://evil.example/x"));
        assertEquals("/", HttpsEnforcementFilter.sanitizeLocalPath("//evil.example/x"));
        assertEquals("/safe", HttpsEnforcementFilter.sanitizeLocalPath("/safe"));
    }

    private static HttpsEnforcementFilter productionFilter() {
        return productionFilter("https://app.hermesruns.com");
    }

    private static HttpsEnforcementFilter productionFilter(String publicBaseUrl) {
        HttpsEnforcementFilter filter = new HttpsEnforcementFilter();
        ReflectionTestUtils.setField(filter, "environment", "production");
        ReflectionTestUtils.setField(filter, "forceHttps", true);
        ReflectionTestUtils.setField(filter, "publicBaseUrl", publicBaseUrl);
        return filter;
    }
}
