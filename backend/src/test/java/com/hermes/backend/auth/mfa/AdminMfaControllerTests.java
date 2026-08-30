package com.hermes.backend.auth.mfa;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

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
}
