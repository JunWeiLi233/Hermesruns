package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.lang.management.ManagementFactory;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AuthService authService;
    private final RunnerRepository runnerRepository;
    private final ActivityRepository activityRepository;
    private final StravaAutoSyncScheduler stravaAutoSyncScheduler;

    public AdminController(AuthService authService, RunnerRepository runnerRepository,
                           ActivityRepository activityRepository, StravaAutoSyncScheduler stravaAutoSyncScheduler) {
        this.authService = authService;
        this.runnerRepository = runnerRepository;
        this.activityRepository = activityRepository;
        this.stravaAutoSyncScheduler = stravaAutoSyncScheduler;
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = authService.findByAuthorizationHeader(authorizationHeader)
                .filter(authService::isAdmin);

        if (adminOptional.isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin privileges required."));
        }

        Map<String, Object> stats = new HashMap<>();
        long totalUsers = runnerRepository.count();
        long totalActivities = activityRepository.count();

        Runtime runtime = Runtime.getRuntime();
        long maxMemory = runtime.maxMemory();
        long allocatedMemory = runtime.totalMemory();
        long freeMemory = runtime.freeMemory();

        stats.put("totalUsers", totalUsers);
        stats.put("totalActivities", totalActivities);
        stats.put("memoryUsedMb", (allocatedMemory - freeMemory) / (1024 * 1024));
        stats.put("memoryTotalMb", allocatedMemory / (1024 * 1024));
        stats.put("memoryMaxMb", maxMemory / (1024 * 1024));
        stats.put("uptimeMillis", ManagementFactory.getRuntimeMXBean().getUptime());
        stats.put("osName", System.getProperty("os.name"));

        return ResponseEntity.ok(stats);
    }

    @PostMapping("/sync-all")
    public ResponseEntity<?> syncAllStrvarunners(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = authService.findByAuthorizationHeader(authorizationHeader)
                .filter(authService::isAdmin);

        if (adminOptional.isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin privileges required."));
        }

        AdminBackgroundJob job = stravaAutoSyncScheduler.triggerAdminSync(adminOptional.get(), "legacy_admin_endpoint");
        return ResponseEntity.ok(Map.of(
                "message", "Global Strava sync started.",
                "jobId", job.getId(),
                "status", job.getStatus()
        ));
    }
}
