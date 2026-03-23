package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/import")
public class ImportController {
    private final AuthService authService;
    private final ActivityImportService activityImportService;

    public ImportController(AuthService authService, ActivityImportService activityImportService) {
        this.authService = authService;
        this.activityImportService = activityImportService;
    }

    @PostMapping(path = "/files", consumes = "multipart/form-data")
    public ResponseEntity<?> importFile(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam("provider") String providerValue,
            @RequestParam("file") MultipartFile file
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
        }

        try {
            ImportProvider provider = ImportProvider.valueOf(providerValue.trim().toUpperCase(Locale.ROOT));
            ImportResult result = activityImportService.importFile(runnerOptional.get(), provider, file);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException exception) {
            return error(HttpStatus.BAD_REQUEST, exception.getMessage());
        }
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("error", message);
        return ResponseEntity.status(status).body(response);
    }
}