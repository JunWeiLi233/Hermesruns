package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/cosmetics")
public class DigitalCosmeticsController {
    private final AuthService authService;
    private final DigitalCosmeticsService digitalCosmeticsService;

    public DigitalCosmeticsController(AuthService authService, DigitalCosmeticsService digitalCosmeticsService) {
        this.authService = authService;
        this.digitalCosmeticsService = digitalCosmeticsService;
    }

    @GetMapping("/inventory")
    public ResponseEntity<?> inventory(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) {
            return invalidSession();
        }
        return ResponseEntity.ok(Map.of(
                "items", digitalCosmeticsService.listInventory(user.get())
        ));
    }

    @GetMapping("/theme")
    public ResponseEntity<?> activeTheme(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) {
            return invalidSession();
        }
        DigitalCosmeticsService.ActiveThemePayload payload = digitalCosmeticsService.getActiveTheme(user.get());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("activeTheme", payload);
        return ResponseEntity.ok(body);
    }

    private ResponseEntity<Map<String, String>> invalidSession() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid Session"));
    }
}
