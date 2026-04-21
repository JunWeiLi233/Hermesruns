package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ConfigStatusControllerTests {

    @Test
    void publicStatusDelegatesToSystemConfigService() {
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        ConfigStatusController controller = new ConfigStatusController(systemConfigService);

        Map<String, Object> expected = new LinkedHashMap<>();
        expected.put("googleConfigured", true);
        expected.put("stravaConfigured", false);
        expected.put("aiConfigured", true);
        expected.put("billingCheckoutConfigured", false);
        when(systemConfigService.getPublicConfigStatus()).thenReturn(expected);

        Map<String, Object> response = controller.getPublicStatus();

        assertSame(expected, response);
        verify(systemConfigService).getPublicConfigStatus();
    }

    @Test
    void adminStatusDelegatesToSystemConfigService() {
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        ConfigStatusController controller = new ConfigStatusController(systemConfigService);

        Map<String, Object> expected = new LinkedHashMap<>();
        expected.put("googleConfigured", true);
        expected.put("stravaConfigured", true);
        when(systemConfigService.getAdminConfigStatus()).thenReturn(expected);

        Map<String, Object> response = controller.getAdminStatus();

        assertSame(expected, response);
        verify(systemConfigService).getAdminConfigStatus();
    }

    @Test
    void publicStatusCanReturnNestedNoSecretsSnapshot() {
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        ConfigStatusController controller = new ConfigStatusController(systemConfigService);

        Map<String, Object> ai = new LinkedHashMap<>();
        ai.put("configured", true);
        ai.put("provider", "openai");
        ai.put("model", "gpt-5.4");

        Map<String, Object> status = new LinkedHashMap<>();
        status.put("googleConfigured", true);
        status.put("stravaConfigured", false);
        status.put("aiConfigured", true);
        status.put("billingCheckoutConfigured", false);
        status.put("ai", ai);

        when(systemConfigService.getPublicConfigStatus()).thenReturn(status);

        Map<String, Object> response = controller.getPublicStatus();

        assertEquals(false, response.get("billingCheckoutConfigured"));
        assertTrue(response.containsKey("ai"));
        @SuppressWarnings("unchecked")
        Map<String, Object> returnedAi = (Map<String, Object>) response.get("ai");
        assertEquals("openai", returnedAi.get("provider"));
    }
}
