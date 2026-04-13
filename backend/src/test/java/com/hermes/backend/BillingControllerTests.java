package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BillingControllerTests {

    @Test
    void billingConfigReturnsPublicFlagsAndTrimmedPriceLabel() {
        BillingController controller = createController(true, "  $9.99 / month  ");

        Map<String, Object> response = controller.billingConfig();

        assertThat(response)
                .containsEntry("checkoutConfigured", true)
                .containsEntry("provider", "stripe")
                .containsEntry("priceLabel", "$9.99 / month");
    }

    @Test
    void createCheckoutRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        BillingController controller = createController(authService, true, "$9.99 / month");

        ResponseEntity<?> response = controller.createCheckout(null, Map.of("months", 1));

        assertError(response, HttpStatus.UNAUTHORIZED, "Sign in required.");
    }

    @Test
    void createCheckoutRejectsAdminAccounts() {
        AuthService authService = mock(AuthService.class);
        Runner admin = new Runner();
        admin.setRole("ADMIN");
        when(authService.findByAuthorizationHeader("Bearer admin-token")).thenReturn(Optional.of(admin));
        BillingController controller = createController(authService, true, "$9.99 / month");

        ResponseEntity<?> response = controller.createCheckout("Bearer admin-token", Map.of("months", 1));

        assertError(response, HttpStatus.BAD_REQUEST, "Admin accounts already have unlimited AI usage.");
    }

    @Test
    void createCheckoutRejectsWhenCheckoutIsNotConfigured() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner("USER");
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        BillingController controller = createController(authService, false, "$9.99 / month");

        ResponseEntity<?> response = controller.createCheckout("Bearer runner-token", Map.of("months", 1));

        assertError(response, HttpStatus.SERVICE_UNAVAILABLE, "Online checkout is not configured on this server.");
    }

    @Test
    void createCheckoutRejectsUnexpectedRequestFields() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner("USER");
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        BillingController controller = createController(authService, true, "$9.99 / month");

        ResponseEntity<?> response = controller.createCheckout(
                "Bearer runner-token",
                Map.of("months", 1, "couponCode", "SPRING"));

        assertError(response, HttpStatus.BAD_REQUEST, "Unexpected fields: couponCode");
    }

    @Test
    void createCheckoutRejectsMonthsOutsideAllowedRange() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner("USER");
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        BillingController controller = createController(authService, true, "$9.99 / month");

        ResponseEntity<?> response = controller.createCheckout("Bearer runner-token", Map.of("months", 0));

        assertError(response, HttpStatus.BAD_REQUEST, "months must be between 1 and 12.");
    }

    private BillingController createController(boolean checkoutConfigured, String priceDisplayLabel) {
        return createController(mock(AuthService.class), checkoutConfigured, priceDisplayLabel);
    }

    private BillingController createController(AuthService authService, boolean checkoutConfigured, String priceDisplayLabel) {
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        when(systemConfigService.isCheckoutFullyConfigured()).thenReturn(checkoutConfigured);

        return new BillingController(
                authService,
                mock(RunnerRepository.class),
                mock(AiUsageService.class),
                mock(ProcessedStripeEventRepository.class),
                "sk_test_123",
                "whsec_123",
                "price_123",
                "http://localhost:8080/",
                priceDisplayLabel,
                systemConfigService
        );
    }

    private Runner runner(String role) {
        Runner runner = new Runner();
        runner.setId(42L);
        runner.setRole(role);
        runner.setEmail("runner@hermes.test");
        return runner;
    }

    @SuppressWarnings("unchecked")
    private void assertError(ResponseEntity<?> response, HttpStatus expectedStatus, String expectedMessage) {
        assertThat(response.getStatusCode()).isEqualTo(expectedStatus);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        assertThat((Map<String, String>) response.getBody()).containsEntry("error", expectedMessage);
    }
}
