package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("kpis", List.of(
                adminService.kpi("Active users", adminService.getRunnerRepository().countByDeletedFalse(), adminService.dailyUserTrend(7)),
                adminService.kpi("Shoes", adminService.getShoeRepository().count(), adminService.dailyShoeTrend(7)),
                adminService.kpi("Missing shoe images", adminService.getShoeRepository().count(adminService.shoeFilterSpec("", "missing_photo", false)), List.of()),
                adminService.kpi("Unverified shoe photos", adminService.getShoeRepository().count(adminService.shoeFilterSpec("", "unverified_photo", false)), List.of()),
                adminService.kpi("Recent signup issues", adminService.getRunnerRepository().count(adminService.userFilterSpec("", "", "", "recent_signup_issues")), List.of()),
                adminService.kpi("Billing exceptions", adminService.getRunnerRepository().count(adminService.userFilterSpec("", "", "", "billing_exceptions")), List.of()),
                adminService.kpi("Failed sync jobs", adminService.getAdminBackgroundJobRepository().findTop10ByStatusInOrderByCreatedAtDesc(
                        List.of(AdminBackgroundJob.STATUS_FAILED)).size(), List.of())
        ));
        response.put("queues", queueSummaryBody());
        response.put("recentJobs", adminService.getAdminBackgroundJobRepository().findTop10ByStatusInOrderByCreatedAtDesc(
                List.of(AdminBackgroundJob.STATUS_RUNNING, AdminBackgroundJob.STATUS_FAILED, AdminBackgroundJob.STATUS_COMPLETED))
                .stream()
                .map(adminService::toJobDto)
                .toList());
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> queueSummaryBody() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("unverifiedShoePhotos", adminService.getShoeRepository().findAll(adminService.shoeFilterSpec("", "unverified_photo", false), org.springframework.data.domain.PageRequest.of(0, 8, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"))).map(adminService::toShoeDto).getContent());
        body.put("missingShoeImages", adminService.getShoeRepository().findAll(adminService.shoeFilterSpec("", "missing_photo", false), org.springframework.data.domain.PageRequest.of(0, 8, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"))).map(adminService::toShoeDto).getContent());
        body.put("pendingRaceCourseMaps", adminService.getRaceCourseMapService().listRaceCourseMaps().stream().filter(RaceCourseMapAdminRow::hasPendingPreview).limit(8).toList());
        body.put("recentSignupIssues", adminService.getRunnerRepository().findAll(adminService.userFilterSpec("", "", "", "recent_signup_issues"), org.springframework.data.domain.PageRequest.of(0, 8, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"))).map(r -> adminService.toUserDto(r, 0)).getContent());
        body.put("billingExceptions", adminService.getRunnerRepository().findAll(adminService.userFilterSpec("", "", "", "billing_exceptions"), org.springframework.data.domain.PageRequest.of(0, 8, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"))).map(r -> adminService.toUserDto(r, 0)).getContent());
        body.put("failedSyncs", adminService.getAdminBackgroundJobRepository().findTop10ByStatusInOrderByCreatedAtDesc(List.of(AdminBackgroundJob.STATUS_FAILED)).stream().map(adminService::toJobDto).limit(8).toList());
        return body;
    }
}
