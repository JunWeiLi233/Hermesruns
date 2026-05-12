package com.hermes.backend;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/injury-risk")
public class InjuryRiskController {

    private static final Logger log = LoggerFactory.getLogger(InjuryRiskController.class);

    private final InjuryRiskService injuryRiskService;
    private final AuthService authService;

    public InjuryRiskController(InjuryRiskService injuryRiskService, AuthService authService) {
        this.injuryRiskService = injuryRiskService;
        this.authService = authService;
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus(HttpServletRequest request) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(request.getHeader("Authorization"));
        if (runnerOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        InjuryRiskService.InjuryRiskAssessment assessment = injuryRiskService.getRiskAssessment(runnerOpt.get());
        return ResponseEntity.ok(assessment);
    }

    @PostMapping("/soreness")
    public ResponseEntity<?> logSoreness(@RequestBody Map<String, String> body, HttpServletRequest request) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(request.getHeader("Authorization"));
        if (runnerOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        String level = body.get("level");
        if (level == null || !(level.equals("LOW") || level.equals("MEDIUM") || level.equals("HIGH"))) {
            return ResponseEntity.badRequest().body(Map.of("error", "level must be LOW, MEDIUM, or HIGH"));
        }
        String notes = body.getOrDefault("notes", null);
        SorenessLog logEntry = injuryRiskService.logSoreness(runnerOpt.get(), level.toUpperCase(), notes);
        return ResponseEntity.ok(Map.of(
                "id", logEntry.getId(),
                "level", logEntry.getLevel(),
                "date", logEntry.getDate().toString(),
                "createdAt", logEntry.getCreatedAt().toString()
        ));
    }
}
