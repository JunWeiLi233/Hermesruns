package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.StripeObject;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.annotation.PostConstruct;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/billing")
public class BillingController {
    private static final Logger logger = LoggerFactory.getLogger(BillingController.class);
    private static final Set<String> CHECKOUT_FIELDS = Set.of("months");

    private static final ObjectMapper JSON = new ObjectMapper();

    private final AuthService authService;
    private final RunnerRepository runnerRepository;
    private final AiUsageService aiUsageService;
    private final ProcessedStripeEventRepository processedStripeEventRepository;

    private final String stripeSecretKey;
    private final String stripeWebhookSecret;
    private final String stripePriceProMonthly;
    private final String publicBaseUrl;
    @SuppressWarnings("unused")
    private final String priceDisplayLabel;
    private final SystemConfigService systemConfigService;

    public BillingController(
            AuthService authService,
            RunnerRepository runnerRepository,
            AiUsageService aiUsageService,
            ProcessedStripeEventRepository processedStripeEventRepository,
            @Value("${app.billing.stripe.secret-key:}") String stripeSecretKey,
            @Value("${app.billing.stripe.webhook-secret:}") String stripeWebhookSecret,
            @Value("${app.billing.stripe.price-pro-monthly:}") String stripePriceProMonthly,
            @Value("${app.billing.public-base-url:http://localhost:8080}") String publicBaseUrl,
            @Value("${app.billing.price-display-label:}") String priceDisplayLabel,
            SystemConfigService systemConfigService) {
        this.authService = authService;
        this.runnerRepository = runnerRepository;
        this.aiUsageService = aiUsageService;
        this.processedStripeEventRepository = processedStripeEventRepository;
        this.stripeSecretKey = stripeSecretKey;
        this.stripeWebhookSecret = stripeWebhookSecret;
        this.stripePriceProMonthly = stripePriceProMonthly;
        this.publicBaseUrl = trimTrailingSlash(publicBaseUrl);
        this.priceDisplayLabel = priceDisplayLabel;
        this.systemConfigService = systemConfigService;
    }

    @PostConstruct
    void initStripe() {
        if (stripeSecretKey != null && !stripeSecretKey.isBlank()) {
            Stripe.apiKey = stripeSecretKey.trim();
        }
    }

    /**
     * Public config for the SPA (no secrets). When checkoutConfigured is false, hide pay buttons.
     * Requires valid authentication.
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> billingConfig(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok((Map<String, Object>) systemConfigService.getPublicConfigStatus().get("billing"));
    }

    /**
     * Create a Stripe Checkout Session and return its URL (hosted payment page).
     */
    @PostMapping("/checkout")
    public ResponseEntity<?> createCheckout(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) Map<String, Object> body) {

        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOpt.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "Sign in required.");
        }

        Runner runner = runnerOpt.get();
        if ("ADMIN".equals(runner.getRole())) {
            return error(HttpStatus.BAD_REQUEST, "Admin accounts already have unlimited AI usage.");
        }

        if (!isCheckoutFullyConfigured()) {
            return error(HttpStatus.SERVICE_UNAVAILABLE, "Online checkout is not configured on this server.");
        }

        final int months;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, CHECKOUT_FIELDS);
            months = RequestBodyValidator.intOrDefault(body, "months", 1, 1, 12);
        } catch (IllegalArgumentException ex) {
            return error(HttpStatus.BAD_REQUEST, ex.getMessage());
        }

        String successUrl = publicBaseUrl + "/profile?checkout=success&session_id={CHECKOUT_SESSION_ID}";
        String cancelUrl = publicBaseUrl + "/profile?checkout=cancel";

        try {
            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setCustomerEmail(runner.getEmail())
                    .setClientReferenceId(String.valueOf(runner.getId()))
                    .putMetadata("runnerId", String.valueOf(runner.getId()))
                    .putMetadata("months", String.valueOf(months))
                    .setSuccessUrl(successUrl)
                    .setCancelUrl(cancelUrl)
                    .addLineItem(
                            SessionCreateParams.LineItem.builder()
                                    .setPrice(stripePriceProMonthly.trim())
                                    .setQuantity((long) months)
                                    .build())
                    .build();

            Session session = Session.create(params);
            Map<String, String> out = new LinkedHashMap<>();
            out.put("url", session.getUrl());
            return ResponseEntity.ok(out);
        } catch (StripeException e) {
            return error(HttpStatus.BAD_GATEWAY, "Payment provider error: " + e.getMessage());
        }
    }

    /**
     * Stripe webhook — verifies signature, then extends Pro on successful Checkout.
     */
    @PostMapping(value = "/webhook", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Transactional
    public ResponseEntity<String> stripeWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "Stripe-Signature", required = false) String sigHeader) {

        if (stripeWebhookSecret == null || stripeWebhookSecret.isBlank()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body("webhook not configured");
        }
        if (sigHeader == null || sigHeader.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("missing signature");
        }

        final Event event;
        try {
            event = Webhook.constructEvent(payload, sigHeader, stripeWebhookSecret.trim());
        } catch (SignatureVerificationException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("invalid signature");
        }

        if (!"checkout.session.completed".equals(event.getType())) {
            return ResponseEntity.ok("ignored");
        }

        Optional<Session> sessionOpt = extractCheckoutSession(event, payload);
        if (sessionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("bad session payload");
        }

        Session session = sessionOpt.get();
        if (!"paid".equals(session.getPaymentStatus())) {
            return ResponseEntity.ok("unpaid");
        }

        Long runnerId = parseRunnerId(session);
        if (runnerId == null) {
            return ResponseEntity.ok("no-runner");
        }

        int months = parseMonths(session);
        Optional<Runner> runnerOpt = runnerRepository.findById(runnerId);
        if (runnerOpt.isEmpty() || runnerOpt.get().isDeleted()) {
            return ResponseEntity.ok("runner-missing");
        }

        Runner runner = runnerOpt.get();
        if ("ADMIN".equals(runner.getRole())) {
            return ResponseEntity.ok("admin-skip");
        }

        try {
            processedStripeEventRepository.saveAndFlush(new ProcessedStripeEvent(event.getId()));
        } catch (DataIntegrityViolationException e) {
            return ResponseEntity.ok("duplicate");
        }

        aiUsageService.grantPro(runner, months);
        return ResponseEntity.ok("ok");
    }

    private Optional<Session> extractCheckoutSession(Event event, String rawPayload) {
        Optional<StripeObject> obj = event.getDataObjectDeserializer().getObject();
        if (obj.isPresent() && obj.get() instanceof Session s) {
            return Optional.of(s);
        }
        try {
            JsonNode root = JSON.readTree(rawPayload);
            JsonNode o = root.path("data").path("object");
            if (!"checkout.session".equals(o.path("object").asText())) {
                return Optional.empty();
            }
            String sessionId = o.path("id").asText();
            if (sessionId.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(Session.retrieve(sessionId));
        } catch (Exception e) {
            logger.warn("Failed to parse Stripe webhook payload: {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    private Long parseRunnerId(Session session) {
        Map<String, String> meta = session.getMetadata();
        if (meta != null && meta.containsKey("runnerId")) {
            try {
                return Long.parseLong(meta.get("runnerId"));
            } catch (NumberFormatException ignored) {
                logger.debug("Could not parse runnerId from Stripe metadata", ignored);
            }
        }
        String ref = session.getClientReferenceId();
        if (ref != null && !ref.isBlank()) {
            try {
                return Long.parseLong(ref.trim());
            } catch (NumberFormatException ignored) {
                logger.debug("Could not parse runnerId from Stripe client reference", ignored);
            }
        }
        return null;
    }

    private int parseMonths(Session session) {
        Map<String, String> meta = session.getMetadata();
        if (meta != null && meta.containsKey("months")) {
            try {
                int m = Integer.parseInt(meta.get("months"));
                if (m >= 1 && m <= 12) {
                    return m;
                }
            } catch (NumberFormatException ignored) {
                logger.debug("Could not parse months from Stripe metadata", ignored);
            }
        }
        return 1;
    }

    private boolean isCheckoutFullyConfigured() {
        return systemConfigService.isCheckoutFullyConfigured();
    }

    private static String trimTrailingSlash(String url) {
        if (url == null) {
            return "";
        }
        String u = url.trim();
        while (u.endsWith("/")) {
            u = u.substring(0, u.length() - 1);
        }
        return u.isEmpty() ? "" : u;
    }

    private static ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}
