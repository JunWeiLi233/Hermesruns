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
    private static final Set<String> BRAND_FIELDS = Set.of("brand");
    private static final Set<String> MODEL_FIELDS = Set.of("brand", "model", "modelZh", "modelEn", "type");

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
            List<Map<String, Object>> modelRows = new ArrayList<>();
            for (ShoeCatalogModel m : models) {
                modelRows.add(Map.of(
                        "id", m.getId(),
                        "model", m.getName(),
                        "modelZh", m.getNameZh() == null ? "" : m.getNameZh(),
                        "modelEn", m.getNameEn() == null ? "" : m.getNameEn(),
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

        try {
            RequestBodyValidator.rejectUnexpectedFields(body, BRAND_FIELDS);
            String brand = RequestBodyValidator.requiredSafeText(body, "brand", 100);
            Optional<ShoeCatalogBrand> existing = brandRepository.findByNameIgnoreCase(brand);
            if (existing.isPresent()) {
                return ResponseEntity.ok(Map.of("id", existing.get().getId(), "brand", existing.get().getName(), "created", false));
            }

            ShoeCatalogBrand b = new ShoeCatalogBrand();
            b.setName(brand);
            ShoeCatalogBrand saved = brandRepository.save(b);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", saved.getId(), "brand", saved.getName(), "created", true));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }
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

        final String brandName;
        final String modelName;
        final String modelZh;
        final String modelEn;
        final String type;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, MODEL_FIELDS);
            brandName = RequestBodyValidator.requiredSafeText(body, "brand", 100);
            modelName = RequestBodyValidator.requiredSafeText(body, "model", 100);
            modelZh = RequestBodyValidator.optionalSafeText(body, "modelZh", 100);
            modelEn = RequestBodyValidator.optionalSafeText(body, "modelEn", 100);
            type = Optional.ofNullable(RequestBodyValidator.optionalSafeText(body, "type", 32)).orElse("daily").toLowerCase(Locale.ROOT);
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
            found.setNameZh(modelZh);
            found.setNameEn(modelEn);
            modelRepository.save(found);
            return ResponseEntity.ok(Map.of(
                    "id", found.getId(),
                    "brand", brand.getName(),
                    "model", found.getName(),
                    "modelZh", found.getNameZh() == null ? "" : found.getNameZh(),
                    "modelEn", found.getNameEn() == null ? "" : found.getNameEn(),
                    "type", found.getType(),
                    "created", false
            ));
        }

        ShoeCatalogModel model = new ShoeCatalogModel();
        model.setBrand(brand);
        model.setName(modelName);
        model.setNameZh(modelZh);
        model.setNameEn(modelEn);
        model.setType(type);
        ShoeCatalogModel saved = modelRepository.save(model);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id", saved.getId(),
                "brand", brand.getName(),
                "model", saved.getName(),
                "modelZh", saved.getNameZh() == null ? "" : saved.getNameZh(),
                "modelEn", saved.getNameEn() == null ? "" : saved.getNameEn(),
                "type", saved.getType(),
                "created", true
        ));
    }

    @PutMapping("/admin/models/{id}")
    @Transactional
    public ResponseEntity<?> updateModel(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");
        }

        Optional<ShoeCatalogModel> modelOptional = modelRepository.findById(id);
        if (modelOptional.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Catalog model not found"));
        }

        final String modelName;
        final String modelZh;
        final String modelEn;
        final String type;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, Set.of("model", "modelZh", "modelEn", "type"));
            modelName = RequestBodyValidator.requiredSafeText(body, "model", 100);
            modelZh = RequestBodyValidator.optionalSafeText(body, "modelZh", 100);
            modelEn = RequestBodyValidator.optionalSafeText(body, "modelEn", 100);
            type = Optional.ofNullable(RequestBodyValidator.optionalSafeText(body, "type", 32)).orElse("daily").toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }

        if (!ALLOWED_TYPES.contains(type)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid model type"));
        }

        ShoeCatalogModel existing = modelOptional.get();
        Optional<ShoeCatalogModel> duplicate = modelRepository.findByBrandAndNameIgnoreCase(existing.getBrand(), modelName)
                .filter(found -> !found.getId().equals(existing.getId()));
        if (duplicate.isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "A model with that name already exists for this brand"));
        }

        existing.setName(modelName);
        existing.setNameZh(modelZh);
        existing.setNameEn(modelEn);
        existing.setType(type);
        ShoeCatalogModel saved = modelRepository.save(existing);
        return ResponseEntity.ok(Map.of(
                "id", saved.getId(),
                "brand", saved.getBrand().getName(),
                "model", saved.getName(),
                "modelZh", saved.getNameZh() == null ? "" : saved.getNameZh(),
                "modelEn", saved.getNameEn() == null ? "" : saved.getNameEn(),
                "type", saved.getType(),
                "updated", true
        ));
    }
}
