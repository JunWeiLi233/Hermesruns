package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

@RestController
@RequestMapping("/api/admin/race-course-maps")
public class AdminRacePortalController {
    private static final Logger log = LoggerFactory.getLogger(AdminRacePortalController.class);
    private static final int MAX_PHOTO_REFERENCE_LENGTH = 2_000_000;
    private static final Set<String> RACE_COURSE_MAP_SCAN_FIELDS = Set.of("raceName", "city", "country", "website", "lat", "lng", "distanceKm");
    private static final Set<String> RACE_COURSE_MAP_UPLOAD_FIELDS = Set.of("raceName", "city", "country", "website", "lat", "lng", "distanceKm", "imageUrl", "imageDataUrl", "fileName");

    private final AdminPortalService adminService;
    private final AdminBackgroundJobService adminBackgroundJobService;
    private final CourseMapScanWatcher courseMapScanWatcher;

    public AdminRacePortalController(AdminPortalService adminService, AdminBackgroundJobService adminBackgroundJobService) {
        this(adminService, adminBackgroundJobService, new CourseMapScanWatcher());
    }

    @org.springframework.beans.factory.annotation.Autowired
    public AdminRacePortalController(AdminPortalService adminService, AdminBackgroundJobService adminBackgroundJobService, CourseMapScanWatcher courseMapScanWatcher) {
        this.adminService = adminService;
        this.adminBackgroundJobService = adminBackgroundJobService;
        this.courseMapScanWatcher = courseMapScanWatcher;
    }

    @GetMapping
    public ResponseEntity<?> raceCourseMaps(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        return ResponseEntity.ok(adminService.getRaceCourseMapService().listRaceCourseMaps());
    }

    @GetMapping("/{raceId}")
    public ResponseEntity<?> raceCourseMapDetail(@PathVariable String raceId,
                                                 @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        try {
            return ResponseEntity.ok(adminService.getRaceCourseMapService().getAdminDetail(raceId));
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.NOT_FOUND, ex.getMessage(), "race_course_map_not_found");
        }
    }

    @PostMapping("/{raceId}/pending/scan")
    public ResponseEntity<?> scanRaceCourseMap(@PathVariable String raceId,
                                               @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                               @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, RACE_COURSE_MAP_SCAN_FIELDS);
            String raceName = RequestBodyValidator.requiredSafeText(body, "raceName", 160);
            String city = RequestBodyValidator.optionalSafeText(body, "city", 120);
            String country = RequestBodyValidator.optionalSafeText(body, "country", 120);
            String website = RequestBodyValidator.optionalString(body, "website", MAX_PHOTO_REFERENCE_LENGTH);
            Double lat = adminService.readOptionalDouble(body, "lat");
            Double lng = adminService.readOptionalDouble(body, "lng");
            Double distanceKm = adminService.readOptionalDouble(body, "distanceKm");
            AdminBackgroundJob job = adminBackgroundJobService.createJob(
                    "COURSE_MAP_PREVIEW_SCAN",
                    "admin_manual",
                    adminOptional.get(),
                    "Queued course-map source scan.",
                    Map.of("raceId", raceId, "action", "scan")
            );
            Runner admin = adminOptional.get();
            adminBackgroundJobService.runCourseMapScanAsync(job, 1, () -> {
                AtomicReference<List<CourseMapScanStep>> scanSteps = new AtomicReference<>(List.of());
                try {
                    RaceCourseMapResult result;
                    try (CourseMapScanWatcher.ScanScope ignored = courseMapScanWatcher.watch(
                            raceId,
                            "scan",
                            steps -> {
                                scanSteps.set(steps);
                                adminBackgroundJobService.updateDetails(job, courseMapJobDetails(raceId, "scan", steps));
                            }
                    )) {
                        result = adminService.getRaceCourseMapService().scanPendingCourseMap(
                                raceId, raceName, city, country, website, lat, lng, distanceKm, admin.getEmail());
                        scanSteps.set(courseMapScanWatcher.currentSteps());
                    }
                    safeAuditLog(admin, "race_course_map.pending_scanned", "race_course_map", raceId, "Scanned pending race course map");
                    adminBackgroundJobService.markCompleted(
                            job,
                            1,
                            0,
                            result.summary(),
                            courseMapJobDetails(
                                    raceId,
                                    "scan",
                                    scanSteps.get(),
                                    "courseMapDetected", result.courseMapDetected(),
                                    "confidence", result.confidence()
                            )
                    );
                } catch (Exception ex) {
                    log.error("Admin course-map source scan failed for raceId={}", raceId, ex);
                    String failureSummary = "Course-map source scan failed: " + safeMessage(ex);
                    safeMarkPendingCourseMapScanFailed(raceId, failureSummary, admin.getEmail());
                    adminBackgroundJobService.markCompleted(
                            job,
                            0,
                            1,
                            failureSummary,
                            courseMapJobDetails(raceId, "scan", scanSteps.get(), "error", safeMessage(ex))
                    );
                }
            });
            return ResponseEntity.accepted().body(Map.of("jobId", job.getId()));
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_race_course_map");
        }
    }

    @PostMapping("/{raceId}/pending/upload")
    public ResponseEntity<?> uploadRaceCourseMap(@PathVariable String raceId,
                                                 @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                                 @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, RACE_COURSE_MAP_UPLOAD_FIELDS);
            String raceName = RequestBodyValidator.requiredSafeText(body, "raceName", 160);
            String city = RequestBodyValidator.optionalSafeText(body, "city", 120);
            String country = RequestBodyValidator.optionalSafeText(body, "country", 120);
            String website = RequestBodyValidator.optionalString(body, "website", MAX_PHOTO_REFERENCE_LENGTH);
            String imageUrl = body != null && body.get("imageDataUrl") instanceof String data ? data : RequestBodyValidator.requiredString(body, "imageUrl", MAX_PHOTO_REFERENCE_LENGTH);
            Double lat = adminService.readOptionalDouble(body, "lat");
            Double lng = adminService.readOptionalDouble(body, "lng");
            Double distanceKm = adminService.readOptionalDouble(body, "distanceKm");
            AdminBackgroundJob job = adminBackgroundJobService.createJob(
                    "COURSE_MAP_PREVIEW_UPLOAD",
                    "admin_manual",
                    adminOptional.get(),
                    "Queued course-map preview upload and FIFO scan.",
                    Map.of("raceId", raceId, "action", "upload_scan")
            );
            Runner admin = adminOptional.get();
            adminBackgroundJobService.runCourseMapScanAsync(job, 1, () -> {
                AtomicReference<List<CourseMapScanStep>> scanSteps = new AtomicReference<>(List.of());
                try {
                    RaceCourseMapResult uploadResult = adminService.getRaceCourseMapService().uploadPendingCourseMap(
                            raceId, raceName, city, country, website, lat, lng, distanceKm, imageUrl, admin.getEmail());
                    safeAuditLog(admin, "race_course_map.pending_uploaded", "race_course_map", raceId, "Uploaded pending race course map");
                    adminBackgroundJobService.updateDetails(
                            job,
                            courseMapJobDetails(
                                    raceId,
                                    "upload_scan",
                                    List.of(),
                                    "uploadStored", true,
                                    "uploadConfidence", uploadResult.confidence()
                            )
                    );
                    RaceCourseMapResult result;
                    try (CourseMapScanWatcher.ScanScope ignored = courseMapScanWatcher.watch(
                            raceId,
                            "upload_scan",
                            steps -> {
                                scanSteps.set(steps);
                                adminBackgroundJobService.updateDetails(job, courseMapJobDetails(
                                        raceId,
                                        "upload_scan",
                                        steps,
                                        "uploadStored", true
                                ));
                            }
                    )) {
                        result = adminService.getRaceCourseMapService().reanalyzePendingCourseMap(
                                raceId, raceName, city, country, website, lat, lng, distanceKm, admin.getEmail());
                        scanSteps.set(courseMapScanWatcher.currentSteps());
                    }
                    safeAuditLog(admin, "race_course_map.pending_auto_scanned", "race_course_map", raceId, "Auto-scanned uploaded pending race course map");
                    adminBackgroundJobService.markCompleted(
                            job,
                            1,
                            0,
                            result.summary(),
                            courseMapJobDetails(
                                    raceId,
                                    "upload_scan",
                                    scanSteps.get(),
                                    "uploadStored", true,
                                    "courseMapDetected", result.courseMapDetected(),
                                    "confidence", result.confidence()
                            )
                    );
                } catch (Exception ex) {
                    log.error("Admin course-map upload/scan failed for raceId={}", raceId, ex);
                    String failureSummary = "Course-map upload scan failed: " + safeMessage(ex);
                    safeMarkPendingCourseMapScanFailed(raceId, failureSummary, admin.getEmail());
                    adminBackgroundJobService.markCompleted(
                            job,
                            0,
                            1,
                            failureSummary,
                            courseMapJobDetails(raceId, "upload_scan", scanSteps.get(), "error", safeMessage(ex))
                    );
                }
            });
            return ResponseEntity.accepted().body(Map.of("jobId", job.getId()));
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_race_course_map");
        }
    }


    @PostMapping("/{raceId}/pending/reanalyze")
    public ResponseEntity<?> reanalyzeRaceCourseMap(@PathVariable String raceId,
                                                    @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                                    @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, RACE_COURSE_MAP_SCAN_FIELDS);
            String raceName = RequestBodyValidator.requiredSafeText(body, "raceName", 160);
            String city = RequestBodyValidator.optionalSafeText(body, "city", 120);
            String country = RequestBodyValidator.optionalSafeText(body, "country", 120);
            String website = RequestBodyValidator.optionalString(body, "website", MAX_PHOTO_REFERENCE_LENGTH);
            Double lat = adminService.readOptionalDouble(body, "lat");
            Double lng = adminService.readOptionalDouble(body, "lng");
            Double distanceKm = adminService.readOptionalDouble(body, "distanceKm");
            AdminBackgroundJob job = adminBackgroundJobService.createJob(
                    "COURSE_MAP_PREVIEW_REANALYZE",
                    "admin_manual",
                    adminOptional.get(),
                    "Queued course-map re-analysis.",
                    Map.of("raceId", raceId, "action", "reanalyze")
            );
            Runner admin = adminOptional.get();
            adminBackgroundJobService.runCourseMapScanAsync(job, 1, () -> {
                AtomicReference<List<CourseMapScanStep>> scanSteps = new AtomicReference<>(List.of());
                try {
                    RaceCourseMapResult result;
                    try (CourseMapScanWatcher.ScanScope ignored = courseMapScanWatcher.watch(
                            raceId,
                            "reanalyze",
                            steps -> {
                                scanSteps.set(steps);
                                adminBackgroundJobService.updateDetails(job, courseMapJobDetails(raceId, "reanalyze", steps));
                            }
                    )) {
                        result = adminService.getRaceCourseMapService().reanalyzePendingCourseMap(
                                raceId, raceName, city, country, website, lat, lng, distanceKm, admin.getEmail());
                        scanSteps.set(courseMapScanWatcher.currentSteps());
                    }
                    safeAuditLog(admin, "race_course_map.pending_reanalyzed", "race_course_map", raceId, "Re-analyzed stored pending race course map");
                    adminBackgroundJobService.markCompleted(
                            job,
                            1,
                            0,
                            result.summary(),
                            courseMapJobDetails(
                                    raceId,
                                    "reanalyze",
                                    scanSteps.get(),
                                    "courseMapDetected", result.courseMapDetected(),
                                    "confidence", result.confidence()
                            )
                    );
                } catch (Exception ex) {
                    log.error("Admin course-map reanalyze failed for raceId={}", raceId, ex);
                    String failureSummary = "Course-map re-analysis failed: " + safeMessage(ex);
                    safeMarkPendingCourseMapScanFailed(raceId, failureSummary, admin.getEmail());
                    adminBackgroundJobService.markCompleted(
                            job,
                            0,
                            1,
                            failureSummary,
                            courseMapJobDetails(raceId, "reanalyze", scanSteps.get(), "error", safeMessage(ex))
                    );
                }
            });
            return ResponseEntity.accepted().body(Map.of("jobId", job.getId()));
        } catch (IllegalArgumentException ex) {
            if ("race_course_map_pending_missing".equals(ex.getMessage())) {
                return AdminApiResponses.error(HttpStatus.NOT_FOUND, ex.getMessage(), "race_course_map_pending_missing");
            }
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_race_course_map");
        }
    }

    @PostMapping("/{raceId}/accept-live")
    public ResponseEntity<?> acceptRaceCourseMap(@PathVariable String raceId,
                                                 @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        try {
            adminService.getRaceCourseMapService().acceptPendingCourseMap(raceId, adminOptional.get().getEmail());
            adminService.getAdminAuditService().log(adminOptional.get(), "race_course_map.published", "race_course_map", raceId, "Published live race course map");
            return ResponseEntity.ok(Map.of("published", true));
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_race_course_map");
        }
    }

    @GetMapping("/{raceId}/scan-timeline")
    public ResponseEntity<?> getRaceCourseMapScanTimeline(@PathVariable String raceId,
                                                          @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        return ResponseEntity.ok(adminBackgroundJobService.getCourseMapScanTimeline(raceId));
    }

    @DeleteMapping("/{raceId}/pending")
    public ResponseEntity<?> clearPendingRaceCourseMap(@PathVariable String raceId,
                                                       @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        try {
            adminService.getRaceCourseMapService().clearPendingCourseMap(raceId);
            adminService.getAdminAuditService().log(adminOptional.get(), "race_course_map.pending_cleared", "race_course_map", raceId, "Cleared pending race course map");
            return ResponseEntity.ok(Map.of("cleared", true));
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_race_course_map");
        }
    }

    private void safeAuditLog(Runner actor, String action, String targetType, String targetId, String summary) {
        try {
            adminService.getAdminAuditService().log(actor, action, targetType, targetId, summary);
        } catch (Exception ex) {
            log.error("Admin audit log failed for action={} targetType={} targetId={}", action, targetType, targetId, ex);
        }
    }

    private void safeMarkPendingCourseMapScanFailed(String raceId, String summary, String actorEmail) {
        try {
            adminService.getRaceCourseMapService().markPendingCourseMapScanFailed(raceId, summary, actorEmail);
        } catch (Exception ex) {
            log.warn("Failed to persist course-map scan failure summary for raceId={}", raceId, ex);
        }
    }

    private Map<String, Object> courseMapJobDetails(String raceId, String action, List<CourseMapScanStep> scanSteps, Object... extraPairs) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("raceId", raceId);
        details.put("action", action);
        details.put("qwenScanSteps", scanSteps == null ? List.of() : scanSteps);
        if (scanSteps != null && !scanSteps.isEmpty()) {
            details.put("lastQwenScanStep", scanSteps.get(scanSteps.size() - 1));
        }
        for (int i = 0; i + 1 < extraPairs.length; i += 2) {
            details.put(String.valueOf(extraPairs[i]), extraPairs[i + 1]);
        }
        return details;
    }

    private String safeMessage(Exception ex) {
        if (ex == null || ex.getMessage() == null || ex.getMessage().isBlank()) {
            return "Unknown failure";
        }
        return ex.getMessage();
    }
}
