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
    void unifiedStatusDelegatesToSystemConfigService() {
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        ConfigStatusController controller = new ConfigStatusController(systemConfigService);

        Map<String, Object> expected = new LinkedHashMap<>();
        expected.put("googleConfigured", true);
        expected.put("stravaConfigured", false);
        expected.put("aiConfigured", true);
        expected.put("billingCheckoutConfigured", false);
        when(systemConfigService.getUnifiedConfigStatus()).thenReturn(expected);

        Map<String, Object> response = controller.getUnifiedStatus();

        assertSame(expected, response);
        verify(systemConfigService).getUnifiedConfigStatus();
    }

    @Test
    void unifiedStatusCanReturnNestedNoSecretsSnapshot() {
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        ConfigStatusController controller = new ConfigStatusController(systemConfigService);

        Map<String, Object> strava = new LinkedHashMap<>();
        strava.put("configured", false);
        strava.put("clientIdPresent", true);
        strava.put("clientSecretPresent", false);
        strava.put("reason", "STRAVA_CLIENT_SECRET is missing/blank.");

        Map<String, Object> ai = new LinkedHashMap<>();
        ai.put("configured", true);
        ai.put("provider", "openai");
        ai.put("model", "gpt-5.4");

        Map<String, Object> status = new LinkedHashMap<>();
        status.put("googleConfigured", true);
        status.put("stravaConfigured", false);
        status.put("aiConfigured", true);
        status.put("billingCheckoutConfigured", false);
        status.put("strava", strava);
        status.put("ai", ai);

        when(systemConfigService.getUnifiedConfigStatus()).thenReturn(status);

        Map<String, Object> response = controller.getUnifiedStatus();

        assertEquals(false, response.get("billingCheckoutConfigured"));
        assertTrue(response.containsKey("strava"));
        assertTrue(response.containsKey("ai"));
        @SuppressWarnings("unchecked")
        Map<String, Object> returnedStrava = (Map<String, Object>) response.get("strava");
        assertEquals(true, returnedStrava.get("clientIdPresent"));
        assertEquals(false, returnedStrava.get("clientSecretPresent"));
        assertTrue(returnedStrava.containsKey("reason"));
    }
}
