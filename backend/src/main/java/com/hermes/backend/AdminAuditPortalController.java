package com.hermes.backend;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/admin")
public class AdminAuditPortalController {
    private static final Set<String> JOB_SORT_FIELDS = Set.of("id", "createdAt", "status", "jobType");
    private static final Set<String> AUDIT_SORT_FIELDS = Set.of("id", "createdAt", "action", "targetType");
    private static final Set<String> FILTER_FIELDS = Set.of("scope", "name", "queryJson");

    private final AdminPortalService adminService;

    public AdminAuditPortalController(AdminPortalService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/queues")
    public ResponseEntity<?> queues(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        return ResponseEntity.ok(queueSummaryBody());
    }

    @GetMapping("/jobs")
    public ResponseEntity<?> jobs(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "20") int size,
                                  @RequestParam(defaultValue = "createdAt") String sortBy,
                                  @RequestParam(defaultValue = "desc") String sortDirection,
                                  @RequestParam(defaultValue = "") String jobType,
                                  @RequestParam(defaultValue = "") String status) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        Pageable pageable = adminService.buildPageable(page, size, sortBy, sortDirection, JOB_SORT_FIELDS);
        Page<AdminBackgroundJob> result = adminService.getAdminBackgroundJobRepository().findByJobTypeContainingIgnoreCaseAndStatusContainingIgnoreCase(
                jobType == null ? "" : jobType,
                status == null ? "" : status,
                pageable
        );
        return ResponseEntity.ok(AdminPagedResponse.from(result.map(adminService::toJobDto), pageable.getSort()));
    }

    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<?> job(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                 @PathVariable Long jobId) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        return adminService.getAdminBackgroundJobRepository().findById(jobId)
                .<ResponseEntity<?>>map(job -> ResponseEntity.ok(adminService.toJobDto(job)))
                .orElseGet(() -> AdminApiResponses.error(HttpStatus.NOT_FOUND, "Job not found.", "job_not_found"));
    }

    @PostMapping("/jobs/strava-sync")
    public ResponseEntity<?> triggerStravaSync(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        AdminBackgroundJob job = adminService.getStravaAutoSyncScheduler().triggerAdminSync(adminOptional.get(), "admin_manual");
        adminService.getAdminAuditService().log(adminOptional.get(), "job.strava_sync.triggered", "job", String.valueOf(job.getId()), "Triggered global Strava sync");
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(adminService.toJobDto(job));
    }

    @GetMapping("/audit")
    public ResponseEntity<?> audit(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                   @RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "20") int size,
                                   @RequestParam(defaultValue = "createdAt") String sortBy,
                                   @RequestParam(defaultValue = "desc") String sortDirection,
                                   @RequestParam(defaultValue = "") String search) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        Pageable pageable = adminService.buildPageable(page, size, sortBy, sortDirection, AUDIT_SORT_FIELDS);
        Page<AdminAuditLog> result = (search == null || search.isBlank())
                ? adminService.getAdminAuditLogRepository().findAll(pageable)
                : adminService.getAdminAuditLogRepository().findByActionContainingIgnoreCaseOrTargetTypeContainingIgnoreCaseOrActorEmailContainingIgnoreCase(
                search.trim(), search.trim(), search.trim(), pageable);
        return ResponseEntity.ok(AdminPagedResponse.from(result.map(adminService::toAuditDto), pageable.getSort()));
    }

    @GetMapping("/filters")
    public ResponseEntity<?> filters(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                     @RequestParam(defaultValue = "users") String scope) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        return ResponseEntity.ok(adminService.getAdminSavedFilterRepository().findByOwnerRunnerIdAndScopeOrderByUpdatedAtDesc(adminOptional.get().getId(), scope)
                .stream().map(adminService::toSavedFilterDto).toList());
    }

    @PostMapping("/filters")
    public ResponseEntity<?> saveFilter(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                        @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        final String scope;
        final String name;
        final String queryJson;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, FILTER_FIELDS);
            scope = RequestBodyValidator.requiredSafeText(body, "scope", 50);
            name = RequestBodyValidator.requiredSafeText(body, "name", 120);
            queryJson = RequestBodyValidator.requiredString(body, "queryJson", 8000);
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_saved_filter");
        }
        AdminSavedFilter filter = new AdminSavedFilter();
        filter.setOwnerRunnerId(adminOptional.get().getId());
        filter.setOwnerEmail(adminOptional.get().getEmail());
        filter.setScope(scope);
        filter.setName(name);
        filter.setQueryJson(queryJson);
        AdminSavedFilter saved = adminService.getAdminSavedFilterRepository().save(filter);
        adminService.getAdminAuditService().log(adminOptional.get(), "filter.saved", "saved_filter", String.valueOf(saved.getId()), "Saved admin filter", Map.of("scope", scope));
        return ResponseEntity.status(HttpStatus.CREATED).body(adminService.toSavedFilterDto(saved));
    }

    @DeleteMapping("/filters/{id}")
    public ResponseEntity<?> deleteFilter(@PathVariable Long id,
                                          @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        Optional<AdminSavedFilter> filterOptional = adminService.getAdminSavedFilterRepository().findById(id);
        if (filterOptional.isEmpty() || !Objects.equals(filterOptional.get().getOwnerRunnerId(), adminOptional.get().getId())) {
            return AdminApiResponses.error(HttpStatus.NOT_FOUND, "Saved filter not found.", "saved_filter_not_found");
        }
        adminService.getAdminSavedFilterRepository().delete(filterOptional.get());
        adminService.getAdminAuditService().log(adminOptional.get(), "filter.deleted", "saved_filter", String.valueOf(id), "Deleted admin filter");
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    private Map<String, Object> queueSummaryBody() {
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("unverifiedShoePhotos", adminService.getShoeRepository().findAll(adminService.shoeFilterSpec("", "unverified_photo", false), org.springframework.data.domain.PageRequest.of(0, 8, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"))).map(adminService::toShoeDto).getContent());
        body.put("missingShoeImages", adminService.getShoeRepository().findAll(adminService.shoeFilterSpec("", "missing_photo", false), org.springframework.data.domain.PageRequest.of(0, 8, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"))).map(adminService::toShoeDto).getContent());
        body.put("pendingRaceCourseMaps", adminService.getRaceCourseMapService().listRaceCourseMaps().stream().filter(RaceCourseMapAdminRow::hasPendingPreview).limit(8).toList());
        body.put("recentSignupIssues", adminService.getRunnerRepository().findAll(adminService.userFilterSpec("", "", "", "recent_signup_issues"), org.springframework.data.domain.PageRequest.of(0, 8, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"))).map(r -> adminService.toUserDto(r, 0)).getContent());
        body.put("billingExceptions", adminService.getRunnerRepository().findAll(adminService.userFilterSpec("", "", "", "billing_exceptions"), org.springframework.data.domain.PageRequest.of(0, 8, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"))).map(r -> adminService.toUserDto(r, 0)).getContent());
        body.put("failedSyncs", adminService.getAdminBackgroundJobRepository().findTop10ByStatusInOrderByCreatedAtDesc(List.of(AdminBackgroundJob.STATUS_FAILED)).stream().map(adminService::toJobDto).limit(8).toList());
        return body;
    }
}
