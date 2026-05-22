package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BillingControllerTests {

    @Test
    void billingConfigReturnsPublicFlagsWhenAuthenticated() {
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        AuthService authService = mock(AuthService.class);
        
        Map<String, Object> billing = new HashMap<>();
        billing.put("checkoutConfigured", true);
        billing.put("provider", "stripe");
        
        Map<String, Object> publicStatus = new HashMap<>();
        publicStatus.put("billing", billing);
        
        when(systemConfigService.getPublicConfigStatus()).thenReturn(publicStatus);

        Runner runner = new Runner();
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));

        BillingController controller = new BillingController(
                authService, null, null, null, null, null,
                null, null, null,
                systemConfigService
        );

        ResponseEntity<Map<String, Object>> response = controller.billingConfig("Bearer token");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        Map<String, Object> config = response.getBody();
        assertThat(config).isNotNull();
        assertThat(config.get("checkoutConfigured")).isEqualTo(true);
        assertThat(config.get("provider")).isEqualTo("stripe");
    }

    @Test
    void billingConfigReturns401WhenUnauthenticated() {
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        AuthService authService = mock(AuthService.class);

        when(authService.findByAuthorizationHeader("Bearer invalid")).thenReturn(Optional.empty());

        BillingController controller = new BillingController(
                authService, null, null, null, null, null,
                null, null, null,
                systemConfigService
        );

        ResponseEntity<Map<String, Object>> response = controller.billingConfig("Bearer invalid");

        assertThat(response.getStatusCode().value()).isEqualTo(401);
    }
}
