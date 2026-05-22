package com.hermes.backend;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/config")
public class ConfigStatusController {

    private final SystemConfigService systemConfigService;
    private final AuthService authService;

    public ConfigStatusController(SystemConfigService systemConfigService, AuthService authService) {
        this.systemConfigService = systemConfigService;
        this.authService = authService;
    }

    /**
     * Public config check for the SPA to show/hide integration buttons.
     * Requires valid authentication.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getPublicStatus(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(systemConfigService.getPublicConfigStatus());
    }

    /**
     * Detailed diagnostic status for admins.
     * Requires ADMIN role.
     */
    @GetMapping("/admin/status")
    public ResponseEntity<Map<String, Object>> getAdminStatus(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) {
            return ResponseEntity.status(401).build();
        }
        if (!authService.isAdmin(runnerOpt.get())) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(systemConfigService.getAdminConfigStatus());
    }
}

