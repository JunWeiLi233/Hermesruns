package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/shoe-catalog")
public class ShoeCatalogController {
    private static final Set<String> ALLOWED_TYPES = Set.of("daily", "speed", "race", "trail", "stability");

    private final AuthService authService;
    private final ShoeCatalogBrandRepository brandRepository;
    private final ShoeCatalogModelRepository modelRepository;

    public ShoeCatalogController(
            AuthService authService,
            ShoeCatalogBrandRepository brandRepository,
            ShoeCatalogModelRepository modelRepository) {
        this.authService = authService;
        this.brandRepository = brandRepository;
        this.modelRepository = modelRepository;
    }

    @GetMapping
    public ResponseEntity<?> listCatalog() {
        List<ShoeCatalogBrand> brands = brandRepository.findAllByOrderByNameAsc();
        List<Map<String, Object>> out = new ArrayList<>();
        for (ShoeCatalogBrand b : brands) {
            List<ShoeCatalogModel> models = modelRepository.findByBrandIdOrderByNameAsc(b.getId());
            List<Map<String, String>> modelRows = new ArrayList<>();
            for (ShoeCatalogModel m : models) {
                modelRows.add(Map.of(
                        "model", m.getName(),
                        "type", m.getType()
                ));
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", b.getId());
            row.put("brand", b.getName());
            row.put("logo", "👟");
            row.put("models", modelRows);
            out.add(row);
        }
        return ResponseEntity.ok(Map.of("brands", out));
    }

    @PostMapping("/admin/brands")
    public ResponseEntity<?> createBrand(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");
        }

        String brand = body.get("brand") instanceof String s ? s.trim() : "";
        if (brand.isBlank() || brand.length() > 100) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid brand name"));
        }
        try {
            InputSanitizer.rejectControlAndHtmlChars(brand, "brand");
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }

        Optional<ShoeCatalogBrand> existing = brandRepository.findByNameIgnoreCase(brand);
        if (existing.isPresent()) {
            return ResponseEntity.ok(Map.of("id", existing.get().getId(), "brand", existing.get().getName(), "created", false));
        }

        ShoeCatalogBrand b = new ShoeCatalogBrand();
        b.setName(brand);
        ShoeCatalogBrand saved = brandRepository.save(b);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", saved.getId(), "brand", saved.getName(), "created", true));
    }

    @PostMapping("/admin/models")
    @Transactional
    public ResponseEntity<?> createModel(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");
        }

        String brandName = body.get("brand") instanceof String s ? s.trim() : "";
        String modelName = body.get("model") instanceof String s ? s.trim() : "";
        String type = body.get("type") instanceof String s ? s.trim().toLowerCase() : "daily";

        if (brandName.isBlank() || brandName.length() > 100) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid brand name"));
        }
        if (modelName.isBlank() || modelName.length() > 100) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid model name"));
        }
        try {
            InputSanitizer.rejectControlAndHtmlChars(brandName, "brand");
            InputSanitizer.rejectControlAndHtmlChars(modelName, "model");
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }
        if (!ALLOWED_TYPES.contains(type)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid model type"));
        }

        ShoeCatalogBrand brand = brandRepository.findByNameIgnoreCase(brandName).orElseGet(() -> {
            ShoeCatalogBrand created = new ShoeCatalogBrand();
            created.setName(brandName);
            return brandRepository.save(created);
        });

        Optional<ShoeCatalogModel> existing = modelRepository.findByBrandAndNameIgnoreCase(brand, modelName);
        if (existing.isPresent()) {
            ShoeCatalogModel found = existing.get();
            if (!type.equals(found.getType())) {
                found.setType(type);
                modelRepository.save(found);
            }
            return ResponseEntity.ok(Map.of(
                    "brand", brand.getName(),
                    "model", found.getName(),
                    "type", found.getType(),
                    "created", false
            ));
        }

        ShoeCatalogModel model = new ShoeCatalogModel();
        model.setBrand(brand);
        model.setName(modelName);
        model.setType(type);
        ShoeCatalogModel saved = modelRepository.save(model);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "brand", brand.getName(),
                "model", saved.getName(),
                "type", saved.getType(),
                "created", true
        ));
    }
}

