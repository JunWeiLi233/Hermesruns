package com.hermes.backend.coaching;

import com.hermes.backend.auth.AuthService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RecommendationRevisionController {
    private final AuthService auth;
    private final RecommendationSourceRevision sources;

    public RecommendationRevisionController(AuthService auth, RecommendationSourceRevision sources) {
        this.auth = auth;
        this.sources = sources;
    }

    @GetMapping("/api/coach/revision")
    public ResponseEntity<?> revision(@RequestHeader(value = "Authorization", required = false) String authorization) {
        var runner = auth.findByAuthorizationHeader(authorization);
        if (runner.isEmpty()) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        return ResponseEntity.ok().header("Cache-Control", "private, no-store")
                .body(Map.of("revision", sources.revision(runner.get())));
    }
}
