package com.hermes.backend.auth.mfa;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.AdminPortalSessionCookie;
import com.hermes.backend.Runner;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/auth/admin-mfa")
public class AdminMfaController {
    private static final String SETUP_UNAVAILABLE_MESSAGE = "Admin MFA setup is unavailable.";
    private static final Set<String> BOOTSTRAP_FIELDS = Set.of("bootstrapToken");
    private static final Set<String> CREDENTIAL_FIELDS = Set.of("credential");
    private static final Set<String> RECOVERY_FIELDS = Set.of("recoveryCode");

    private final AdminMfaService adminMfaService;
    private final ObjectMapper objectMapper;

    public AdminMfaController(AdminMfaService adminMfaService, ObjectMapper objectMapper) {
        this.adminMfaService = adminMfaService;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/authentication/options")
    public ResponseEntity<?> authenticationOptions(HttpServletRequest request) {
        return optionResponse(request, false, null);
    }

    @PostMapping("/registration/options")
    public ResponseEntity<?> registrationOptions(
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request
    ) {
        try {
            rejectUnexpected(body, BOOTSTRAP_FIELDS);
            return optionResponse(request, true, requiredString(body, "bootstrapToken", 512));
        } catch (IllegalArgumentException ex) {
            return failure(request);
        }
    }

    @PostMapping("/authentication/verify")
    public ResponseEntity<?> verifyAuthentication(
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request
    ) {
        try {
            requireOrigin(request);
            rejectUnexpected(body, CREDENTIAL_FIELDS);
            String selector = selector(request);
            String credentialJson = credentialJson(body);
            return completion(adminMfaService.finishAuthentication(selector, credentialJson), request);
        } catch (AdminMfaException | IllegalArgumentException ex) {
            return failure(request);
        }
    }

    @PostMapping("/registration/verify")
    public ResponseEntity<?> verifyRegistration(
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request
    ) {
        try {
            requireOrigin(request);
            rejectUnexpected(body, CREDENTIAL_FIELDS);
            String selector = selector(request);
            String credentialJson = credentialJson(body);
            return completion(adminMfaService.finishRegistration(selector, credentialJson), request);
        } catch (AdminMfaException | IllegalArgumentException ex) {
            return failure(request);
        }
    }

    @PostMapping("/recovery/verify")
    public ResponseEntity<?> verifyRecovery(
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request
    ) {
        try {
            requireOrigin(request);
            rejectUnexpected(body, RECOVERY_FIELDS);
            return completion(adminMfaService.finishRecovery(
                    selector(request), requiredString(body, "recoveryCode", 128)), request);
        } catch (AdminMfaException | IllegalArgumentException ex) {
            return failure(request);
        }
    }

    @DeleteMapping("/challenge")
    public ResponseEntity<?> cancel(HttpServletRequest request) {
        try {
            requireOrigin(request);
            AdminMfaChallengeCookie.read(request).ifPresent(adminMfaService::cancel);
        } catch (AdminMfaException ignored) {
            // The public cancellation contract is idempotent and generic.
        }
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, AdminMfaChallengeCookie.clear(request))
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .build();
    }

    private ResponseEntity<?> optionResponse(HttpServletRequest request, boolean registration, String bootstrapToken) {
        try {
            requireOrigin(request);
            String selector = selector(request);
            String json = registration
                    ? adminMfaService.registrationOptions(selector, bootstrapToken)
                    : adminMfaService.authenticationOptions(selector);
            JsonNode payload = objectMapper.readTree(json);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .header(HttpHeaders.PRAGMA, "no-cache")
                    .body(payload);
        } catch (AdminMfaException ex) {
            if (registration && SETUP_UNAVAILABLE_MESSAGE.equals(ex.getMessage())) {
                return setupUnavailable(request);
            }
            return failure(request);
        } catch (Exception ex) {
            return failure(request);
        }
    }

    private ResponseEntity<?> completion(AdminMfaService.CompletionResult result, HttpServletRequest request) {
        Runner runner = result.runner();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("message", "Admin authentication successful.");
        payload.put("token", result.token());
        payload.put("email", runner.getEmail());
        payload.put("role", "ADMIN");
        payload.put("admin", true);
        if (!result.recoveryCodes().isEmpty()) {
            payload.put("recoveryCodes", result.recoveryCodes());
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE,
                        AdminMfaChallengeCookie.clear(request),
                        AdminPortalSessionCookie.issue(result.token(), request))
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.PRAGMA, "no-cache")
                .body(payload);
    }

    private ResponseEntity<?> failure(HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .header(HttpHeaders.SET_COOKIE, AdminMfaChallengeCookie.clear(request))
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(Map.of("error", "Admin authentication failed.", "code", "ADMIN_MFA_FAILED"));
    }

    private ResponseEntity<?> setupUnavailable(HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .header(HttpHeaders.SET_COOKIE, AdminMfaChallengeCookie.clear(request))
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.PRAGMA, "no-cache")
                .body(Map.of("error", SETUP_UNAVAILABLE_MESSAGE, "code", "ADMIN_MFA_SETUP_UNAVAILABLE"));
    }

    private String selector(HttpServletRequest request) {
        return AdminMfaChallengeCookie.read(request)
                .orElseThrow(() -> new AdminMfaException("Admin authentication failed."));
    }

    private void requireOrigin(HttpServletRequest request) {
        if (!adminMfaService.isAllowedRequestOrigin(request.getHeader("Origin"))) {
            throw new AdminMfaException("Admin authentication failed.");
        }
    }

    private String credentialJson(Map<String, Object> body) {
        Object credential = body == null ? null : body.get("credential");
        if (!(credential instanceof Map<?, ?>)) {
            throw new IllegalArgumentException("Invalid credential.");
        }
        try {
            String json = objectMapper.writeValueAsString(credential);
            if (json.length() > 64_000) {
                throw new IllegalArgumentException("Credential is too large.");
            }
            return json;
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid credential.", ex);
        }
    }

    private String requiredString(Map<String, Object> body, String key, int maxLength) {
        Object value = body == null ? null : body.get(key);
        if (!(value instanceof String text) || text.isBlank() || text.length() > maxLength) {
            throw new IllegalArgumentException("Invalid request.");
        }
        return text;
    }

    private void rejectUnexpected(Map<String, Object> body, Set<String> allowed) {
        if (body == null || !allowed.containsAll(body.keySet())) {
            throw new IllegalArgumentException("Invalid request.");
        }
    }
}
