package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/shoes/query-normalization")
public class ShoeQueryNormalizationController {
    private static final Set<String> NORMALIZATION_FIELDS = Set.of("rawInput");

    private final AuthService authService;
    private final ShoeQueryNormalizationService shoeQueryNormalizationService;

    public ShoeQueryNormalizationController(
            AuthService authService,
            ShoeQueryNormalizationService shoeQueryNormalizationService
    ) {
        this.authService = authService;
        this.shoeQueryNormalizationService = shoeQueryNormalizationService;
    }

    @PostMapping
    public ResponseEntity<?> normalize(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid Session"));
        }

        try {
            RequestBodyValidator.requireBody(body);
            RequestBodyValidator.rejectUnexpectedFields(body, NORMALIZATION_FIELDS);
            String rawInput = RequestBodyValidator.requiredSafeText(body, "rawInput", 240);
            return ResponseEntity.ok(shoeQueryNormalizationService.normalize(rawInput));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", ex.getMessage()));
        }
    }
}
