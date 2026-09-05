package com.hermes.backend.admin;

import com.hermes.backend.runner.Runner;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminPortalController {

    private final AdminPortalService adminService;

    public AdminPortalController(AdminPortalService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/overview")
    public ResponseEntity<?> overview(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");

        return ResponseEntity.ok(adminService.overviewBody());
    }
}
