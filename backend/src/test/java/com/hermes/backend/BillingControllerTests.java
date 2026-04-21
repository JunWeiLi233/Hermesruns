package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BillingControllerTests {

    @Test
    void billingConfigReturnsPublicFlagsAndTrimmedPriceLabel() {
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        
        Map<String, Object> billing = new HashMap<>();
        billing.put("checkoutConfigured", true);
        billing.put("provider", "stripe");
        billing.put("priceLabel", "$12.00");
        
        Map<String, Object> publicStatus = new HashMap<>();
        publicStatus.put("billing", billing);
        
        when(systemConfigService.getPublicConfigStatus()).thenReturn(publicStatus);

        BillingController controller = new BillingController(
                null, null, null, null, null, null,
                systemConfigService, null, null
        );

        Map<String, Object> config = controller.billingConfig();

        assertThat(config).isNotNull();
        assertThat(config.get("checkoutConfigured")).isEqualTo(true);
        assertThat(config.get("provider")).isEqualTo("stripe");
        assertThat(config.get("priceLabel")).isEqualTo("$12.00");
    }
}
