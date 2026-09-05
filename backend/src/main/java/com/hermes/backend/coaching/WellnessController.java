package com.hermes.backend.coaching;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.imports.AppleHealthImportService;
import com.hermes.backend.imports.GoogleHealthImportService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wellness")
public class WellnessController {

    private final AppleHealthImportService appleHealthImportService;
    private final GoogleHealthImportService googleHealthImportService;
    private final AuthService authService;
    private final WellnessPreferenceService preferenceService;

    @Autowired
    public WellnessController(
            AppleHealthImportService appleHealthImportService,
            GoogleHealthImportService googleHealthImportService,
            AuthService authService,
            WellnessPreferenceService preferenceService
    ) {
        this.appleHealthImportService = appleHealthImportService;
        this.googleHealthImportService = googleHealthImportService;
        this.authService = authService;
        this.preferenceService = preferenceService;
    }

    public WellnessController(
            AppleHealthImportService appleHealthImportService,
            GoogleHealthImportService googleHealthImportService,
            AuthService authService,
            RunnerRepository runnerRepository,
            ReadinessService readinessService
    ) {
        this(appleHealthImportService, googleHealthImportService, authService,
                new WellnessPreferenceService(runnerRepository, readinessService));
    }

    WellnessController(
            AppleHealthImportService appleHealthImportService,
            GoogleHealthImportService googleHealthImportService,
            AuthService authService,
            RunnerRepository runnerRepository
    ) {
        this(appleHealthImportService, googleHealthImportService, authService, runnerRepository, null);
    }

    @GetMapping("/source-preferences")
    public ResponseEntity<?> getSourcePreferences(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional == null || runnerOptional.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Sign in required."));
        }

        Runner runner = runnerOptional.get();
        return ResponseEntity.ok(preferenceService.preferences(runner));
    }

    @PutMapping("/source-preferences")
    public ResponseEntity<?> updateSourcePreferences(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional == null || runnerOptional.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Sign in required."));
        }

        Runner runner = runnerOptional.get();
        try {
            preferenceService.applyRequestedSources(runner, body);
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(Map.of("message", exception.getMessage()));
        }

        return ResponseEntity.ok(preferenceService.savePreferences(runner));
    }

    @PostMapping("/apple-health/import")
    public ResponseEntity<?> importAppleHealth(@AuthenticationPrincipal Runner runner, @RequestBody List<Map<String, Object>> dataPoints) {
        if (runner == null) return ResponseEntity.status(401).build();
        boolean started = appleHealthImportService.importWellnessData(runner, dataPoints);
        if (started) {
            return ResponseEntity.accepted().body(Map.of("message", "Apple Health import started."));
        } else {
            return ResponseEntity.status(429).body(Map.of("message", "Import already in progress."));
        }
    }

    @GetMapping("/apple-health/status")
    public ResponseEntity<?> getAppleHealthStatus(@AuthenticationPrincipal Runner runner) {
        if (runner == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(appleHealthImportService.getStatus(runner.getId()));
    }

    @PostMapping("/google-health/import")
    public ResponseEntity<?> importGoogleHealth(@AuthenticationPrincipal Runner runner, @RequestBody List<Map<String, Object>> dataPoints) {
        if (runner == null) return ResponseEntity.status(401).build();
        boolean started = googleHealthImportService.importWellnessData(runner, dataPoints);
        if (started) {
            return ResponseEntity.accepted().body(Map.of("message", "Google Health Connect import started."));
        } else {
            return ResponseEntity.status(429).body(Map.of("message", "Import already in progress."));
        }
    }

    @GetMapping("/google-health/status")
    public ResponseEntity<?> getGoogleHealthStatus(@AuthenticationPrincipal Runner runner) {
        if (runner == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(googleHealthImportService.getStatus(runner.getId()));
    }

}
