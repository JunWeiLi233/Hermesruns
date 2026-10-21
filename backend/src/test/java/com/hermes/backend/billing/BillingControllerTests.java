package com.hermes.backend.billing;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.infrastructure.config.SystemConfigService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.ArgumentMatchers.any;

class BillingControllerTests {

    @Test
    void repeatedPaidEventGrantsProOnlyOnce() {
        RunnerRepository runners = mock(RunnerRepository.class);
        ProcessedStripeEventRepository events = mock(ProcessedStripeEventRepository.class);
        AiUsageService usage = mock(AiUsageService.class);
        Runner runner = new Runner();
        runner.setId(7L);
        when(runners.findById(7L)).thenReturn(Optional.of(runner));
        when(runners.findByIdForUpdate(7L)).thenReturn(Optional.of(runner));
        // JPA save on an assigned, existing ID merges; it does not raise a duplicate-key error.
        when(events.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        java.util.Set<String> seen = new java.util.HashSet<>();
        when(events.existsById(any())).thenAnswer(call -> seen.contains(call.getArgument(0)));
        when(events.save(any())).thenAnswer(call -> {
            ProcessedStripeEvent row = call.getArgument(0);
            seen.add(row.getId());
            return row;
        });
        BillingController controller = new BillingController(mock(AuthService.class), runners, usage, events,
                "sk_test", "whsec_test", "price_test", "https://example.com", "", mock(SystemConfigService.class), mock(CheckoutSessionService.class));
        Session session = new Session();
        session.setId("cs_paid");
        session.setMode("payment");
        session.setPaymentStatus("paid");
        session.setMetadata(Map.of("runnerId", "7", "months", "1"));
        Event event = mock(Event.class);
        EventDataObjectDeserializer deserializer = mock(EventDataObjectDeserializer.class);
        when(event.getType()).thenReturn("checkout.session.completed");
        when(event.getId()).thenReturn("evt_paid");
        when(event.getDataObjectDeserializer()).thenReturn(deserializer);
        when(deserializer.getObject()).thenReturn(Optional.of(session));
        try (var webhook = mockStatic(Webhook.class)) {
            webhook.when(() -> Webhook.constructEvent("payload", "signature", "whsec_test")).thenReturn(event);
            assertThat(controller.stripeWebhook("payload", "signature").getStatusCode().value()).isEqualTo(200);
            assertThat(controller.stripeWebhook("payload", "signature").getStatusCode().value()).isEqualTo(200);
            when(event.getType()).thenReturn("checkout.session.async_payment_succeeded");
            when(event.getId()).thenReturn("evt_distinct_for_same_session");
            assertThat(controller.stripeWebhook("payload", "signature").getBody()).isEqualTo("duplicate");
        }
        verify(usage, times(1)).grantPro(runner, 1);
    }

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
                systemConfigService, null
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
                systemConfigService, null
        );

        ResponseEntity<Map<String, Object>> response = controller.billingConfig("Bearer invalid");

        assertThat(response.getStatusCode().value()).isEqualTo(401);
    }
}
