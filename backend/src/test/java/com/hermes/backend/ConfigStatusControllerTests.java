package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ConfigStatusControllerTests {

    @Test
    void publicStatusDelegatesToSystemConfigServiceWhenAuthenticated() {
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        AuthService authService = mock(AuthService.class);
        ConfigStatusController controller = new ConfigStatusController(systemConfigService, authService);

        Runner runner = new Runner();
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));

        Map<String, Object> expected = new LinkedHashMap<>();
        expected.put("googleConfigured", true);
        when(systemConfigService.getPublicConfigStatus()).thenReturn(expected);

        ResponseEntity<Map<String, Object>> response = controller.getPublicStatus("Bearer token");

        assertEquals(200, response.getStatusCode().value());
        assertSame(expected, response.getBody());
    }

    @Test
    void publicStatusReturns401WhenUnauthenticated() {
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        AuthService authService = mock(AuthService.class);
        ConfigStatusController controller = new ConfigStatusController(systemConfigService, authService);

        when(authService.findByAuthorizationHeader(anyString())).thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> response = controller.getPublicStatus("Bearer invalid");

        assertEquals(401, response.getStatusCode().value());
    }

    @Test
    void adminStatusDelegatesToSystemConfigServiceWhenAdmin() {
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        AuthService authService = mock(AuthService.class);
        ConfigStatusController controller = new ConfigStatusController(systemConfigService, authService);

        Runner runner = new Runner();
        when(authService.findByAuthorizationHeader("Bearer admin-token")).thenReturn(Optional.of(runner));
        when(authService.isAdmin(runner)).thenReturn(true);

        Map<String, Object> expected = new LinkedHashMap<>();
        expected.put("googleConfigured", true);
        when(systemConfigService.getAdminConfigStatus()).thenReturn(expected);

        ResponseEntity<Map<String, Object>> response = controller.getAdminStatus("Bearer admin-token");

        assertEquals(200, response.getStatusCode().value());
        assertSame(expected, response.getBody());
    }

    @Test
    void adminStatusReturns403WhenNotAdmin() {
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        AuthService authService = mock(AuthService.class);
        ConfigStatusController controller = new ConfigStatusController(systemConfigService, authService);

        Runner runner = new Runner();
        when(authService.findByAuthorizationHeader("Bearer user-token")).thenReturn(Optional.of(runner));
        when(authService.isAdmin(runner)).thenReturn(false);

        ResponseEntity<Map<String, Object>> response = controller.getAdminStatus("Bearer user-token");

        assertEquals(403, response.getStatusCode().value());
    }
}
