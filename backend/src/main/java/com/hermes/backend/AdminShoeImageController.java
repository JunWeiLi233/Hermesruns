package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/shoes/admin")
public class AdminShoeImageController {
    private static final Logger logger = LoggerFactory.getLogger(AdminShoeImageController.class);
    private static final int MAX_PHOTO_REFERENCE_LENGTH = 2_000_000;
    private static final Set<String> QUERY_ONLY_FIELDS = Set.of("query");
    private static final Set<String> PHOTO_ONLY_FIELDS = Set.of("photoUrl");

    private final AuthService authService;
    private final ShoeRepository shoeRepository;
    private final BingImageScraper bingImageScraper;

    public AdminShoeImageController(
            AuthService authService,
            ShoeRepository shoeRepository,
            BingImageScraper bingImageScraper
    ) {
        this.authService = authService;
        this.shoeRepository = shoeRepository;
        this.bingImageScraper = bingImageScraper;
    }

    /** Admin: list all shoes across all users with runner email. */
    @GetMapping("/all")
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
    @PostMapping("/{id}/search-images")
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
     * Admin: set photo URL for a shoe by ID. Applies to all shoes
     * with the same brand+model across all users.
     */
    @PutMapping("/{id}/photo")
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
     * Admin: mark the current product image as verified for this shoe model.
     */
    @PutMapping("/{id}/verify-photo")
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
     * Admin: unmark current product image verification for this shoe model.
     */
    @PutMapping("/{id}/unverify-photo")
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
}
