package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/admin/race-course-maps")
public class AdminRacePortalController {
    private static final int MAX_PHOTO_REFERENCE_LENGTH = 2_000_000;
    private static final Set<String> RACE_COURSE_MAP_SCAN_FIELDS = Set.of("raceName", "city", "country", "website", "lat", "lng", "distanceKm");
    private static final Set<String> RACE_COURSE_MAP_UPLOAD_FIELDS = Set.of("raceName", "city", "country", "website", "lat", "lng", "distanceKm", "imageUrl", "imageDataUrl", "fileName");

    private final AdminPortalService adminService;

    public AdminRacePortalController(AdminPortalService adminService) {
        this.adminService = adminService;
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
            RaceCourseMapResult result = adminService.getRaceCourseMapService().scanPendingCourseMap(
                    raceId, raceName, city, country, website, lat, lng, distanceKm, adminOptional.get().getEmail());
            adminService.getAdminAuditService().log(adminOptional.get(), "race_course_map.pending_scanned", "race_course_map", raceId, "Scanned pending race course map");
            return ResponseEntity.ok(result);
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
            RaceCourseMapResult result = adminService.getRaceCourseMapService().uploadPendingCourseMap(
                    raceId, raceName, city, country, website, lat, lng, distanceKm, imageUrl, adminOptional.get().getEmail());
            adminService.getAdminAuditService().log(adminOptional.get(), "race_course_map.pending_uploaded", "race_course_map", raceId, "Uploaded pending race course map");
            return ResponseEntity.ok(result);
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
            RaceCourseMapResult result = adminService.getRaceCourseMapService().reanalyzePendingCourseMap(
                    raceId, raceName, city, country, website, lat, lng, distanceKm, adminOptional.get().getEmail());
            adminService.getAdminAuditService().log(adminOptional.get(), "race_course_map.pending_reanalyzed", "race_course_map", raceId, "Re-analyzed stored pending race course map");
            return ResponseEntity.ok(result);
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
}
