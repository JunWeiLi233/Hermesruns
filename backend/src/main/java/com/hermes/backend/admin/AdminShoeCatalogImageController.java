package com.hermes.backend.admin;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.infrastructure.web.InputSanitizer;
import com.hermes.backend.infrastructure.web.RequestBodyValidator;
import com.hermes.backend.infrastructure.web.SafeUrlValidator;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.shoes.BingImageScraper;
import com.hermes.backend.shoes.ShoeImageAsset;
import com.hermes.backend.shoes.ShoeImageAssetRepository;
import com.hermes.backend.shoes.ShoeImageAssetService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/shoe-catalog/images")
public class AdminShoeCatalogImageController {
    private static final int MAX_PHOTO_REFERENCE_LENGTH = 2_000_000;
    private static final Set<String> IMAGE_FIELDS = Set.of("brand", "model", "imageUrl", "source");
    private static final Set<String> SEARCH_FIELDS = Set.of("brand", "model", "query");

    private final AuthService authService;
    private final BingImageScraper bingImageScraper;
    private final ShoeImageAssetRepository shoeImageAssetRepository;
    private final ShoeImageAssetService shoeImageAssetService;
    private final AdminAuditService adminAuditService;
    private final AdminPortalService adminPortalService;

    public AdminShoeCatalogImageController(
            AuthService authService,
            BingImageScraper bingImageScraper,
            ShoeImageAssetRepository shoeImageAssetRepository,
            ShoeImageAssetService shoeImageAssetService,
            AdminAuditService adminAuditService,
            AdminPortalService adminPortalService) {
        this.authService = authService;
        this.bingImageScraper = bingImageScraper;
        this.shoeImageAssetRepository = shoeImageAssetRepository;
        this.shoeImageAssetService = shoeImageAssetService;
        this.adminAuditService = adminAuditService;
        this.adminPortalService = adminPortalService;
    }

    @GetMapping
    public ResponseEntity<?> listImages(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> admin = requireAdmin(authHeader);
        if (admin.isEmpty()) return forbidden();

        List<Map<String, Object>> payload = shoeImageAssetRepository.findAll().stream()
                .map(this::toPayload)
                .toList();
        return ResponseEntity.ok(payload);
    }

    @PostMapping("/search")
    public ResponseEntity<?> searchImages(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> admin = requireAdmin(authHeader);
        if (admin.isEmpty()) return forbidden();

        try {
            RequestBodyValidator.rejectUnexpectedFields(body, SEARCH_FIELDS);
            String brand = requiredIdentityPart(body, "brand");
            String model = requiredIdentityPart(body, "model");
            String query = Optional.ofNullable(RequestBodyValidator.optionalSafeText(body, "query", 200)).orElse("");
            InputSanitizer.rejectControlAndHtmlChars(query, "query");
            List<String> images = query.isBlank()
                    ? bingImageScraper.searchShoeImageCandidates(brand, model)
                    : bingImageScraper.searchShoeImageCandidates(brand, model, query, 12);
            return ResponseEntity.ok(Map.of("images", bingImageScraper.sanitizeImageUrls(images)));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.ok(Map.of("images", List.of(), "error", "search_failed"));
        }
    }

    @PostMapping("/pending")
    public ResponseEntity<?> stageImage(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> admin = requireAdmin(authHeader);
        if (admin.isEmpty()) return forbidden();

        try {
            RequestBodyValidator.rejectUnexpectedFields(body, IMAGE_FIELDS);
            String brand = requiredIdentityPart(body, "brand");
            String model = requiredIdentityPart(body, "model");
            String imageUrl = RequestBodyValidator.requiredString(body, "imageUrl", MAX_PHOTO_REFERENCE_LENGTH);
            String source = RequestBodyValidator.optionalSafeText(body, "source", 240);
            String finalUrl = SafeUrlValidator.validateHttpUrlOrImageDataUrlOrNull(
                    imageUrl, MAX_PHOTO_REFERENCE_LENGTH, "imageUrl");
            ShoeImageAsset asset = shoeImageAssetService.upsertPendingForIdentity(
                    brand, model, finalUrl, source, admin.get().getEmail());
            adminAuditService.log(admin.get(), "shoe_catalog_image.pending_set", "shoe_identity",
                    asset.getIdentityKey(), "Staged verified shoe image", Map.of(
                            "brand", brand,
                            "model", model
                    ));
            adminPortalService.invalidateDashboardCacheAfterCommit();
            return ResponseEntity.ok(toPayload(asset));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/accept")
    public ResponseEntity<?> acceptImage(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> admin = requireAdmin(authHeader);
        if (admin.isEmpty()) return forbidden();

        try {
            RequestBodyValidator.rejectUnexpectedFields(body, Set.of("brand", "model"));
            String brand = requiredIdentityPart(body, "brand");
            String model = requiredIdentityPart(body, "model");
            ShoeImageAsset asset = shoeImageAssetService.acceptPendingForIdentity(brand, model, admin.get().getEmail());
            adminAuditService.log(admin.get(), "shoe_catalog_image.published", "shoe_identity",
                    asset.getIdentityKey(), "Published verified shoe image", Map.of(
                            "brand", brand,
                            "model", model
                    ));
            adminPortalService.invalidateDashboardCacheAfterCommit();
            return ResponseEntity.ok(toPayload(asset));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }
    }

    @DeleteMapping("/pending")
    public ResponseEntity<?> clearPendingImage(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> admin = requireAdmin(authHeader);
        if (admin.isEmpty()) return forbidden();

        try {
            RequestBodyValidator.rejectUnexpectedFields(body, Set.of("brand", "model"));
            String brand = requiredIdentityPart(body, "brand");
            String model = requiredIdentityPart(body, "model");
            ShoeImageAsset asset = shoeImageAssetService.clearPendingForIdentity(brand, model);
            adminAuditService.log(admin.get(), "shoe_catalog_image.pending_cleared", "shoe_identity",
                    asset.getIdentityKey(), "Cleared pending verified shoe image", Map.of(
                            "brand", brand,
                            "model", model
                    ));
            adminPortalService.invalidateDashboardCacheAfterCommit();
            return ResponseEntity.ok(toPayload(asset));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }
    }

    private Optional<Runner> requireAdmin(String authHeader) {
        return authService.findByAuthorizationHeader(authHeader)
                .filter(authService::isAdmin);
    }

    private ResponseEntity<?> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");
    }

    private String requiredIdentityPart(Map<String, Object> body, String field) {
        String value = RequestBodyValidator.requiredSafeText(body, field, 100);
        InputSanitizer.rejectControlAndHtmlChars(value, field);
        return value;
    }

    private Map<String, Object> toPayload(ShoeImageAsset asset) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("identityKey", asset.getIdentityKey());
        payload.put("brand", asset.getBrand());
        payload.put("model", asset.getModel());
        payload.put("pendingImageUrl", asset.getPendingImageUrl());
        payload.put("pendingSource", asset.getPendingSource());
        payload.put("liveImageUrl", asset.getLiveImageUrl());
        payload.put("liveSource", asset.getLiveSource());
        payload.put("updatedAt", asset.getUpdatedAt() == null ? null : asset.getUpdatedAt().toString());
        return payload;
    }
}
