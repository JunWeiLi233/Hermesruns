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
     * Single place for programmers to check which integrations are configured.
     * No secrets are returned.
     */
    @GetMapping("/status")
    public Map<String, Object> getUnifiedStatus() {
        return systemConfigService.getUnifiedConfigStatus();
    }
}

