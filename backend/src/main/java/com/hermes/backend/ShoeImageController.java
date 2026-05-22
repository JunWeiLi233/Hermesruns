package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.*;

@RestController
@RequestMapping("/api/shoes")
public class ShoeImageController {
    private static final Logger logger = LoggerFactory.getLogger(ShoeImageController.class);
    private static final int MAX_PHOTO_REFERENCE_LENGTH = 2_000_000;
    private static final Set<String> QUERY_ONLY_FIELDS = Set.of("query");
    private static final Set<String> PHOTO_ONLY_FIELDS = Set.of("photoUrl");
    private static final Set<String> RENDER_SOURCE_FIELDS = Set.of("url");
    private static final long MAX_RENDER_SOURCE_BYTES = 8L * 1024L * 1024L;

    private final AuthService authService;
    private final AiUsageService aiUsageService;
    private final QuotaService quotaService;
    private final RestTemplate restTemplate;
    private final SystemConfigService systemConfigService;
    private final ApiRateLimiter apiRateLimiter;
    private final BingImageScraper bingImageScraper;
    private final AiShoeScanService aiShoeScanService;

    private final ShoeRepository shoeRepository;

    private static final long MAX_SCAN_IMAGE_BYTES = 6L * 1024L * 1024L; // 6MB

    public ShoeImageController(
            AuthService authService,
            ShoeRepository shoeRepository,
            AiUsageService aiUsageService,
            QuotaService quotaService,
            RestTemplate restTemplate,
            SystemConfigService systemConfigService,
            ApiRateLimiter apiRateLimiter,
            BingImageScraper bingImageScraper,
            AiShoeScanService aiShoeScanService) {
        this.authService = authService;
        this.shoeRepository = shoeRepository;
        this.aiUsageService = aiUsageService;
        this.quotaService = quotaService;
        this.restTemplate = restTemplate;
        this.systemConfigService = systemConfigService;
        this.apiRateLimiter = apiRateLimiter;
        this.bingImageScraper = bingImageScraper;
        this.aiShoeScanService = aiShoeScanService;
    }

    // ── Admin endpoints (all shoes, regardless of owner) ──

    /** Admin: list all shoes across all users with runner email. */
    @GetMapping("/admin/all")
    public ResponseEntity<?> adminListAllShoes(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");

        List<Shoe> shoes = shoeRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Shoe s : shoes) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("brand", s.getBrand());
            m.put("model", s.getModel());
            m.put("nickname", s.getNickname());
            m.put("photoUrl", s.getPhotoUrl());
            m.put("photoVerified", s.isPhotoVerified());
            m.put("retired", s.isRetired());
            m.put("runnerEmail", s.getRunner() != null ? s.getRunner().getEmail() : null);
            result.add(m);
        }
        return ResponseEntity.ok(result);
    }

    /** Admin: search images for any shoe by ID. */
    @PostMapping("/admin/{id}/search-images")
    public ResponseEntity<?> adminSearchImages(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) Map<String, Object> body) {
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, QUERY_ONLY_FIELDS);
            Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
            if (user.isEmpty() || !authService.isAdmin(user.get()))
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");

            Optional<Shoe> shoeOpt = shoeRepository.findById(id);
            if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

            Shoe shoe = shoeOpt.get();
            String brand = shoe.getBrand() != null ? shoe.getBrand() : "";
            String model = shoe.getModel() != null ? shoe.getModel() : "";
            String customQuery = extractQuery(body);

            List<String> images;
            if (!customQuery.isBlank()) {
                images = bingImageScraper.scrapeMultipleImages(customQuery, 12);
            } else {
                images = bingImageScraper.searchShoeImageCandidates(brand, model);
            }
            return ResponseEntity.ok(Map.of("images", bingImageScraper.sanitizeImageUrls(images)));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        } catch (Exception e) {
            logger.warn("Admin image search failed for shoe {}: {}", id, e.getMessage(), e);
            return ResponseEntity.ok(Map.of("images", List.of(), "error", "search_failed"));
        }
    }

    /**
     * Admin: set photo URL for a shoe by ID — applies to ALL shoes
     * with the same brand+model across all users.
     */
    @PutMapping("/admin/{id}/photo")
    @Transactional
    public ResponseEntity<?> adminSetPhoto(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");

        Optional<Shoe> shoeOpt = shoeRepository.findById(id);
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        final String photoUrlRaw;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, PHOTO_ONLY_FIELDS);
            photoUrlRaw = RequestBodyValidator.optionalString(body, "photoUrl", MAX_PHOTO_REFERENCE_LENGTH);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }
        String finalUrl;
        try {
            finalUrl = SafeUrlValidator.validateHttpUrlOrImageDataUrlOrNull(photoUrlRaw, MAX_PHOTO_REFERENCE_LENGTH, "photoUrl");
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }

        // Apply to ALL shoes with same brand+model
        String brand = shoe.getBrand();
        String model = shoe.getModel();
        int count = 0;
        if (brand != null && model != null) {
            List<Shoe> matching = shoeRepository.findByBrandIgnoreCaseAndModelIgnoreCase(brand, model);
            for (Shoe s : matching) {
                s.setPhotoUrl(finalUrl);
                s.setPhotoVerified(false);
            }
            shoeRepository.saveAll(matching);
            count = matching.size();
        } else {
            shoe.setPhotoUrl(finalUrl);
            shoe.setPhotoVerified(false);
            shoeRepository.save(shoe);
            count = 1;
        }

        return ResponseEntity.ok(Map.of(
                "photoUrl", finalUrl != null ? finalUrl : "",
                "updated", count
        ));
    }

    /**
     * Admin: mark the current product image as verified for this shoe model (all same brand+model rows).
     */
    @PutMapping("/admin/{id}/verify-photo")
    @Transactional
    public ResponseEntity<?> adminVerifyPhoto(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");

        Optional<Shoe> shoeOpt = shoeRepository.findById(id);
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        if (shoe.getPhotoUrl() == null || shoe.getPhotoUrl().isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "no_photo"));
        }

        String canonicalUrl = shoe.getPhotoUrl().trim();
        String brand = shoe.getBrand();
        String model = shoe.getModel();
        int count = 0;
        if (brand != null && model != null) {
            List<Shoe> matching = shoeRepository.findByBrandIgnoreCaseAndModelIgnoreCase(brand, model);
            List<Shoe> toSave = new ArrayList<>();
            for (Shoe s : matching) {
                String pu = s.getPhotoUrl();
                if (pu != null && pu.trim().equals(canonicalUrl)) {
                    s.setPhotoVerified(true);
                    toSave.add(s);
                    count++;
                }
            }
            if (!toSave.isEmpty()) {
                shoeRepository.saveAll(toSave);
            }
        } else {
            shoe.setPhotoVerified(true);
            shoeRepository.save(shoe);
            count = 1;
        }

        return ResponseEntity.ok(Map.of("photoVerified", true, "updated", count));
    }

    /**
     * Admin: unmark current product image verification for this shoe model
     * (all same brand+model rows that share the same image URL).
     */
    @PutMapping("/admin/{id}/unverify-photo")
    @Transactional
    public ResponseEntity<?> adminUnverifyPhoto(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");

        Optional<Shoe> shoeOpt = shoeRepository.findById(id);
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        if (shoe.getPhotoUrl() == null || shoe.getPhotoUrl().isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "no_photo"));
        }

        String canonicalUrl = shoe.getPhotoUrl().trim();
        String brand = shoe.getBrand();
        String model = shoe.getModel();
        int count = 0;
        if (brand != null && model != null) {
            List<Shoe> matching = shoeRepository.findByBrandIgnoreCaseAndModelIgnoreCase(brand, model);
            List<Shoe> toSave = new ArrayList<>();
            for (Shoe s : matching) {
                String pu = s.getPhotoUrl();
                if (pu != null && pu.trim().equals(canonicalUrl)) {
                    s.setPhotoVerified(false);
                    toSave.add(s);
                    count++;
                }
            }
            if (!toSave.isEmpty()) {
                shoeRepository.saveAll(toSave);
            }
        } else {
            shoe.setPhotoVerified(false);
            shoeRepository.save(shoe);
            count = 1;
        }

        return ResponseEntity.ok(Map.of("photoVerified", false, "updated", count));
    }

    // ── User endpoints ──

    /**
     * Find shoe product image via Bing Image Search scraping — zero AI tokens.
     * Algorithm: construct search query → fetch Bing HTML → extract murl (media URL)
     * from embedded JSON → filter for image file extensions → save first match.
     */
    @PostMapping("/{id}/find-image")
    public ResponseEntity<?> findShoeImage(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        Optional<Shoe> shoeOpt = shoeRepository.findByIdAndRunner(id, user.get());
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        String brand = shoe.getBrand() != null ? shoe.getBrand() : "";
        String model = shoe.getModel() != null ? shoe.getModel() : "";
        if (brand.isBlank() && model.isBlank()) {
            return ResponseEntity.ok(Map.of("photoUrl", ""));
        }

        try {
            String imageUrl = bingImageScraper.scrapeShoeImage(brand, model);
            if (imageUrl != null) {
                shoe.setPhotoUrl(imageUrl);
                shoeRepository.save(shoe);
                return ResponseEntity.ok(Map.of("photoUrl", imageUrl));
            }
            return ResponseEntity.ok(Map.of("photoUrl", ""));
        } catch (Exception e) {
            logger.warn("Image search failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(Map.of("photoUrl", ""));
        }
    }

    /**
     * Search for shoe images and return multiple candidates for admin to choose from.
     * Optionally accepts a custom query to refine the search.
     */
    @PostMapping("/{id}/search-images")
    public ResponseEntity<?> searchShoeImages(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) Map<String, Object> body) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        Optional<Shoe> shoeOpt = shoeRepository.findByIdAndRunner(id, user.get());
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        String brand = shoe.getBrand() != null ? shoe.getBrand() : "";
        String model = shoe.getModel() != null ? shoe.getModel() : "";
        String customQuery = extractQuery(body);

        try {
            List<String> images;
            if (!customQuery.isBlank()) {
                images = bingImageScraper.scrapeMultipleImages(customQuery, 12);
            } else {
                images = bingImageScraper.searchShoeImageCandidates(brand, model);
            }
            return ResponseEntity.ok(Map.of("images", bingImageScraper.sanitizeImageUrls(images)));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        } catch (Exception e) {
            logger.warn("Image search failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(Map.of("images", List.of(), "error", "search_failed"));
        }
    }

    /**
     * Set or clear a shoe's photo URL directly.
     */
    @PutMapping("/{id}/photo")
    public ResponseEntity<?> setShoePhoto(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        Optional<Shoe> shoeOpt = shoeRepository.findByIdAndRunner(id, user.get());
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        final String photoUrlRaw;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, PHOTO_ONLY_FIELDS);
            photoUrlRaw = RequestBodyValidator.optionalString(body, "photoUrl", MAX_PHOTO_REFERENCE_LENGTH);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }
        String finalUrl;
        try {
            finalUrl = SafeUrlValidator.validateHttpUrlOrImageDataUrlOrNull(photoUrlRaw, MAX_PHOTO_REFERENCE_LENGTH, "photoUrl");
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }
        shoe.setPhotoUrl(finalUrl);
        shoeRepository.save(shoe);
        return ResponseEntity.ok(Map.of("photoUrl", shoe.getPhotoUrl() != null ? shoe.getPhotoUrl() : ""));
    }

    @GetMapping("/render-source")
    public ResponseEntity<?> renderSource(
            @RequestParam("url") String url,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        return renderSourceInternal(url, authHeader);
    }

    @PostMapping("/render-source")
    public ResponseEntity<?> renderSourcePost(
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        final String url;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, RENDER_SOURCE_FIELDS);
            url = RequestBodyValidator.optionalString(body, "url", MAX_PHOTO_REFERENCE_LENGTH);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }
        return renderSourceInternal(url, authHeader);
    }

    private ResponseEntity<?> renderSourceInternal(
            String url,
            String authHeader) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        final String safeUrl;
        try {
            safeUrl = SafeUrlValidator.validateHttpUrlOrNull(url, MAX_PHOTO_REFERENCE_LENGTH, "url");
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }
        if (safeUrl == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "url is required."));
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setAccept(List.of(MediaType.ALL));
            headers.set("User-Agent", "Hermes/1.0");
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    safeUrl,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    byte[].class
            );

            MediaType contentType = response.getHeaders().getContentType();
            byte[] body = response.getBody();
            if (contentType == null || !contentType.toString().toLowerCase(Locale.ROOT).startsWith("image/")) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "Remote resource is not an image."));
            }
            if (body == null || body.length == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Remote image was empty."));
            }
            if (body.length > MAX_RENDER_SOURCE_BYTES) {
                return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of("error", "Remote image is too large."));
            }

            return ResponseEntity.ok()
                    .contentType(contentType)
                    .cacheControl(CacheControl.maxAge(Duration.ofHours(6)).cachePrivate())
                    .body(body);
        } catch (HttpStatusCodeException ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "Could not fetch remote image."));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "Could not prepare remote image."));
        }
    }

    private String extractQuery(Map<String, ?> body) {
        if (body == null) return "";
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, QUERY_ONLY_FIELDS);
            Object raw = body.get("query");
            String q = raw == null ? "" : String.valueOf(raw).trim();
            if (q.length() > 200) {
                q = q.substring(0, 200);
            }
            InputSanitizer.rejectControlAndHtmlChars(q, "query");
            return q;
        } catch (Exception ignored) {
            return "";
        }
    }

    @GetMapping("/scan-available")
    public ResponseEntity<?> isScanAvailable(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        // Use centralized config check so status logic is consistent.
        boolean available = systemConfigService.isAiConfigured();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("available", available);
        if (available) {
            result.putAll(buildShoeScanUsageStatus(user.get()));
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/ai-usage")
    public ResponseEntity<?> getAiUsage(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");
        return ResponseEntity.ok(buildShoeScanUsageStatus(user.get()));
    }

    @PostMapping("/scan-image")
    public ResponseEntity<?> scanImage(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam("image") MultipartFile image,
            jakarta.servlet.http.HttpServletRequest request) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        String ip = RequestIpResolver.clientIp(request);
        // Extra abuse protection (in addition to quota): limit AI calls per IP
        if (!apiRateLimiter.allow("ai-scan:" + ip, 30, 3600)) { // 30/hour per IP
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "Too many AI requests. Try again later."));
        }

        if (!systemConfigService.isAiConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "AI API key not configured. Set APP_AI_API_KEY environment variable."));
        }

        Runner runner = user.get();

        // Feature-gating quota check: Pro users skip all quota checks entirely.
        if (!quotaService.isPro(runner)) {
            // Step 1: Check feature quota (premium feature gating for free users)
            if (!quotaService.canUseFeature(runner, "shoe-scan")) {
                Map<String, Object> errorBody = new LinkedHashMap<>(quotaService.quotaExceededError(runner, "shoe-scan"));
                errorBody.putAll(buildShoeScanUsageStatus(runner));
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(errorBody);
            }

            // Step 2: Check and atomically reserve AI daily usage quota
            String aiQuotaError = aiUsageService.tryConsumeQuota(runner);
            if (aiQuotaError != null) {
                Map<String, Object> errorBody = new LinkedHashMap<>();
                errorBody.put("error", aiQuotaError);
                errorBody.putAll(buildShoeScanUsageStatus(runner));
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(errorBody);
            }

            // Consume the feature quota now that we know the scan will proceed
            quotaService.consumeFeature(runner, "shoe-scan");
        }

        try {
            if (image == null || image.isEmpty() || image.getSize() <= 0) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Image is required."));
            }
            if (image.getSize() > MAX_SCAN_IMAGE_BYTES) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Image too large."));
            }

            String mediaType = image.getContentType();
            if (mediaType == null || !mediaType.toLowerCase(Locale.ROOT).startsWith("image/")) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid image content type."));
            }

            byte[] imageBytes = image.getBytes();
            String base64 = Base64.getEncoder().encodeToString(imageBytes);

            String text = aiShoeScanService.callAi(base64, mediaType);

            if (text == null) {
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("shoes", List.of());
                result.putAll(buildShoeScanUsageStatus(runner));
                return ResponseEntity.ok(result);
            }

            // Extract JSON array from text (may have surrounding text)
            int start = text.indexOf('[');
            int end = text.lastIndexOf(']');
            if (start >= 0 && end > start) {
                String jsonArray = text.substring(start, end + 1);
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("raw", jsonArray);
                result.putAll(buildShoeScanUsageStatus(runner));
                return ResponseEntity.ok(result);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("shoes", List.of());
            result.putAll(buildShoeScanUsageStatus(runner));
            return ResponseEntity.ok(result);

        } catch (HttpStatusCodeException e) {
            logger.error("AI API error {}: {}", e.getStatusCode(), e.getResponseBodyAsString(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "AI service temporarily unavailable. Please try again later."));
        } catch (Exception e) {
            logger.error("Shoe image scan failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to analyze image. Please try again."));
        }
    }

    private Map<String, Object> buildShoeScanUsageStatus(Runner runner) {
        Map<String, Object> status = new LinkedHashMap<>(aiUsageService.getUsageStatus(runner));
        if (runner == null || Boolean.TRUE.equals(status.get("unlimited")) || Boolean.TRUE.equals(status.get("admin"))) {
            return status;
        }

        Map<String, Object> quotaStatus = quotaService.getQuotaStatus(runner);
        Object shoeScanRaw = quotaStatus.get("shoeScan");
        if (!(shoeScanRaw instanceof Map<?, ?> shoeScan)) {
            return status;
        }

        int featureUsed = intValue(shoeScan.get("used"), 0);
        int featureLimit = intValue(shoeScan.get("limit"), 0);
        int featureRemaining = intValue(shoeScan.get("remaining"), Math.max(0, featureLimit - featureUsed));
        int dailyRemaining = intValue(status.get("scansRemaining"), featureRemaining);

        status.put("quotaType", "user_free");
        status.put("scansRemaining", Math.max(0, Math.min(featureRemaining, dailyRemaining)));
        status.put("monthlyLimit", featureLimit);
        status.put("monthlyUsed", featureUsed);
        status.put("userFreeTotal", featureLimit);
        status.put("featureQuotaLimit", featureLimit);
        status.put("featureQuotaUsed", featureUsed);
        status.put("featureQuotaRemaining", featureRemaining);
        return status;
    }

    private int intValue(Object value, int fallback) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String stringValue) {
            try {
                return Integer.parseInt(stringValue.trim());
            } catch (Exception ignored) {
                return fallback;
            }
        }
        return fallback;
    }

}
