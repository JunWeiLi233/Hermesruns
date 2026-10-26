package com.hermes.backend.shoes;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.admin.AdminAuditService;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ShoeCatalogPerformanceTests {
    @Test void coldCatalogBulkLoadsModelsAndImagesAndWarmCatalogAvoidsDatabaseReads() {
        var brands = mock(ShoeCatalogBrandRepository.class);
        var models = mock(ShoeCatalogModelRepository.class);
        var images = mock(ShoeImageAssetService.class);
        ShoeCatalogBrand a = brand(1, "Alpha"), b = brand(2, "Beta"), empty = brand(3, "Empty");
        var allModels = List.of(model(11, a, "Run"), model(12, b, "Trail"));
        when(brands.findAllByOrderByNameAsc()).thenReturn(List.of(a, b, empty));
        when(models.findAllByOrderByBrand_NameAscNameAsc()).thenReturn(allModels);
        when(images.findLiveImageUrlsForCatalog(allModels)).thenReturn(Map.of(11L, "https://example.test/live.webp"));
        var controller = new ShoeCatalogController(mock(AuthService.class), brands, models,
                mock(OfficialShoeCatalogImportService.class), mock(AdminAuditService.class),
                TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()), images);
        var cold = controller.listCatalog();
        var warm = controller.listCatalog();
        com.fasterxml.jackson.databind.JsonNode json = new ObjectMapper().valueToTree(cold.getBody());
        com.fasterxml.jackson.databind.JsonNode warmJson = new ObjectMapper().valueToTree(warm.getBody());
        assertThat(warmJson.toString()).isEqualTo(json.toString());
        assertThat(json.at("/brands/0/models/0/imageUrl").asText()).isEqualTo("https://example.test/live.webp");
        assertThat(json.at("/brands/1/models/0/model").asText()).isEqualTo("Trail");
        assertThat(json.at("/brands/1/models/0").has("imageUrl")).isFalse();
        assertThat(json.at("/brands/2/models").size()).isZero();
        verify(brands).findAllByOrderByNameAsc();
        verify(models).findAllByOrderByBrand_NameAscNameAsc();
        verify(images).findLiveImageUrlsForCatalog(allModels);
        verifyNoMoreInteractions(brands, models, images);
    }

    @Test void imageLookupsUseBoundedScalarBatchesAndOnlyPublishLiveNonBlankUrls() {
        var assets = mock(ShoeImageAssetRepository.class);
        var service = new ShoeImageAssetService(assets, mock(ShoeRepository.class));
        var models = new ArrayList<ShoeCatalogModel>();
        var brand = brand(1, "Brand");
        for (int i = 0; i < 501; i++) models.add(model(i + 1, brand, "Model " + i));
        var live = mock(ShoeImageAssetRepository.LiveImage.class);
        when(live.getIdentityKey()).thenReturn(new ShoeIdentityService().computeIdentityKey("Brand", "Model 0"));
        when(live.getLiveImageUrl()).thenReturn("https://example.test/live.webp");
        var blank = mock(ShoeImageAssetRepository.LiveImage.class);
        when(blank.getIdentityKey()).thenReturn(new ShoeIdentityService().computeIdentityKey("Brand", "Model 1"));
        when(blank.getLiveImageUrl()).thenReturn(" ");
        when(assets.findLiveImagesByIdentityKeys(anyList())).thenReturn(List.of(live, blank));
        assertThat(service.findLiveImageUrlsForCatalog(models)).containsExactlyEntriesOf(Map.of(1L, "https://example.test/live.webp"));
        verify(assets).findLiveImagesByIdentityKeys(argThat(keys -> keys.size() == 500));
        verify(assets).findLiveImagesByIdentityKeys(argThat(keys -> keys.size() == 1));
        verifyNoMoreInteractions(assets);
    }

    @Test void emptyCatalogDoesNotQueryImageAssets() {
        var assets = mock(ShoeImageAssetRepository.class);
        var service = new ShoeImageAssetService(assets, mock(ShoeRepository.class));
        assertThat(service.findLiveImageUrlsForCatalog(List.of())).isEmpty();
        verifyNoInteractions(assets);
    }

    private static ShoeCatalogBrand brand(long id, String name) {
        var brand = new ShoeCatalogBrand(); brand.setId(id); brand.setName(name); return brand;
    }
    private static ShoeCatalogModel model(long id, ShoeCatalogBrand brand, String name) {
        var model = new ShoeCatalogModel(); model.setId(id); model.setBrand(brand); model.setName(name); model.setType("daily"); return model;
    }
}
