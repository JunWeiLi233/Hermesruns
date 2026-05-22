package com.hermes.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Clock;
import java.time.Duration;
import java.util.*;

@RestController
@RequestMapping("/api/shoe-catalog")
public class ShoeCatalogController {
    private static final Set<String> ALLOWED_TYPES = Set.of("daily", "speed", "race", "trail", "stability");
    private static final Set<String> BRAND_FIELDS = Set.of("brand");
    private static final Set<String> MODEL_FIELDS = Set.of("brand", "model", "modelZh", "modelEn", "type");
    private static final Set<String> IMPORT_FIELDS = Set.of("url", "brand", "modelZh", "modelEn", "type");
    private static final Duration CATALOG_CACHE_TTL = Duration.ofMinutes(30);
    private static final String CATALOG_CACHE_NAMESPACE = "shoe-catalog";
    private static final String CATALOG_CACHE_KEY = "all";

    private final AuthService authService;
    private final ShoeCatalogBrandRepository brandRepository;
    private final ShoeCatalogModelRepository modelRepository;
    private final OfficialShoeCatalogImportService officialShoeCatalogImportService;
    private final AdminAuditService adminAuditService;
    private final TtlCacheStore cacheStore;

    @Autowired
    public ShoeCatalogController(
            AuthService authService,
            ShoeCatalogBrandRepository brandRepository,
            ShoeCatalogModelRepository modelRepository,
            OfficialShoeCatalogImportService officialShoeCatalogImportService,
            AdminAuditService adminAuditService,
            TtlCacheStore cacheStore) {
        this.authService = authService;
        this.brandRepository = brandRepository;
        this.modelRepository = modelRepository;
        this.officialShoeCatalogImportService = officialShoeCatalogImportService;
        this.adminAuditService = adminAuditService;
        this.cacheStore = cacheStore;
    }

    public ShoeCatalogController(
            AuthService authService,
            ShoeCatalogBrandRepository brandRepository,
            ShoeCatalogModelRepository modelRepository,
            OfficialShoeCatalogImportService officialShoeCatalogImportService,
            AdminAuditService adminAuditService) {
        this(authService, brandRepository, modelRepository, officialShoeCatalogImportService, adminAuditService,
                TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()));
    }

    @GetMapping
    public ResponseEntity<?> listCatalog() {
        Optional<Map<String, Object>> cached = cacheStore.get(
                CATALOG_CACHE_NAMESPACE,
                CATALOG_CACHE_KEY,
                new TypeReference<>() {}
        );
        if (cached.isPresent()) {
            return ResponseEntity.ok(cached.get());
        }

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
        Map<String, Object> response = Map.of("brands", out);
        cacheStore.put(CATALOG_CACHE_NAMESPACE, CATALOG_CACHE_KEY, response, CATALOG_CACHE_TTL);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/admin/brands")
    public ResponseEntity<?> createBrand(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");
        }
        Runner admin = user.get();

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
            invalidateCatalogCache();
            adminAuditService.log(admin, "catalog.brand.created", "catalog_brand", String.valueOf(saved.getId()),
                    "Created shoe catalog brand", Map.of("brand", saved.getName()));
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
        Runner admin = user.get();

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

        CatalogUpsertResult result = upsertModel(brandName, modelName, modelZh, modelEn, type);
        invalidateCatalogCache();
        adminAuditService.log(admin,
                result.created() ? "catalog.model.created" : "catalog.model.updated_via_create",
                "catalog_model",
                String.valueOf(result.id()),
                result.created() ? "Created shoe catalog model" : "Updated existing shoe catalog model via create endpoint",
                Map.of(
                        "brand", result.brand(),
                        "model", result.model(),
                        "type", result.type()
                ));
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.payload());
    }

    @DeleteMapping("/admin/brands/{id}")
    @Transactional
    public ResponseEntity<?> deleteBrand(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");
        }
        Runner admin = user.get();

        Optional<ShoeCatalogBrand> brandOptional = brandRepository.findById(id);
        if (brandOptional.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Catalog brand not found"));
        }

        ShoeCatalogBrand brand = brandOptional.get();
        long removedModels = modelRepository.countByBrandId(id);
        modelRepository.deleteByBrandId(id);
        brandRepository.delete(brand);
        invalidateCatalogCache();
        adminAuditService.log(admin, "catalog.brand.deleted", "catalog_brand", String.valueOf(id),
                "Deleted shoe catalog brand", Map.of("brand", brand.getName(), "removedModels", removedModels));
        return ResponseEntity.ok(Map.of(
                "deleted", true,
                "brandId", id,
                "brand", brand.getName(),
                "removedModels", removedModels
        ));
    }

    @PostMapping("/admin/import-page")
    @Transactional
    public ResponseEntity<?> importOfficialPage(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");
        }
        Runner admin = user.get();

        final String url;
        final String brandName;
        final String modelZh;
        final String modelEn;
        final String type;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, IMPORT_FIELDS);
            url = RequestBodyValidator.requiredString(body, "url", 500);
            brandName = RequestBodyValidator.optionalSafeText(body, "brand", 100);
            modelZh = RequestBodyValidator.optionalSafeText(body, "modelZh", 100);
            modelEn = RequestBodyValidator.optionalSafeText(body, "modelEn", 100);
            type = Optional.ofNullable(RequestBodyValidator.optionalSafeText(body, "type", 32)).orElse("daily").toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }

        if (!ALLOWED_TYPES.contains(type)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid model type"));
        }

        try {
            OfficialShoeCatalogImportService.ImportResult imported = officialShoeCatalogImportService.importPage(url, brandName, modelZh, modelEn);
            CatalogUpsertResult result = upsertModel(imported.brand(), imported.model(), imported.modelZh(), imported.modelEn(), type);
            invalidateCatalogCache();
            adminAuditService.log(admin,
                    result.created() ? "catalog.import.created" : "catalog.import.updated",
                    "catalog_model",
                    String.valueOf(result.id()),
                    result.created() ? "Imported shoe catalog model from official page" : "Updated shoe catalog model from official page import",
                    Map.of(
                            "brand", result.brand(),
                            "model", result.model(),
                            "type", result.type(),
                            "url", url,
                            "officialName", imported.officialName()
                    ));
            Map<String, Object> response = new LinkedHashMap<>(result.payload());
            response.put("url", url);
            response.put("officialName", imported.officialName());
            return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }
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
        Runner admin = user.get();

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
        invalidateCatalogCache();
        adminAuditService.log(admin, "catalog.model.updated", "catalog_model", String.valueOf(saved.getId()),
                "Updated shoe catalog model", Map.of(
                        "brand", saved.getBrand().getName(),
                        "model", saved.getName(),
                        "type", saved.getType()
                ));
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

    @DeleteMapping("/admin/models/{id}")
    @Transactional
    public ResponseEntity<?> deleteModel(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");
        }
        Runner admin = user.get();

        Optional<ShoeCatalogModel> modelOptional = modelRepository.findById(id);
        if (modelOptional.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Catalog model not found"));
        }

        ShoeCatalogModel model = modelOptional.get();
        String brandName = model.getBrand().getName();
        String modelName = model.getName();
        modelRepository.delete(model);
        invalidateCatalogCache();
        adminAuditService.log(admin, "catalog.model.deleted", "catalog_model", String.valueOf(id),
                "Deleted shoe catalog model", Map.of("brand", brandName, "model", modelName));
        return ResponseEntity.ok(Map.of(
                "deleted", true,
                "id", id,
                "brand", brandName,
                "model", modelName
        ));
    }

    private CatalogUpsertResult upsertModel(String brandName, String modelName, String modelZh, String modelEn, String type) {
        ShoeCatalogBrand brand = brandRepository.findByNameIgnoreCase(brandName).orElseGet(() -> {
            ShoeCatalogBrand created = new ShoeCatalogBrand();
            created.setName(brandName);
            return brandRepository.save(created);
        });

        Optional<ShoeCatalogModel> existing = modelRepository.findByBrandAndNameIgnoreCase(brand, modelName);
        if (existing.isPresent()) {
            ShoeCatalogModel found = existing.get();
            found.setNameZh(modelZh);
            found.setNameEn(modelEn);
            found.setType(type);
            ShoeCatalogModel saved = modelRepository.save(found);
            return newCatalogResult(false, saved);
        }

        ShoeCatalogModel model = new ShoeCatalogModel();
        model.setBrand(brand);
        model.setName(modelName);
        model.setNameZh(modelZh);
        model.setNameEn(modelEn);
        model.setType(type);
        ShoeCatalogModel saved = modelRepository.save(model);
        return newCatalogResult(true, saved);
    }

    private Map<String, Object> toModelPayload(ShoeCatalogModel model, boolean created) {
        return Map.of(
                "id", model.getId(),
                "brand", model.getBrand().getName(),
                "model", model.getName(),
                "modelZh", model.getNameZh() == null ? "" : model.getNameZh(),
                "modelEn", model.getNameEn() == null ? "" : model.getNameEn(),
                "type", model.getType(),
                "created", created
        );
    }

    private void invalidateCatalogCache() {
        cacheStore.evict(CATALOG_CACHE_NAMESPACE, CATALOG_CACHE_KEY);
        cacheStore.evict("shoe-catalog-types", "all");
    }

    private record CatalogUpsertResult(boolean created, Long id, String brand, String model, String type, Map<String, Object> payload) {}

    private CatalogUpsertResult newCatalogResult(boolean created, ShoeCatalogModel model) {
        return new CatalogUpsertResult(
                created,
                model.getId(),
                model.getBrand().getName(),
                model.getName(),
                model.getType(),
                toModelPayload(model, created)
        );
    }
}
