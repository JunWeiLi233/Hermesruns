package com.hermes.backend.summary;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The summary of one of the signed-in runner's runs. A run that is not the caller's, or is not a run, is answered 404
 * without saying whether it exists.
 */
@RestController
@RequestMapping("/api/activities")
public class RunSummaryController {

    private final AuthService authService;
    private final RunSummaryService service;

    public RunSummaryController(AuthService authService, RunSummaryService service) {
        this.authService = authService;
        this.service = service;
    }

    @GetMapping("/{id}/summary")
    public ResponseEntity<?> summary(
            @PathVariable("id") Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }
        return service.summarise(runner.get(), id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> error(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found."));
    }

    private static ResponseEntity<Map<String, String>> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message, "code", code));
    }
}
