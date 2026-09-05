package com.hermes.backend.auth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

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
        HttpsEnforcementFilter filter = productionFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/health/details");
        request.setServerName("healthcheck.railway.app");
        request.setServerPort(8080);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(301, response.getStatus());
        assertEquals("https://healthcheck.railway.app:8080/internal/health/details", response.getHeader("Location"));
    }

    private static HttpsEnforcementFilter productionFilter() {
        HttpsEnforcementFilter filter = new HttpsEnforcementFilter();
        ReflectionTestUtils.setField(filter, "environment", "production");
        ReflectionTestUtils.setField(filter, "forceHttps", true);
        return filter;
    }
}
