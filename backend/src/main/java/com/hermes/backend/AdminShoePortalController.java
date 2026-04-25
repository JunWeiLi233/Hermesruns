package com.hermes.backend;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/admin/shoes")
public class AdminShoePortalController {
    private static final int MAX_PHOTO_REFERENCE_LENGTH = 2_000_000;
    private static final Set<String> SHOE_SORT_FIELDS = Set.of("id", "brand", "model", "createdAt");
    private static final Set<String> BULK_SHOE_FIELDS = Set.of("ids", "action", "dryRun");
    private static final Set<String> CREATE_SHOE_FIELDS = Set.of(
            "runnerId", "runnerEmail", "brand", "model", "nickname", "maxDistanceKm", "isPrimary", "initialDistanceKm", "photoUrl"
    );
    private static final Set<String> SHOE_PENDING_IMAGE_FIELDS = Set.of("imageUrl", "source");

    private final AdminPortalService adminService;

    public AdminShoePortalController(AdminPortalService adminService) {
        this.adminService = adminService;
    }

    @GetMapping
    public ResponseEntity<?> shoes(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String queue,
            @RequestParam(defaultValue = "false") boolean includeRetired
    ) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        Pageable pageable = adminService.buildPageable(page, size, sortBy, sortDirection, SHOE_SORT_FIELDS);
        Page<Shoe> result = adminService.getShoeRepository().findAll(adminService.shoeFilterSpec(search, queue, includeRetired), pageable);
        Map<String, ShoeImageAsset> assetMap = adminService.getShoeAdminAggregateService().loadAssetsForShoes(result.getContent());
        Page<ShoeAdminDto> dtoPage = result.map(shoe -> {
            String identityKey = shoe.getIdentityKey();
            ShoeImageAsset asset = (identityKey == null || identityKey.isBlank()) ? null : assetMap.get(identityKey);
            return adminService.toShoeDto(shoe, asset);
        });
        return ResponseEntity.ok(AdminPagedResponse.from(dtoPage, pageable.getSort()));
    }

    @GetMapping("/export")
    public ResponseEntity<?> exportShoes(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                         @RequestParam(defaultValue = "") String search,
                                         @RequestParam(defaultValue = "") String queue,
                                         @RequestParam(defaultValue = "false") boolean includeRetired) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");

        List<Shoe> shoes = adminService.getShoeRepository().findAll(adminService.shoeFilterSpec(search, queue, includeRetired), Sort.by(Sort.Direction.DESC, "createdAt"));
        StringBuilder csv = new StringBuilder("id,brand,model,nickname,runnerEmail,photoVerified,retired,createdAt\n");
        for (Shoe shoe : shoes) {
            csv.append(adminService.csvCell(String.valueOf(shoe.getId()))).append(',')
                    .append(adminService.csvCell(shoe.getBrand())).append(',')
                    .append(adminService.csvCell(shoe.getModel())).append(',')
                    .append(adminService.csvCell(shoe.getNickname())).append(',')
                    .append(adminService.csvCell(shoe.getRunner() == null ? "" : shoe.getRunner().getEmail())).append(',')
                    .append(adminService.csvCell(String.valueOf(shoe.isPhotoVerified()))).append(',')
                    .append(adminService.csvCell(String.valueOf(shoe.isRetired()))).append(',')
                    .append(adminService.csvCell(shoe.getCreatedAt() == null ? "" : shoe.getCreatedAt().toString()))
                    .append('\n');
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=admin-shoes.csv")
                .contentType(MediaType.TEXT_PLAIN)
                .body(csv.toString());
    }

    @PostMapping
    public ResponseEntity<?> createShoe(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                        @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");

        final Runner runner;
        final String brand;
        final String model;
        final String nickname;
        final boolean isPrimary;
        final String photoUrlRaw;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, CREATE_SHOE_FIELDS);
            runner = adminService.resolveRunnerForShoe(body).orElse(null);
            if (runner == null || runner.isDeleted()) {
                return AdminApiResponses.error(HttpStatus.NOT_FOUND, "Runner not found.", "runner_not_found");
            }
            brand = RequestBodyValidator.requiredSafeText(body, "brand", 100);
            model = RequestBodyValidator.requiredSafeText(body, "model", 100);
            nickname = RequestBodyValidator.optionalSafeText(body, "nickname", 80);
            isPrimary = RequestBodyValidator.booleanOrDefault(body, "isPrimary", false);
            photoUrlRaw = RequestBodyValidator.optionalString(body, "photoUrl", MAX_PHOTO_REFERENCE_LENGTH);
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_shoe");
        }

        try {
            InputSanitizer.rejectControlAndHtmlChars(brand, "brand");
            InputSanitizer.rejectControlAndHtmlChars(model, "model");
            if (nickname != null) InputSanitizer.rejectControlAndHtmlChars(nickname, "nickname");
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_shoe");
        }

        final String finalPhotoUrl;
        try {
            finalPhotoUrl = SafeUrlValidator.validateHttpUrlOrImageDataUrlOrNull(photoUrlRaw, MAX_PHOTO_REFERENCE_LENGTH, "photoUrl");
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_shoe");
        }

        Shoe shoe = new Shoe();
        shoe.setRunner(runner);
        shoe.setBrand(brand);
        shoe.setModel(model);
        shoe.setNickname(nickname);
        shoe.setPhotoUrl(finalPhotoUrl);
        shoe.setPhotoVerified(false);
        shoe.setIsPrimary(isPrimary);

        if (body != null && body.containsKey("maxDistanceKm")) {
            try {
                shoe.setMaxDistanceKm(RequestBodyValidator.optionalDouble(body, "maxDistanceKm", 0, 99999, null));
            } catch (IllegalArgumentException ex) {
                return AdminApiResponses.error(HttpStatus.BAD_REQUEST, "Invalid max distance.", "invalid_shoe");
            }
        }
        if (body != null && body.containsKey("initialDistanceKm")) {
            try {
                shoe.setInitialDistanceKm(RequestBodyValidator.optionalDouble(body, "initialDistanceKm", 0, 99999, null));
            } catch (IllegalArgumentException ex) {
                return AdminApiResponses.error(HttpStatus.BAD_REQUEST, "Invalid initial distance.", "invalid_shoe");
            }
        }

        adminService.getShoeAdminAggregateService().applyIdentityKey(shoe);
        Shoe saved = adminService.getShoeRepository().save(shoe);
        adminService.getAdminAuditService().log(adminOptional.get(), "shoe.created", "shoe", String.valueOf(saved.getId()),
                "Admin created shoe",
                Map.of(
                        "runnerId", runner.getId(),
                        "runnerEmail", runner.getEmail(),
                        "brand", saved.getBrand(),
                        "model", saved.getModel()
                ));
        return ResponseEntity.status(HttpStatus.CREATED).body(adminService.toShoeDto(saved));
    }

    @PostMapping("/{id}/pending-image")
    public ResponseEntity<?> setPendingShoeImage(@PathVariable Long id,
                                                 @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                                 @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        Optional<Shoe> shoeOptional = adminService.getShoeRepository().findById(id);
        if (shoeOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.NOT_FOUND, "Shoe not found.", "shoe_not_found");
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, SHOE_PENDING_IMAGE_FIELDS);
            String imageUrl = RequestBodyValidator.requiredString(body, "imageUrl", MAX_PHOTO_REFERENCE_LENGTH);
            String source = RequestBodyValidator.optionalSafeText(body, "source", 240);
            String finalUrl = SafeUrlValidator.validateHttpUrlOrImageDataUrlOrNull(imageUrl, MAX_PHOTO_REFERENCE_LENGTH, "imageUrl");
            ShoeImageAsset asset = adminService.getShoeAdminAggregateService().upsertPendingForShoe(shoeOptional.get(), finalUrl, source, adminOptional.get().getEmail());
            adminService.getAdminAuditService().log(adminOptional.get(), "shoe_image.pending_set", "shoe", String.valueOf(id), "Saved pending shoe image", Map.of("identityKey", asset.getIdentityKey()));
            return ResponseEntity.ok(Map.of(
                    "pendingImageUrl", asset.getPendingImageUrl(),
                    "pendingSource", asset.getPendingSource()
            ));
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_shoe_image");
        }
    }

    @PostMapping("/{id}/pending/upload")
    public ResponseEntity<?> setPendingShoeImageAlias(@PathVariable Long id,
                                                      @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                                      @RequestBody(required = false) Map<String, Object> body) {
        return setPendingShoeImage(id, authorizationHeader, body);
    }

    @PostMapping("/{id}/accept-image")
    public ResponseEntity<?> acceptPendingShoeImage(@PathVariable Long id,
                                                    @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        Optional<Shoe> shoeOptional = adminService.getShoeRepository().findById(id);
        if (shoeOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.NOT_FOUND, "Shoe not found.", "shoe_not_found");
        try {
            ShoeImageAsset asset = adminService.getShoeAdminAggregateService().acceptPendingForShoe(shoeOptional.get(), adminOptional.get().getEmail());
            adminService.getAdminAuditService().log(adminOptional.get(), "shoe_image.published", "shoe", String.valueOf(id), "Published live shoe image", Map.of("identityKey", asset.getIdentityKey()));
            return ResponseEntity.ok(Map.of("published", true, "liveImageUrl", asset.getLiveImageUrl()));
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_shoe_image");
        }
    }

    @PostMapping("/{id}/accept-live")
    public ResponseEntity<?> acceptPendingShoeImageAlias(@PathVariable Long id,
                                                         @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        return acceptPendingShoeImage(id, authorizationHeader);
    }

    @DeleteMapping("/{id}/pending-image")
    public ResponseEntity<?> clearPendingShoeImage(@PathVariable Long id,
                                                   @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        Optional<Shoe> shoeOptional = adminService.getShoeRepository().findById(id);
        if (shoeOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.NOT_FOUND, "Shoe not found.", "shoe_not_found");
        try {
            adminService.getShoeAdminAggregateService().clearPendingForShoe(shoeOptional.get());
            adminService.getAdminAuditService().log(adminOptional.get(), "shoe_image.pending_cleared", "shoe", String.valueOf(id), "Cleared pending shoe image");
            return ResponseEntity.ok(Map.of("cleared", true));
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_shoe_image");
        }
    }

    @DeleteMapping("/{id}/pending")
    public ResponseEntity<?> clearPendingShoeImageAlias(@PathVariable Long id,
                                                        @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        return clearPendingShoeImage(id, authorizationHeader);
    }

    @PostMapping("/bulk")
    public ResponseEntity<?> bulkShoes(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                       @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, BULK_SHOE_FIELDS);
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_bulk_request");
        }
        BulkSelection selection = adminService.parseSelection(body);
        if (selection.ids().isEmpty()) return AdminApiResponses.error(HttpStatus.BAD_REQUEST, "ids is required.", "missing_ids");

        final String action;
        final boolean dryRun;
        try {
            action = RequestBodyValidator.requiredSafeText(body, "action", 32);
            dryRun = RequestBodyValidator.booleanOrDefault(body, "dryRun", false);
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_bulk_request");
        }
        List<Shoe> shoes = adminService.getShoeRepository().findAllById(selection.ids());
        int affected = (int) shoes.stream().filter(shoe -> adminService.isShoeBulkActionApplicable(shoe, action)).count();
        if (dryRun) return ResponseEntity.ok(Map.of("dryRun", true, "action", action, "selected", selection.ids().size(), "affected", affected));

        for (Shoe shoe : shoes) {
            if (!adminService.isShoeBulkActionApplicable(shoe, action)) continue;
            switch (action) {
                case "verify_photo" -> shoe.setPhotoVerified(true);
                case "unverify_photo" -> shoe.setPhotoVerified(false);
                case "clear_photo" -> {
                    shoe.setPhotoUrl(null);
                    shoe.setPhotoVerified(false);
                }
                default -> {
                    return AdminApiResponses.error(HttpStatus.BAD_REQUEST, "Unsupported bulk action.", "unsupported_action");
                }
            }
            adminService.getShoeRepository().save(shoe);
            adminService.getAdminAuditService().log(adminOptional.get(), "shoe.bulk." + action, "shoe", String.valueOf(shoe.getId()),
                    "Applied bulk action to shoe", Map.of("brand", shoe.getBrand(), "model", shoe.getModel()));
        }
        return ResponseEntity.ok(Map.of("dryRun", false, "action", action, "selected", selection.ids().size(), "affected", affected));
    }

    @DeleteMapping("/{id}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> deleteShoe(@PathVariable Long id,
                                        @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        Optional<Shoe> shoeOptional = adminService.getShoeRepository().findById(id);
        if (shoeOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.NOT_FOUND, "Shoe not found.", "shoe_not_found");

        Shoe shoe = shoeOptional.get();
        adminService.getActivityRepository().unlinkShoeFromActivities(id);
        adminService.getShoeRepository().delete(shoe);
        adminService.getAdminAuditService().log(adminOptional.get(), "shoe.deleted", "shoe", String.valueOf(id),
                "Admin permanently deleted shoe",
                Map.of(
                        "runnerId", shoe.getRunner() == null ? null : shoe.getRunner().getId(),
                        "runnerEmail", shoe.getRunner() == null ? null : shoe.getRunner().getEmail(),
                        "brand", shoe.getBrand(),
                        "model", shoe.getModel()
                ));
        return ResponseEntity.ok(Map.of("deleted", true, "id", id));
    }
}
