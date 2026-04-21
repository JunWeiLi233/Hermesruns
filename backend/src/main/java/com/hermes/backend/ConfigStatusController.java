package com.hermes.backend;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/config")
public class ConfigStatusController {

    private final SystemConfigService systemConfigService;

    public ConfigStatusController(SystemConfigService systemConfigService) {
        this.systemConfigService = systemConfigService;
    }

    /**
     * Public config check for the SPA to show/hide integration buttons.
     */
    @GetMapping("/status")
    public Map<String, Object> getPublicStatus() {
        return systemConfigService.getPublicConfigStatus();
    }

    /**
     * Detailed diagnostic status for admins.
     */
    @GetMapping("/admin/status")
    public Map<String, Object> getAdminStatus() {
        return systemConfigService.getAdminConfigStatus();
    }
}

