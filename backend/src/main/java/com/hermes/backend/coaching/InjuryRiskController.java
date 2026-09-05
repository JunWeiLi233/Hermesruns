package com.hermes.backend.coaching;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/injury-risk")
public class InjuryRiskController {

    private static final Logger log = LoggerFactory.getLogger(InjuryRiskController.class);

    private final InjuryRiskService injuryRiskService;
    private final AuthService authService;
    private final AutomatedCoachService automatedCoachService;

    public InjuryRiskController(InjuryRiskService injuryRiskService, AuthService authService) {
        this(injuryRiskService, authService, null);
    }

    @Autowired
    public InjuryRiskController(
            InjuryRiskService injuryRiskService,
            AuthService authService,
            AutomatedCoachService automatedCoachService
    ) {
        this.injuryRiskService = injuryRiskService;
        this.authService = authService;
        this.automatedCoachService = automatedCoachService;
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus(HttpServletRequest request) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(request.getHeader("Authorization"));
        if (runnerOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid or expired session token."));
        }
        InjuryRiskService.InjuryRiskAssessment assessment = injuryRiskService.getRiskAssessment(runnerOpt.get());
        return ResponseEntity.ok(assessment);
    }

    @PostMapping({"/soreness", "/log"})
    public ResponseEntity<?> logSoreness(@RequestBody Map<String, String> body, HttpServletRequest request) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(request.getHeader("Authorization"));
        if (runnerOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid or expired session token."));
        }
        String level = body == null ? null : body.get("level");
        if (level == null || level.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "level is required (LOW, MEDIUM, or HIGH)."));
        }
        String normalizedLevel = level.trim().toUpperCase(Locale.ROOT);
        if (!(normalizedLevel.equals("LOW") || normalizedLevel.equals("MEDIUM") || normalizedLevel.equals("HIGH"))) {
            return ResponseEntity.badRequest().body(Map.of("error", "level must be LOW, MEDIUM, or HIGH."));
        }
        String notes = body == null ? null : body.get("notes");
        if (notes != null && notes.length() > 500) {
            return ResponseEntity.badRequest().body(Map.of("error", "notes must be 500 characters or fewer."));
        }
        Runner runner = runnerOpt.get();
        SorenessLog logEntry = injuryRiskService.logSoreness(runner, normalizedLevel, notes);
        if (automatedCoachService != null) automatedCoachService.replanFutureSchedule(runner);
        return ResponseEntity.ok(Map.of(
                "id", logEntry.getId(),
                "level", logEntry.getLevel(),
                "date", logEntry.getDate().toString(),
                "createdAt", logEntry.getCreatedAt().toString()
        ));
    }
}
