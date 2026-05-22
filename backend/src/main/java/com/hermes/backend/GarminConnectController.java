package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/garmin/connect")
public class GarminConnectController {
    private static final Set<String> IMPORT_FIELDS = Set.of("garminEmail", "garminPassword", "limit");
    private static final Set<String> WELLNESS_IMPORT_FIELDS = Set.of("daysBack");
    private static final Set<String> WELLNESS_TOGGLE_FIELDS = Set.of("enabled");
    private static final Set<String> CREDENTIAL_FIELDS = Set.of("garminEmail", "garminPassword");

    private final AuthService authService;
    private final GarminConnectImportService garminConnectImportService;
    private final GarminWellnessImportService wellnessImportService;
    private final SecretEncryptionService secretEncryptionService;
    private final RunnerRepository runnerRepository;

    public GarminConnectController(
            AuthService authService,
            GarminConnectImportService garminConnectImportService,
            GarminWellnessImportService wellnessImportService,
            SecretEncryptionService secretEncryptionService,
            RunnerRepository runnerRepository
    ) {
        this.authService = authService;
        this.garminConnectImportService = garminConnectImportService;
        this.wellnessImportService = wellnessImportService;
        this.secretEncryptionService = secretEncryptionService;
        this.runnerRepository = runnerRepository;
    }

    @PostMapping("/import")
    public ResponseEntity<?> startImport(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody Map<String, Object> body
    ) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOpt.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
        }
        final String garminEmail;
        final String garminPassword;
        final int limit;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, IMPORT_FIELDS);
            garminEmail = RequestBodyValidator.requiredString(body, "garminEmail", 200);
            garminPassword = RequestBodyValidator.requiredString(body, "garminPassword", 200);
            limit = RequestBodyValidator.intOrDefault(body, "limit", 50, 1, 200);
        } catch (IllegalArgumentException ex) {
            return error(HttpStatus.BAD_REQUEST, ex.getMessage());
        }

        if (garminEmail == null || garminEmail.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "Garmin Connect email is required.");
        }
        if (garminPassword == null || garminPassword.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "Garmin Connect password is required.");
        }
        if (garminEmail.length() > 200 || garminPassword.length() > 200) {
            return error(HttpStatus.BAD_REQUEST, "Invalid credentials.");
        }

        long retryAfterSeconds = garminConnectImportService.getRateLimitRetryAfterSeconds(runnerOpt.get().getId());
        if (retryAfterSeconds > 0) {
            return rateLimited(retryAfterSeconds);
        }

        boolean started = garminConnectImportService.startImport(
                runnerOpt.get(), garminEmail, garminPassword, limit
        );

        if (!started) {
            return error(HttpStatus.CONFLICT, "A Garmin Connect import is already in progress.");
        }

        Map<String, Object> response = new HashMap<>();
        response.put("status", "STARTED");
        response.put("message", "Garmin Connect import started. Poll /api/garmin/connect/import/status for progress.");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/import/status")
    public ResponseEntity<?> getImportStatus(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOpt.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
        }

        GarminConnectImportService.GarminSyncStatus status =
                garminConnectImportService.getStatus(runnerOpt.get().getId());
        return ResponseEntity.ok(status);
    }

    @PostMapping("/wellness/import")
    public ResponseEntity<?> startWellnessImport(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody Map<String, Object> body
    ) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOpt.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
        }
        Runner runner = runnerOpt.get();

        int daysBack;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, WELLNESS_IMPORT_FIELDS);
            daysBack = RequestBodyValidator.intOrDefault(body, "daysBack", 7, 1, 365);
        } catch (IllegalArgumentException ex) {
            return error(HttpStatus.BAD_REQUEST, ex.getMessage());
        }

        String email = runner.getGarminConnectEmail();
        String encryptedPassword = runner.getGarminConnectPasswordEncrypted();

        if (email == null || email.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "No Garmin Connect credentials stored. Save credentials first via /api/garmin/connect/wellness/credentials.");
        }

        long retryAfterSeconds = wellnessImportService.getRateLimitRetryAfterSeconds(runner.getId());
        if (retryAfterSeconds > 0) {
            return rateLimited(retryAfterSeconds);
        }

        String decryptedPassword;
        try {
            decryptedPassword = secretEncryptionService.decrypt(encryptedPassword);
        } catch (Exception e) {
            return error(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to decrypt stored Garmin credentials.");
        }

        if (decryptedPassword == null || decryptedPassword.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "Stored Garmin credentials are invalid. Please update your credentials.");
        }

        boolean started = wellnessImportService.startWellnessImport(runner, email, decryptedPassword, daysBack);
        if (!started) {
            return error(HttpStatus.CONFLICT, "A Garmin wellness import is already in progress.");
        }

        Map<String, Object> response = new HashMap<>();
        response.put("status", "STARTED");
        response.put("message", "Garmin wellness import started. Poll /api/garmin/connect/wellness/status for progress.");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/wellness/status")
    public ResponseEntity<?> getWellnessStatus(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOpt.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
        }

        GarminWellnessImportService.WellnessSyncStatus status =
                wellnessImportService.getStatus(runnerOpt.get().getId());

        Map<String, Object> response = new HashMap<>();
        response.put("syncStatus", status);
        response.put("wellnessSyncEnabled", runnerOpt.get().isGarminWellnessSyncEnabled());
        response.put("lastSyncedAt", runnerOpt.get().getGarminWellnessLastSyncedAt());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/wellness/toggle")
    public ResponseEntity<?> toggleWellnessSync(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody Map<String, Object> body
    ) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOpt.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
        }

        boolean enabled;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, WELLNESS_TOGGLE_FIELDS);
            Object enabledVal = body.get("enabled");
            if (enabledVal == null) {
                return error(HttpStatus.BAD_REQUEST, "Field 'enabled' is required.");
            }
            enabled = Boolean.parseBoolean(String.valueOf(enabledVal));
        } catch (IllegalArgumentException ex) {
            return error(HttpStatus.BAD_REQUEST, ex.getMessage());
        }

        Runner runner = runnerOpt.get();

        if (enabled && (runner.getGarminConnectEmail() == null || runner.getGarminConnectEmail().isBlank())) {
            return error(HttpStatus.BAD_REQUEST, "Cannot enable wellness sync without stored Garmin credentials. Save credentials first via /api/garmin/connect/wellness/credentials.");
        }

        runner.setGarminWellnessSyncEnabled(enabled);
        runnerRepository.save(runner);

        Map<String, Object> response = new HashMap<>();
        response.put("wellnessSyncEnabled", enabled);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/wellness/credentials")
    public ResponseEntity<?> saveWellnessCredentials(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody Map<String, Object> body
    ) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOpt.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
        }

        String garminEmail;
        String garminPassword;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, CREDENTIAL_FIELDS);
            garminEmail = RequestBodyValidator.requiredString(body, "garminEmail", 200);
            garminPassword = RequestBodyValidator.requiredString(body, "garminPassword", 200);
        } catch (IllegalArgumentException ex) {
            return error(HttpStatus.BAD_REQUEST, ex.getMessage());
        }

        if (garminEmail == null || garminEmail.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "Garmin Connect email is required.");
        }
        if (garminPassword == null || garminPassword.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "Garmin Connect password is required.");
        }

        String encryptedPassword = secretEncryptionService.encrypt(garminPassword);

        Runner runner = runnerOpt.get();
        runner.setGarminConnectEmail(garminEmail);
        runner.setGarminConnectPasswordEncrypted(encryptedPassword);
        runnerRepository.save(runner);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "SAVED");
        response.put("message", "Garmin Connect credentials saved. Wellness sync can now be enabled.");
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("error", message);
        return ResponseEntity.status(status).body(response);
    }

    private ResponseEntity<Map<String, Object>> rateLimited(long retryAfterSeconds) {
        Map<String, Object> response = new HashMap<>();
        response.put("error", GarminRateLimitSupport.message(retryAfterSeconds));
        response.put("retryAfterSeconds", retryAfterSeconds);
        return ResponseEntity
                .status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", String.valueOf(retryAfterSeconds))
                .body(response);
    }
}
