package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ShoeImageControllerTests {

    @Test
    void setShoePhotoAcceptsImageDataUrl() {
        AuthService authService = mock(AuthService.class);
        ShoeRepository shoeRepository = mock(ShoeRepository.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        QuotaService quotaService = mock(QuotaService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        ApiRateLimiter apiRateLimiter = mock(ApiRateLimiter.class);
        BingImageScraper bingImageScraper = mock(BingImageScraper.class);
        AiShoeScanService aiShoeScanService = mock(AiShoeScanService.class);

        ShoeImageController controller = new ShoeImageController(
                authService,
                shoeRepository,
                aiUsageService,
                quotaService,
                restTemplate,
                systemConfigService,
                apiRateLimiter,
                bingImageScraper,
                aiShoeScanService
        );

        Runner runner = new Runner();
        runner.setId(7L);
        runner.setEmail("runner@hermes.com");

        Shoe shoe = new Shoe();
        shoe.setId(55L);
        shoe.setRunner(runner);
        shoe.setBrand("Nike");
        shoe.setModel("Pegasus 41");

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(shoeRepository.findByIdAndRunner(55L, runner)).thenReturn(Optional.of(shoe));
        when(shoeRepository.save(any(Shoe.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2G7xQAAAAASUVORK5CYII=";
        ResponseEntity<?> response = controller.setShoePhoto(
                55L,
                "Bearer session-token",
                Map.of("photoUrl", dataUrl)
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = assertInstanceOf(Map.class, response.getBody());
        assertEquals(dataUrl, body.get("photoUrl"));
        assertEquals(dataUrl, shoe.getPhotoUrl());
        verify(shoeRepository).save(shoe);
    }

    @Test
    void setShoePhotoRejectsNonImageDataUrl() {
        AuthService authService = mock(AuthService.class);
        ShoeRepository shoeRepository = mock(ShoeRepository.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        QuotaService quotaService = mock(QuotaService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        ApiRateLimiter apiRateLimiter = mock(ApiRateLimiter.class);
        BingImageScraper bingImageScraper = mock(BingImageScraper.class);
        AiShoeScanService aiShoeScanService = mock(AiShoeScanService.class);

        ShoeImageController controller = new ShoeImageController(
                authService,
                shoeRepository,
                aiUsageService,
                quotaService,
                restTemplate,
                systemConfigService,
                apiRateLimiter,
                bingImageScraper,
                aiShoeScanService
        );

        Runner runner = new Runner();
        runner.setId(8L);
        runner.setEmail("runner@hermes.com");

        Shoe shoe = new Shoe();
        shoe.setId(77L);
        shoe.setRunner(runner);

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(shoeRepository.findByIdAndRunner(77L, runner)).thenReturn(Optional.of(shoe));

        ResponseEntity<?> response = controller.setShoePhoto(
                77L,
                "Bearer session-token",
                Map.of("photoUrl", "data:text/plain;base64,SGVsbG8=")
        );

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = assertInstanceOf(Map.class, response.getBody());
        String error = String.valueOf(body.get("error"));
        assertTrue(
                error.contains("must be a valid URL.")
                        || error.contains("must be an image.")
                        || error.contains("must be an image or PDF.")
                        || error.contains("scheme is not allowed."),
                error
        );
        verify(shoeRepository, never()).save(any(Shoe.class));
    }

    @Test
    void scanAvailableReportsPersistedShoeScanQuota() {
        AuthService authService = mock(AuthService.class);
        ShoeRepository shoeRepository = mock(ShoeRepository.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        QuotaService quotaService = mock(QuotaService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        ApiRateLimiter apiRateLimiter = mock(ApiRateLimiter.class);
        BingImageScraper bingImageScraper = mock(BingImageScraper.class);
        AiShoeScanService aiShoeScanService = mock(AiShoeScanService.class);

        ShoeImageController controller = new ShoeImageController(
                authService,
                shoeRepository,
                aiUsageService,
                quotaService,
                restTemplate,
                systemConfigService,
                apiRateLimiter,
                bingImageScraper,
                aiShoeScanService
        );

        Runner runner = new Runner();
        runner.setId(9L);
        runner.setEmail("quota@hermes.com");

        Map<String, Object> dailyStatus = new LinkedHashMap<>();
        dailyStatus.put("tier", "FREE");
        dailyStatus.put("admin", false);
        dailyStatus.put("unlimited", false);
        dailyStatus.put("quotaType", "free_tier_daily");
        dailyStatus.put("scansRemaining", 5);
        dailyStatus.put("dailyLimit", 5);
        dailyStatus.put("dailyUsed", 0);

        Map<String, Object> quotaStatus = new LinkedHashMap<>();
        quotaStatus.put("pro", false);
        quotaStatus.put("shoeScan", Map.of("used", 0, "limit", 3, "remaining", 3));

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(aiUsageService.getUsageStatus(runner)).thenReturn(dailyStatus);
        when(quotaService.getQuotaStatus(runner)).thenReturn(quotaStatus);

        ResponseEntity<?> response = controller.isScanAvailable("Bearer session-token");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = assertInstanceOf(Map.class, response.getBody());
        assertEquals(true, body.get("available"));
        assertEquals("user_free", body.get("quotaType"));
        assertEquals(3, body.get("scansRemaining"));
        assertEquals(3, body.get("monthlyLimit"));
        assertEquals(0, body.get("monthlyUsed"));
        assertEquals(3, body.get("userFreeTotal"));
    }

    @Test
    void scanImageQuotaExceededReturnsPersistedShoeScanQuotaWithoutCallingAi() {
        AuthService authService = mock(AuthService.class);
        ShoeRepository shoeRepository = mock(ShoeRepository.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        QuotaService quotaService = mock(QuotaService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        ApiRateLimiter apiRateLimiter = mock(ApiRateLimiter.class);
        BingImageScraper bingImageScraper = mock(BingImageScraper.class);
        AiShoeScanService aiShoeScanService = mock(AiShoeScanService.class);

        ShoeImageController controller = new ShoeImageController(
                authService,
                shoeRepository,
                aiUsageService,
                quotaService,
                restTemplate,
                systemConfigService,
                apiRateLimiter,
                bingImageScraper,
                aiShoeScanService
        );

        Runner runner = new Runner();
        runner.setId(10L);
        runner.setEmail("used-up@hermes.com");
        runner.setShoeScanCount(3);

        Map<String, Object> dailyStatus = new LinkedHashMap<>();
        dailyStatus.put("tier", "FREE");
        dailyStatus.put("admin", false);
        dailyStatus.put("unlimited", false);
        dailyStatus.put("quotaType", "free_tier_daily");
        dailyStatus.put("scansRemaining", 5);
        dailyStatus.put("dailyLimit", 5);
        dailyStatus.put("dailyUsed", 0);

        Map<String, Object> quotaStatus = new LinkedHashMap<>();
        quotaStatus.put("pro", false);
        quotaStatus.put("shoeScan", Map.of("used", 3, "limit", 3, "remaining", 0));

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(apiRateLimiter.allow(anyString(), anyInt(), anyLong())).thenReturn(true);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(quotaService.isPro(runner)).thenReturn(false);
        when(quotaService.canUseFeature(runner, "shoe-scan")).thenReturn(false);
        when(quotaService.quotaExceededError(runner, "shoe-scan"))
                .thenReturn(new LinkedHashMap<>(Map.of("error", "quota_exceeded", "feature", "shoe-scan", "limit", 3, "used", 3)));
        when(aiUsageService.getUsageStatus(runner)).thenReturn(dailyStatus);
        when(quotaService.getQuotaStatus(runner)).thenReturn(quotaStatus);

        ResponseEntity<?> response = controller.scanImage(
                "Bearer session-token",
                null,
                mock(jakarta.servlet.http.HttpServletRequest.class)
        );

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = assertInstanceOf(Map.class, response.getBody());
        assertEquals("quota_exceeded", body.get("error"));
        assertEquals("user_free", body.get("quotaType"));
        assertEquals(0, body.get("scansRemaining"));
        assertEquals(3, body.get("monthlyLimit"));
        assertEquals(3, body.get("monthlyUsed"));
        assertEquals(3, body.get("userFreeTotal"));
        verify(aiShoeScanService, never()).callAi(any(String.class), any(String.class));
    }
}
