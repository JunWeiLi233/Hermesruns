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

    private final AuthService authService;
    private final GarminConnectImportService garminConnectImportService;

    public GarminConnectController(AuthService authService, GarminConnectImportService garminConnectImportService) {
        this.authService = authService;
        this.garminConnectImportService = garminConnectImportService;
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

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("error", message);
        return ResponseEntity.status(status).body(response);
    }
}
