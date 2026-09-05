package com.hermes.backend.auth.mfa;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.admin.AdminAuditService;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/mfa")
public class AdminMfaManagementController {
    private static final Set<String> LABEL_FIELDS = Set.of("label");
    private static final Set<String> CREDENTIAL_FIELDS = Set.of("credential", "label");

    private final AuthService authService;
    private final AdminMfaService adminMfaService;
    private final AdminAuditService adminAuditService;
    private final ObjectMapper objectMapper;

    public AdminMfaManagementController(
            AuthService authService,
            AdminMfaService adminMfaService,
            AdminAuditService adminAuditService,
            ObjectMapper objectMapper
    ) {
        this.authService = authService;
        this.adminMfaService = adminMfaService;
        this.adminAuditService = adminAuditService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/passkeys")
    public ResponseEntity<?> listPasskeys(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader
    ) {
        Runner admin = requireAdmin(authorizationHeader);
        return noStore(Map.of("passkeys", adminMfaService.listPasskeys(admin)));
    }

    @PostMapping("/passkeys/options")
    public ResponseEntity<?> additionalPasskeyOptions(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            HttpServletRequest request
    ) {
        try {
            requireOrigin(request);
            Runner admin = requireAdmin(authorizationHeader);
            AdminMfaService.RegistrationBeginResult result =
                    adminMfaService.beginAdditionalPasskeyRegistration(admin);
            JsonNode options = objectMapper.readTree(result.creationOptionsJson());
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, AdminMfaChallengeCookie.issue(result.selector(), request))
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .header(HttpHeaders.PRAGMA, "no-cache")
                    .body(options);
        } catch (AdminMfaException ex) {
            return mfaFailure(request);
        } catch (Exception ex) {
            return mfaFailure(request);
        }
    }

    @PostMapping("/passkeys/verify")
    public ResponseEntity<?> verifyAdditionalPasskey(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request
    ) {
        try {
            requireOrigin(request);
            rejectUnexpected(body, CREDENTIAL_FIELDS);
            Runner admin = requireAdmin(authorizationHeader);
            String selector = AdminMfaChallengeCookie.read(request)
                    .orElseThrow(() -> new AdminMfaException("Admin authentication failed."));
            AdminMfaService.PasskeyView passkey = adminMfaService.finishAdditionalPasskeyRegistration(
                    admin,
                    selector,
                    credentialJson(body),
                    optionalString(body, "label", 100)
            );
            adminAuditService.log(admin, "admin.mfa.passkey.added", "admin_passkey",
                    String.valueOf(passkey.id()), "Added an administrator passkey.");
            return ResponseEntity.status(HttpStatus.CREATED)
                    .header(HttpHeaders.SET_COOKIE, AdminMfaChallengeCookie.clear(request))
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .body(Map.of("passkey", passkey));
        } catch (AdminMfaException | IllegalArgumentException ex) {
            return mfaFailure(request);
        }
    }

    @PatchMapping("/passkeys/{credentialId}")
    public ResponseEntity<?> renamePasskey(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Long credentialId,
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request
    ) {
        requireOrigin(request);
        rejectUnexpected(body, LABEL_FIELDS);
        Runner admin = requireAdmin(authorizationHeader);
        AdminMfaService.PasskeyView passkey = adminMfaService.renamePasskey(
                admin, credentialId, requiredString(body, "label", 100));
        adminAuditService.log(admin, "admin.mfa.passkey.renamed", "admin_passkey",
                String.valueOf(credentialId), "Renamed an administrator passkey.");
        return noStore(Map.of("passkey", passkey));
    }

    @DeleteMapping("/passkeys/{credentialId}")
    public ResponseEntity<?> revokePasskey(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Long credentialId,
            HttpServletRequest request
    ) {
        requireOrigin(request);
        Runner admin = requireAdmin(authorizationHeader);
        adminMfaService.revokePasskey(admin, credentialId);
        adminAuditService.log(admin, "admin.mfa.passkey.revoked", "admin_passkey",
                String.valueOf(credentialId), "Revoked an administrator passkey.");
        return ResponseEntity.noContent().header(HttpHeaders.CACHE_CONTROL, "no-store").build();
    }

    @PostMapping("/recovery-codes/regenerate")
    public ResponseEntity<?> regenerateRecoveryCodes(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            HttpServletRequest request
    ) {
        requireOrigin(request);
        Runner admin = requireAdmin(authorizationHeader);
        var recoveryCodes = adminMfaService.regenerateRecoveryCodes(admin);
        adminAuditService.log(admin, "admin.mfa.recovery.regenerated", "admin_mfa_profile",
                String.valueOf(admin.getId()), "Regenerated administrator recovery codes.");
        return noStore(Map.of("recoveryCodes", recoveryCodes));
    }

    private Runner requireAdmin(String authorizationHeader) {
        return authService.findByAuthorizationHeader(authorizationHeader)
                .filter(authService::isAdmin)
                .filter(authService::hasFreshAdminMfa)
                .orElseThrow(() -> new AdminMfaException("Admin authentication failed."));
    }

    private void requireOrigin(HttpServletRequest request) {
        if (!adminMfaService.isAllowedRequestOrigin(request.getHeader(HttpHeaders.ORIGIN))) {
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
        String value = optionalString(body, key, maxLength);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Invalid request.");
        }
        return value;
    }

    private String optionalString(Map<String, Object> body, String key, int maxLength) {
        Object value = body == null ? null : body.get(key);
        if (value == null) {
            return null;
        }
        if (!(value instanceof String text) || text.length() > maxLength) {
            throw new IllegalArgumentException("Invalid request.");
        }
        return text.trim();
    }

    private void rejectUnexpected(Map<String, Object> body, Set<String> allowed) {
        if (body == null || !allowed.containsAll(body.keySet())) {
            throw new IllegalArgumentException("Invalid request.");
        }
    }

    private ResponseEntity<?> noStore(Object body) {
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store").body(body);
    }

    private ResponseEntity<?> mfaFailure(HttpServletRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "Admin authentication failed.");
        body.put("code", "ADMIN_MFA_FAILED");
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .header(HttpHeaders.SET_COOKIE, AdminMfaChallengeCookie.clear(request))
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(body);
    }

    @ExceptionHandler({AdminMfaException.class, IllegalArgumentException.class})
    ResponseEntity<?> invalidManagementRequest() {
        return ResponseEntity.badRequest()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(Map.of("error", "Unable to update administrator MFA.", "code", "ADMIN_MFA_UPDATE_FAILED"));
    }
}
