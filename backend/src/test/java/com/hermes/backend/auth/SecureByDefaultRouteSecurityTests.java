package com.hermes.backend.auth;

import com.hermes.backend.infrastructure.web.SpaForwardingController;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * SecurityConfig is secure by default: every non-/api request that is not an SPA route
 * (SpaForwardingController.SPA_ROUTES) or a static asset requires authentication.
 * These tests boot the real security filter chain and assert the SPA keeps loading
 * anonymously while unknown routes are rejected, and that CORS preflights on /api/**
 * pass without credentials. CORS is enabled for this suite via the documented
 * APP_CORS_ALLOWED_ORIGINS property to exercise the cross-origin deployment mode.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.cors.allowed-origins=https://app.hermes.test")
class SecureByDefaultRouteSecurityTests {

    @Autowired
    private MockMvc mockMvc;

    static List<String> spaRoutes() {
        return SpaForwardingController.SPA_ROUTES.stream()
                .filter(route -> !route.startsWith("/dashboard"))
                .filter(route -> !route.startsWith("/admin"))
                .filter(route -> !"/workflows".equals(route))
                .toList();
    }

    @Test
    void unknownNonApiPathIsUnauthorizedWhenAnonymous() throws Exception {
        mockMvc.perform(get("/definitely-not-a-route"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.error").value("Invalid or expired session token."));
    }

    @Test
    void spaRouteListCoversCoreAppRoutes() {
        // Canary: the derived route list must keep covering the core navigation routes
        // (and stay substantial) so a trimmed annotation cannot silently lock users out.
        assertThat(SpaForwardingController.SPA_ROUTES)
                .contains("/", "/login", "/dashboard", "/races", "/settings")
                .hasSizeGreaterThanOrEqualTo(30);
    }

    @ParameterizedTest
    @MethodSource("spaRoutes")
    void everySpaRouteServesTheShellAnonymously(String route) throws Exception {
        // Expand URI-template routes with sample path segments that satisfy each variable's
        // regex constraint ([^.]+ excludes dots, so plain words are safe for all of them).
        String path = route
                .replace("{section:[^.]+}", "settings")
                .replace("{detail:[^.]+}", "general")
                .replace("{id:[^.]+}", "123")
                .replace("{id}", "123")
                .replace("{insightKey}", "cadence")
                .replace("{distKey}", "10k")
                .replace("{raceId}", "42");

        mockMvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(containsString("<!DOCTYPE html>")));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/admin", "/admin/",
            "/dashboard", "/dashboard/users", "/dashboard/audit/log/42", "/workflows"
    })
    void adminPortalRoutesAreConcealedFromAnonymousRequests(String path) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isNotFound())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));
    }

    @Test
    void corsPreflightOnApiPassesWithoutCredentials() throws Exception {
        mockMvc.perform(options("/api/activities")
                        .header(HttpHeaders.ORIGIN, "https://app.hermes.test")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "https://app.hermes.test"));

        // Plain OPTIONS (no CORS headers) may be 405/500, but must never be a 401 auth block.
        MvcResult plainOptions = mockMvc.perform(options("/api/activities")).andReturn();
        assertThat(plainOptions.getResponse().getStatus()).isNotEqualTo(401);

        // The preflight permit must not open the actual endpoint: real requests stay authenticated.
        mockMvc.perform(get("/api/activities"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void errorDispatchStaysReachableAnonymously() throws Exception {
        // /error is explicitly permitted so anonymous error paths never 401-loop or mask
        // the real error response; Boot's BasicErrorController answers with its JSON page.
        MvcResult result = mockMvc.perform(get("/error").accept(MediaType.APPLICATION_JSON)).andReturn();
        assertThat(result.getResponse().getStatus())
                .as("anonymous GET /error must not be blocked by authentication")
                .isNotEqualTo(401);
        assertThat(result.getResponse().getContentType()).contains("json");
    }

    @Test
    void staticAssetsStayAccessibleAnonymously() throws Exception {
        mockMvc.perform(get("/favicon.ico"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/index.html"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML));

        mockMvc.perform(get("/assets/auth-policy-probe.css"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Test-only resource for anonymous static-asset authorization")));
    }
}
