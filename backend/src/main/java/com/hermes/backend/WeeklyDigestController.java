package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/weekly-digest")
public class WeeklyDigestController {
    private final AuthService authService;
    private final WeeklyDigestService weeklyDigestService;

    public WeeklyDigestController(AuthService authService, WeeklyDigestService weeklyDigestService) {
        this.authService = authService;
        this.weeklyDigestService = weeklyDigestService;
    }

    @GetMapping
    public ResponseEntity<?> getWeeklyDigest(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or expired session token."));
        }
        return ResponseEntity.ok(weeklyDigestService.buildDigest(runner.get()));
    }
}
