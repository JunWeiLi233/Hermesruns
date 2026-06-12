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
                .andExpect(content().string(org.hamcrest.Matchers.containsString("<!DOCTYPE html>")));
    }

    @Test
    void shoeCatalogRouteServesSpaShell() throws Exception {
        mockMvc.perform(get("/shoe-catalog"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("<!DOCTYPE html>")));
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
    void dashboardChildRoutesServeSpaShellOnRefresh(String path) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("<!DOCTYPE html>")));
    }

    @Test
    void missingStaticResourceReturns404InsteadOfServerError() throws Exception {
        mockMvc.perform(get("/missing-static-resource.txt"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Not found"));
    }

    @Test
    void missingHashedCssAssetReturnsPlain404InsteadOfJson() throws Exception {
        mockMvc.perform(get("/assets/index-stale.css"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_PLAIN))
                .andExpect(content().string("Not found"));
    }
}
