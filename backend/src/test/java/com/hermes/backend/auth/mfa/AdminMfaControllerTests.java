package com.hermes.backend.auth.mfa;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminMfaControllerTests {

    @Test
    void reportsMissingBootstrapConfigurationSeparatelyFromChallengeFailure() {
        AdminMfaService service = mock(AdminMfaService.class);
        AdminMfaController controller = new AdminMfaController(service, new ObjectMapper());
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/admin-mfa/registration/options");
        request.addHeader("Origin", "http://localhost:8080");
        request.setCookies(new Cookie(AdminMfaChallengeCookie.NAME, "selector"));
        when(service.isAllowedRequestOrigin("http://localhost:8080")).thenReturn(true);
        when(service.registrationOptions("selector", "bootstrap-token"))
                .thenThrow(new AdminMfaException("Admin MFA setup is unavailable."));

        ResponseEntity<?> response = controller.registrationOptions(
                Map.of("bootstrapToken", "bootstrap-token"), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).isEqualTo(Map.of(
                "error", "Admin MFA setup is unavailable.",
                "code", "ADMIN_MFA_SETUP_UNAVAILABLE"
        ));
    }

    @Test
    void writesPasskeyOptionsAsTheWebAuthnJsonDocument() throws Exception {
        AdminMfaService service = mock(AdminMfaService.class);
        when(service.isAllowedRequestOrigin("http://localhost:8080")).thenReturn(true);
        when(service.registrationOptions("selector", "bootstrap-token"))
                .thenReturn("{\"publicKey\":{\"challenge\":\"abc\",\"rp\":{\"id\":\"localhost\"}}}");
        when(service.authenticationOptions("selector"))
                .thenReturn("{\"publicKey\":{\"challenge\":\"def\",\"allowCredentials\":[]}}");
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new AdminMfaController(service, new ObjectMapper())).build();

        mvc.perform(post("/api/auth/admin-mfa/registration/options")
                        .header("Origin", "http://localhost:8080")
                        .cookie(new Cookie(AdminMfaChallengeCookie.NAME, "selector"))
                        .contentType("application/json")
                        .content("{\"bootstrapToken\":\"bootstrap-token\"}"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.publicKey.challenge").value("abc"))
                .andExpect(jsonPath("$.containerNode").doesNotExist());

        mvc.perform(post("/api/auth/admin-mfa/authentication/options")
                        .header("Origin", "http://localhost:8080")
                        .cookie(new Cookie(AdminMfaChallengeCookie.NAME, "selector")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publicKey.challenge").value("def"))
                .andExpect(jsonPath("$.containerNode").doesNotExist());
    }
}
