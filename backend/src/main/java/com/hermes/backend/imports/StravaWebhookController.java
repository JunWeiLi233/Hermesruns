package com.hermes.backend.imports;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.auth.ProductionSecurityValidator;
import com.hermes.backend.auth.WebhookRateLimitFilter;
import com.hermes.backend.infrastructure.web.RequestIpResolver;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import jakarta.annotation.PreDestroy;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Strava Event Subscription (Webhook) endpoints.
 *
 * <ul>
 *   <li>{@code GET  /api/strava/webhook} — subscription validation (Strava sends this once when you create a subscription)</li>
 *   <li>{@code POST /api/strava/webhook} — event callback (Strava pushes activity create/update/delete events here)</li>
 * </ul>
 *
 * To create a subscription, run once:
 * <pre>
 * curl -X POST https://www.strava.com/api/v3/push_subscriptions \
 *   -d client_id=YOUR_ID -d client_secret=YOUR_SECRET \
 *   -d callback_url=https://YOUR_DOMAIN/api/strava/webhook \
 *   -d verify_token=YOUR_STRAVA_WEBHOOK_VERIFY_TOKEN
 * </pre>
 *
 * <p>The {@code hermes-strava-webhook} default is a development convenience only;
 * production must set {@code STRAVA_WEBHOOK_VERIFY_TOKEN} to a long random secret
 * ({@link ProductionSecurityValidator} fails startup otherwise when Strava is
 * enabled, and this controller rejects the default outright in production).</p>
 */
@RestController
@RequestMapping("/api/strava/webhook")
public class StravaWebhookController {
    private static final long[] WEBHOOK_RETRY_DELAYS_MS = {0L, 1500L, 5000L};

    private static final String DEFAULT_VERIFY_TOKEN = "hermes-strava-webhook";

    private static final Logger log = LoggerFactory.getLogger(StravaWebhookController.class);

    private static final long DEAUTHORIZATION_CHECK_MIN_GAP_MS = 60_000L;

    private final RunnerRepository runnerRepository;
    private final StravaSyncService stravaSyncService;
    private final StravaAccountService stravaAccountService;
    private final ExecutorService webhookExecutor;
    private final ConcurrentMap<Long, Long> lastDeauthorizationCheckMs = new ConcurrentHashMap<>();

    @Value("${hermes.environment:development}")
    private String environment;

    @Value("${strava.webhook.verify-token:hermes-strava-webhook}")
    private String verifyToken;

    @Value("${STRAVA_CLIENT_SECRET:}")
    private String stravaClientSecret;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public StravaWebhookController(RunnerRepository runnerRepository,
                                   StravaSyncService stravaSyncService,
                                   StravaAccountService stravaAccountService) {
        this.runnerRepository = runnerRepository;
        this.stravaSyncService = stravaSyncService;
        this.stravaAccountService = stravaAccountService;
        // Bound concurrency to reduce memory pressure on small-RAM servers.
        this.webhookExecutor = Executors.newFixedThreadPool(4, r -> {
            Thread t = new Thread(r, "strava-webhook-worker");
            t.setDaemon(true);
            return t;
        });
    }

    @PreDestroy
    void shutdown() {
        webhookExecutor.shutdownNow();
    }

    /**
     * Strava subscription validation — responds with the hub.challenge value
     * if the verify token matches.
     */
    @GetMapping
    public ResponseEntity<?> validateSubscription(
            @RequestParam("hub.mode") String mode,
            @RequestParam("hub.verify_token") String token,
            @RequestParam("hub.challenge") String challenge) {

        // Fail closed: an unset token must never validate, and the documented
        // development default is public knowledge so production rejects it too.
        if (verifyToken == null || verifyToken.isBlank()
                || (isProduction() && DEFAULT_VERIFY_TOKEN.equals(verifyToken.trim()))) {
            log.warn("Strava webhook validation failed: verify token is unset or uses the development default");
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        if (!"subscribe".equals(mode) || !verifyToken.equals(token)) {
            log.warn("Strava webhook validation failed: mode={}, token mismatch={}", mode, !verifyToken.equals(token));
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        log.info("Strava webhook subscription validated");
        return ResponseEntity.ok(Map.of("hub.challenge", challenge));
    }

    /**
     * Strava event callback — receives activity create/update/delete/deauthorize events.
     * Must return 200 within 2 seconds (Strava requirement), so processing is async.
     *
     * <p>Strava does not sign event deliveries and sends no verify_token on POST (only the one-time
     * subscription GET carries one), and athlete ids are public. An event is therefore only a hint:
     * a sync event makes Hermes fetch the activity from Strava itself, and a delete or deauthorize
     * event changes data only after Strava confirms it (the activity is gone, or the refresh token is
     * invalid). A signature header is checked if one is present, for example from a proxy. The
     * {@link WebhookRateLimitFilter} provides per-IP flood protection and the runner lookup limits
     * activity processing to registered athletes.</p>
     */
    @PostMapping
    public ResponseEntity<String> handleEvent(
            @RequestBody String body,
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature,
            HttpServletRequest request) {

        // Strava does not send X-Hub-Signature-256, so requiring it in production would reject every real
        // event. Verify it only when a sender did provide one.
        if (signature != null && !signature.isBlank()
                && (stravaClientSecret == null || stravaClientSecret.isBlank()
                || !verifyStravaSignature(body, signature))) {
            log.warn("Strava webhook rejected: signature present but invalid");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid signature");
        }

        Map<String, Object> event;
        try {
            event = OBJECT_MAPPER.readValue(body, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Strava webhook rejected: invalid JSON body");
            return ResponseEntity.badRequest().body("INVALID_JSON");
        }

        String objectType = str(event.get("object_type"));
        String aspectType = str(event.get("aspect_type"));
        Long ownerId = lng(event.get("owner_id"));
        Long objectId = lng(event.get("object_id"));

        if (objectType == null || aspectType == null || ownerId == null) {
            log.warn("Strava webhook event rejected: missing required fields (object_type, aspect_type, owner_id).");
            return ResponseEntity.badRequest().body("MISSING_REQUIRED_FIELDS");
        }

        log.info("Strava webhook event: object_type={}, aspect_type={}, owner_id={}, object_id={}",
                objectType, aspectType, ownerId, objectId);

        // Athlete updates and non-activity objects do not trigger runner work, so
        // acknowledge them before spending a repository lookup on owner validation.
        if ("athlete".equals(objectType) && "update".equals(aspectType)) {
            Map<String, Object> updates = map(event.get("updates"));
            if (updates != null && "false".equalsIgnoreCase(str(updates.get("authorized")))) {
                log.info("Strava reports deauthorization for athlete {}; confirming with Strava", ownerId);
                Long athleteId = ownerId;
                CompletableFuture.runAsync(() -> confirmDeauthorization(athleteId), webhookExecutor);
            }
            return ResponseEntity.ok("EVENT_RECEIVED");
        }

        if (!"activity".equals(objectType) || objectId == null) {
            return ResponseEntity.ok("EVENT_RECEIVED");
        }

        // Verify the owner_id corresponds to a known registered runner.
        // Forged events with arbitrary owner_ids are rejected synchronously
        // before any async processing or resource consumption occurs.
        Optional<Runner> knownRunner = runnerRepository.findByStravaAthleteId(ownerId);
        if (knownRunner.isEmpty()) {
            String ip = RequestIpResolver.clientIp(request);
            log.warn("Strava webhook event rejected: unknown owner_id={} ip={}", ownerId, ip);
            return ResponseEntity.status(403).body("UNKNOWN_OWNER");
        }

        if (!"activity".equals(objectType)) {
            return ResponseEntity.ok("EVENT_RECEIVED");
        }

        // Find the runner by Strava athlete ID
        Long athleteId = ownerId;
        CompletableFuture.runAsync(
                () -> processActivityEvent(athleteId, objectId, aspectType),
                webhookExecutor
        );

        return ResponseEntity.ok("EVENT_RECEIVED");
    }

    private void processActivityEvent(Long stravaAthleteId, Long stravaActivityId, String aspectType) {
        runnerRepository.findByStravaAthleteId(stravaAthleteId).ifPresentOrElse(
                runner -> {
                    if ("create".equals(aspectType) || "update".equals(aspectType)) {
                        log.info("Strava webhook: syncing activity {} for runner {} ({})",
                                stravaActivityId, runner.getId(), aspectType);
                        retryWebhookSyncBurst(runner, stravaActivityId);
                    } else if ("delete".equals(aspectType)) {
                        log.info("Strava webhook: delete hint for activity {} (runner {}); confirming with Strava",
                                stravaActivityId, runner.getId());
                        stravaSyncService.deleteStravaActivityIfGone(runner, stravaActivityId);
                    }
                },
                () -> log.warn("Strava webhook: no runner found for athlete {}", stravaAthleteId)
        );
    }

    /**
     * A deauthorization event is unauthenticated, so it is never acted on directly: Hermes asks Strava
     * whether the runner's authorization still stands and purges only on a clear "revoked" answer. At most
     * one check per runner per minute, so forged events cannot turn Hermes into a request generator.
     */
    private void confirmDeauthorization(Long stravaAthleteId) {
        runnerRepository.findByStravaAthleteId(stravaAthleteId).ifPresent(runner -> {
            long now = System.currentTimeMillis();
            Long previous = lastDeauthorizationCheckMs.put(runner.getId(), now);
            if (previous != null && now - previous < DEAUTHORIZATION_CHECK_MIN_GAP_MS) {
                return;
            }
            StravaAccountService.RevocationOutcome outcome = stravaAccountService.confirmRevocationAndPurge(runner.getId());
            log.info("Strava deauthorization check for runner {}: {}", runner.getId(), outcome);
        });
    }

    private void retryWebhookSyncBurst(Runner runner, long stravaActivityId) {
        for (int attempt = 0; attempt < WEBHOOK_RETRY_DELAYS_MS.length; attempt += 1) {
            long delayMs = WEBHOOK_RETRY_DELAYS_MS[attempt];
            if (delayMs > 0) {
                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException interruptedException) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }

            StravaSyncService.SingleActivitySyncResult result = stravaSyncService.syncStravaActivityById(runner, stravaActivityId);
            if (result == StravaSyncService.SingleActivitySyncResult.SUCCESS
                    || result == StravaSyncService.SingleActivitySyncResult.ALREADY_RUNNING
                    || result == StravaSyncService.SingleActivitySyncResult.PERMANENT_FAILURE) {
                return;
            }
        }
    }

    private boolean isProduction() {
        return environment != null && "production".equalsIgnoreCase(environment.trim());
    }

    private boolean verifyStravaSignature(String body, String signatureHeader) {
        if (signatureHeader == null || !signatureHeader.startsWith("sha256=")) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(stravaClientSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(body.getBytes(StandardCharsets.UTF_8));
            String expected = "sha256=" + HexFormat.of().formatHex(digest);
            return MessageDigest.isEqual(
                    expected.getBytes(StandardCharsets.UTF_8),
                    signatureHeader.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.warn("Strava signature verification error: {}", e.getMessage());
            return false;
        }
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object v) {
        return v instanceof Map<?, ?> ? (Map<String, Object>) v : null;
    }

    private static Long lng(Object v) {
        if (v instanceof Number n) return n.longValue();
        if (v instanceof String s && !s.isBlank()) {
            try { return Long.parseLong(s); } catch (NumberFormatException e) { return null; }
        }
        return null;
    }

}
