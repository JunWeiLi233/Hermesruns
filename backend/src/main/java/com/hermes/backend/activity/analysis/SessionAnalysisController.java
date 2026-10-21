package com.hermes.backend.activity.analysis;

import com.hermes.backend.auth.AuthService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/activities/{id}/session-analysis")
public class SessionAnalysisController {
    private final AuthService auth;
    private final SessionAnalysisService analysis;
    public SessionAnalysisController(AuthService auth, SessionAnalysisService analysis) { this.auth = auth; this.analysis = analysis; }
    @GetMapping
    public ResponseEntity<?> read(@PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        var owner = auth.findByAuthorizationHeader(authorization);
        return owner.isEmpty() ? unauthorized() : ResponseEntity.ok(analysis.read(id, owner.get()));
    }
    @PutMapping
    public ResponseEntity<?> save(@PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody Map<String, Object> body) {
        var owner = auth.findByAuthorizationHeader(authorization);
        if (owner.isEmpty()) return unauthorized();
        try { return ResponseEntity.ok(analysis.save(id, owner.get(), body)); }
        catch (IllegalArgumentException invalid) { return ResponseEntity.badRequest().body(Map.of("message", invalid.getMessage())); }
    }
    private static ResponseEntity<?> unauthorized() { return ResponseEntity.status(401).body(Map.of("message", "Sign in required.")); }
    // Keep owner failures scoped here: the application's generic advice maps uncaught exceptions to 500.
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<?> status(org.springframework.web.server.ResponseStatusException failure) {
        return ResponseEntity.status(failure.getStatusCode()).body(Map.of("message", "Activity not found."));
    }
}
