package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SpaForwardingControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void muscleTrainingRouteServesSpaShell() throws Exception {
        mockMvc.perform(get("/muscle-training"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("<!DOCTYPE html>")))
                .andExpect(header().string("X-Robots-Tag", "noindex, nofollow, noarchive"));
    }

    @Test
    void shoeCatalogRouteServesSpaShell() throws Exception {
        mockMvc.perform(get("/shoe-catalog"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("<!DOCTYPE html>")))
                .andExpect(header().string("X-Robots-Tag", "noindex, nofollow, noarchive"));
    }

    @Test
    void runDetailDeepLinkServesSpaShell() throws Exception {
        // /runs/{id} is the canonical activity deep link (buildRunDetailPath); refreshing
        // or sharing it must serve the SPA shell anonymously, not the JSON 401 entry point.
        mockMvc.perform(get("/runs/1857"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("<!DOCTYPE html>")))
                .andExpect(header().string("X-Robots-Tag", "noindex, nofollow, noarchive"));
    }

    @Test
    void legalRouteRemainsIndexable() throws Exception {
        mockMvc.perform(get("/privacy"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("X-Robots-Tag"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/admin", "/admin/"})
    void adminLoginRoutesAreConcealedWithoutAdminSession(String path) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isNotFound());
    }

    @Test
    void unknownNonAssetPathIsUnauthorizedNotAServerError() throws Exception {
        // Secure by default: a root-level path that is neither an SPA route nor a static
        // asset no longer falls through permitAll — anonymous callers get the JSON 401
        // entry point instead of a 404/500 (still never a server error).
        mockMvc.perform(get("/missing-static-resource.txt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid or expired session token."));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/dashboard/users",
            "/dashboard/course-maps",
            "/dashboard/shoes",
            "/dashboard/jobs",
            "/dashboard/audit",
            "/dashboard/settings"
    })
    void dashboardChildRoutesAreConcealedWithoutAdminPortalSession(String path) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isNotFound());
    }

    @Test
    void missingHashedCssAssetReturnsPlain404InsteadOfJson() throws Exception {
        mockMvc.perform(get("/assets/index-stale.css"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_PLAIN))
                .andExpect(content().string("Not found"));
    }
}
