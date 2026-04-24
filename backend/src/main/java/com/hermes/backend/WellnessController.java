package com.hermes.backend;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/wellness")
public class WellnessController {

    private final AppleHealthImportService appleHealthImportService;
    private final GoogleHealthImportService googleHealthImportService;

    public WellnessController(
            AppleHealthImportService appleHealthImportService,
            GoogleHealthImportService googleHealthImportService
    ) {
        this.appleHealthImportService = appleHealthImportService;
        this.googleHealthImportService = googleHealthImportService;
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
