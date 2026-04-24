package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ShoeCatalogControllerTests {

    @Test
    void listCatalogReturnsStableBrandAndModelPayload() {
        ShoeCatalogBrandRepository brandRepository = mock(ShoeCatalogBrandRepository.class);
        ShoeCatalogModelRepository modelRepository = mock(ShoeCatalogModelRepository.class);
        ShoeCatalogBrand nike = brand(1L, "Nike");
        ShoeCatalogModel pegasus = model(11L, nike, "Pegasus 41", null, "Pegasus 41", "daily");
        when(brandRepository.findAllByOrderByNameAsc()).thenReturn(List.of(nike));
        when(modelRepository.findByBrandIdOrderByNameAsc(1L)).thenReturn(List.of(pegasus));
        ShoeCatalogController controller = new ShoeCatalogController(
                mock(AuthService.class),
                brandRepository,
                modelRepository,
                mock(OfficialShoeCatalogImportService.class),
                mock(AdminAuditService.class)
        );

        ResponseEntity<?> response = controller.listCatalog();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(Map.of(
                "brands",
                List.of(Map.of(
                        "id", 1L,
                        "brand", "Nike",
                        "logo", "👟",
                        "models", List.of(Map.of(
                                "id", 11L,
                                "model", "Pegasus 41",
                                "modelZh", "",
                                "modelEn", "Pegasus 41",
                                "type", "daily"
                        ))
                ))
        ));
    }

    @Test
    void createBrandRejectsMissingAdminAuthorization() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        ShoeCatalogController controller = createController(authService);

        ResponseEntity<?> response = controller.createBrand(null, Map.of("brand", "Nike"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).isEqualTo("Admin only");
    }

    @Test
    void createBrandRejectsUnexpectedFields() {
        AuthService authService = mock(AuthService.class);
        Runner admin = admin();
        when(authService.findByAuthorizationHeader("Bearer admin-token")).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        ShoeCatalogController controller = createController(authService);

        ResponseEntity<?> response = controller.createBrand(
                "Bearer admin-token",
                Map.of("brand", "Nike", "extra", "nope")
        );

        assertError(response, HttpStatus.BAD_REQUEST, "Unexpected fields: extra");
    }

    @Test
    void createModelCreatesCatalogEntryAndNormalizesType() {
        AuthService authService = mock(AuthService.class);
        ShoeCatalogBrandRepository brandRepository = mock(ShoeCatalogBrandRepository.class);
        ShoeCatalogModelRepository modelRepository = mock(ShoeCatalogModelRepository.class);
        AdminAuditService adminAuditService = mock(AdminAuditService.class);
        Runner admin = admin();
        when(authService.findByAuthorizationHeader("Bearer admin-token")).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        when(brandRepository.findByNameIgnoreCase("Nike")).thenReturn(Optional.empty());
        when(brandRepository.save(any(ShoeCatalogBrand.class))).thenAnswer(invocation -> {
            ShoeCatalogBrand saved = invocation.getArgument(0);
            saved.setId(4L);
            return saved;
        });
        when(modelRepository.findByBrandAndNameIgnoreCase(any(ShoeCatalogBrand.class), eq("Pegasus 41")))
                .thenReturn(Optional.empty());
        when(modelRepository.save(any(ShoeCatalogModel.class))).thenAnswer(invocation -> {
            ShoeCatalogModel saved = invocation.getArgument(0);
            saved.setId(9L);
            return saved;
        });
        ShoeCatalogController controller = new ShoeCatalogController(
                authService,
                brandRepository,
                modelRepository,
                mock(OfficialShoeCatalogImportService.class),
                adminAuditService
        );

        ResponseEntity<?> response = controller.createModel(
                "Bearer admin-token",
                Map.of(
                        "brand", "Nike",
                        "model", "Pegasus 41",
                        "modelZh", "飞马 41",
                        "modelEn", "Pegasus 41",
                        "type", "RACE"
                )
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isEqualTo(Map.of(
                "id", 9L,
                "brand", "Nike",
                "model", "Pegasus 41",
                "modelZh", "飞马 41",
                "modelEn", "Pegasus 41",
                "type", "race",
                "created", true
        ));
        verify(adminAuditService).log(
                eq(admin),
                eq("catalog.model.created"),
                eq("catalog_model"),
                eq("9"),
                eq("Created shoe catalog model"),
                org.mockito.ArgumentMatchers.<Map<String, Object>>any()
        );
    }

    @Test
    void importOfficialPageReturnsImportedPayloadWithUrlAndOfficialName() {
        AuthService authService = mock(AuthService.class);
        ShoeCatalogBrandRepository brandRepository = mock(ShoeCatalogBrandRepository.class);
        ShoeCatalogModelRepository modelRepository = mock(ShoeCatalogModelRepository.class);
        OfficialShoeCatalogImportService importService = mock(OfficialShoeCatalogImportService.class);
        Runner admin = admin();
        when(authService.findByAuthorizationHeader("Bearer admin-token")).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        when(importService.importPage("https://example.com/pegasus", "Nike", "飞马 41", "Pegasus 41"))
                .thenReturn(new OfficialShoeCatalogImportService.ImportResult(
                        "Nike Pegasus 41 Road Running Shoes",
                        "Nike",
                        "Pegasus 41",
                        "飞马 41",
                        "Pegasus 41"
                ));
        when(brandRepository.findByNameIgnoreCase("Nike")).thenReturn(Optional.of(brand(4L, "Nike")));
        when(modelRepository.findByBrandAndNameIgnoreCase(any(ShoeCatalogBrand.class), eq("Pegasus 41")))
                .thenReturn(Optional.empty());
        when(modelRepository.save(any(ShoeCatalogModel.class))).thenAnswer(invocation -> {
            ShoeCatalogModel saved = invocation.getArgument(0);
            saved.setId(12L);
            return saved;
        });
        ShoeCatalogController controller = new ShoeCatalogController(
                authService,
                brandRepository,
                modelRepository,
                importService,
                mock(AdminAuditService.class)
        );

        ResponseEntity<?> response = controller.importOfficialPage(
                "Bearer admin-token",
                Map.of(
                        "url", "https://example.com/pegasus",
                        "brand", "Nike",
                        "modelZh", "飞马 41",
                        "modelEn", "Pegasus 41",
                        "type", "daily"
                )
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isEqualTo(Map.of(
                "id", 12L,
                "brand", "Nike",
                "model", "Pegasus 41",
                "modelZh", "飞马 41",
                "modelEn", "Pegasus 41",
                "type", "daily",
                "created", true,
                "url", "https://example.com/pegasus",
                "officialName", "Nike Pegasus 41 Road Running Shoes"
        ));
    }

    @Test
    void importOfficialPageReturnsBadRequestWhenImporterRejectsUrl() {
        AuthService authService = mock(AuthService.class);
        OfficialShoeCatalogImportService importService = mock(OfficialShoeCatalogImportService.class);
        Runner admin = admin();
        when(authService.findByAuthorizationHeader("Bearer admin-token")).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        when(importService.importPage("javascript:alert(1)", "", "", ""))
                .thenThrow(new IllegalArgumentException("Only http/https product pages are supported."));
        ShoeCatalogController controller = new ShoeCatalogController(
                authService,
                mock(ShoeCatalogBrandRepository.class),
                mock(ShoeCatalogModelRepository.class),
                importService,
                mock(AdminAuditService.class)
        );

        ResponseEntity<?> response = controller.importOfficialPage(
                "Bearer admin-token",
                Map.of(
                        "url", "javascript:alert(1)",
                        "brand", "",
                        "modelZh", "",
                        "modelEn", ""
                )
        );

        assertError(response, HttpStatus.BAD_REQUEST, "Only http/https product pages are supported.");
    }

    @Test
    void updateModelRejectsDuplicateNameWithinBrand() {
        AuthService authService = mock(AuthService.class);
        ShoeCatalogModelRepository modelRepository = mock(ShoeCatalogModelRepository.class);
        Runner admin = admin();
        ShoeCatalogBrand brand = brand(3L, "ASICS");
        ShoeCatalogModel existing = model(18L, brand, "Superblast", "超级训练器", "Superblast", "daily");
        ShoeCatalogModel duplicate = model(19L, brand, "Metaspeed Sky", "Metaspeed Sky", "Metaspeed Sky", "race");
        when(authService.findByAuthorizationHeader("Bearer admin-token")).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        when(modelRepository.findById(18L)).thenReturn(Optional.of(existing));
        when(modelRepository.findByBrandAndNameIgnoreCase(brand, "Metaspeed Sky")).thenReturn(Optional.of(duplicate));
        ShoeCatalogController controller = new ShoeCatalogController(
                authService,
                mock(ShoeCatalogBrandRepository.class),
                modelRepository,
                mock(OfficialShoeCatalogImportService.class),
                mock(AdminAuditService.class)
        );

        ResponseEntity<?> response = controller.updateModel(
                18L,
                "Bearer admin-token",
                Map.of(
                        "model", "Metaspeed Sky",
                        "modelZh", "Metaspeed Sky",
                        "modelEn", "Metaspeed Sky",
                        "type", "race"
                )
        );

        assertError(response, HttpStatus.CONFLICT, "A model with that name already exists for this brand");
    }

    @Test
    void deleteBrandReturnsDeletedSummaryIncludingRemovedModelCount() {
        AuthService authService = mock(AuthService.class);
        ShoeCatalogBrandRepository brandRepository = mock(ShoeCatalogBrandRepository.class);
        ShoeCatalogModelRepository modelRepository = mock(ShoeCatalogModelRepository.class);
        Runner admin = admin();
        ShoeCatalogBrand brand = brand(6L, "Brooks");
        when(authService.findByAuthorizationHeader("Bearer admin-token")).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        when(brandRepository.findById(6L)).thenReturn(Optional.of(brand));
        when(modelRepository.countByBrandId(6L)).thenReturn(3L);
        ShoeCatalogController controller = new ShoeCatalogController(
                authService,
                brandRepository,
                modelRepository,
                mock(OfficialShoeCatalogImportService.class),
                mock(AdminAuditService.class)
        );

        ResponseEntity<?> response = controller.deleteBrand(6L, "Bearer admin-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(Map.of(
                "deleted", true,
                "brandId", 6L,
                "brand", "Brooks",
                "removedModels", 3L
        ));
        verify(modelRepository).deleteByBrandId(6L);
        verify(brandRepository).delete(brand);
    }

    @Test
    void updateModelReturnsNotFoundWhenModelDoesNotExist() {
        AuthService authService = mock(AuthService.class);
        ShoeCatalogModelRepository modelRepository = mock(ShoeCatalogModelRepository.class);
        Runner admin = admin();
        when(authService.findByAuthorizationHeader("Bearer admin-token")).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        when(modelRepository.findById(88L)).thenReturn(Optional.empty());
        ShoeCatalogController controller = new ShoeCatalogController(
                authService,
                mock(ShoeCatalogBrandRepository.class),
                modelRepository,
                mock(OfficialShoeCatalogImportService.class),
                mock(AdminAuditService.class)
        );

        ResponseEntity<?> response = controller.updateModel(
                88L,
                "Bearer admin-token",
                Map.of("model", "Ghost 16", "type", "daily")
        );

        assertError(response, HttpStatus.NOT_FOUND, "Catalog model not found");
    }

    private ShoeCatalogController createController(AuthService authService) {
        return new ShoeCatalogController(
                authService,
                mock(ShoeCatalogBrandRepository.class),
                mock(ShoeCatalogModelRepository.class),
                mock(OfficialShoeCatalogImportService.class),
                mock(AdminAuditService.class)
        );
    }

    private Runner admin() {
        Runner runner = new Runner();
        runner.setId(5L);
        runner.setEmail("admin@hermes.test");
        runner.setRole("ADMIN");
        return runner;
    }

    private ShoeCatalogBrand brand(Long id, String name) {
        ShoeCatalogBrand brand = new ShoeCatalogBrand();
        brand.setId(id);
        brand.setName(name);
        return brand;
    }

    private ShoeCatalogModel model(Long id, ShoeCatalogBrand brand, String name, String nameZh, String nameEn, String type) {
        ShoeCatalogModel model = new ShoeCatalogModel();
        model.setId(id);
        model.setBrand(brand);
        model.setName(name);
        model.setNameZh(nameZh);
        model.setNameEn(nameEn);
        model.setType(type);
        return model;
    }

    @SuppressWarnings("unchecked")
    private void assertError(ResponseEntity<?> response, HttpStatus status, String message) {
        assertThat(response.getStatusCode()).isEqualTo(status);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        assertThat((Map<String, String>) response.getBody()).containsEntry("error", message);
    }
}
