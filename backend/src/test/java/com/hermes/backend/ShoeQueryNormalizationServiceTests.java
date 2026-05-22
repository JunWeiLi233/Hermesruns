package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ShoeQueryNormalizationServiceTests {

        @SuppressWarnings({"unchecked", "rawtypes"})
        private static Class<HttpEntity<Map<String, Object>>> httpEntityMapClass() {
                return (Class) HttpEntity.class;
        }

    @Test
    void normalizeReturnsCanonicalMetadataFromGemini() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);

        ShoeQueryNormalizationService service = new ShoeQueryNormalizationService(
                restTemplate,
                new com.fasterxml.jackson.databind.ObjectMapper(),
                systemConfigService
        );
        setField(service, "aiApiKey", "test-key");
        setField(service, "aiModel", "gemini-2.5-flash");

        when(restTemplate.exchange(any(String.class), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of(
                        "candidates", List.of(Map.of(
                                "content", Map.of(
                                        "parts", List.of(Map.of(
                                                "text", """
                                                        {
                                                          "brand": "Li-Ning",
                                                          "model": "Feidian 3.0 Elite",
                                                          "colorway": "White/Red",
                                                          "searchString": "Li-Ning Feidian 3.0 Elite White Red"
                                                        }
                                                        """
                                        ))
                                )
                        ))
                )));

        ShoeMetadataDto metadata = service.normalize("李宁 飞电 3.0 elite 白红");

        assertEquals("Li-Ning", metadata.brand());
        assertEquals("Feidian 3.0 Elite", metadata.model());
        assertEquals("White/Red", metadata.colorway());
        assertEquals("Li-Ning Feidian 3.0 Elite White Red", metadata.searchString());

        ArgumentCaptor<HttpEntity<Map<String, Object>>> entityCaptor = ArgumentCaptor.forClass(httpEntityMapClass());
        verify(restTemplate).exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                entityCaptor.capture(),
                eq(Map.class)
        );
        Map<String, Object> request = entityCaptor.getValue().getBody();
        assertInstanceOf(Map.class, request.get("generationConfig"));
        assertTrue(String.valueOf(request).contains("Translate any Chinese brand/model names"));
        assertTrue(String.valueOf(request).contains("李宁 飞电 3.0 elite 白红"));
    }

    @Test
    void normalizeAcceptsWrappedJsonResponse() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);

        ShoeQueryNormalizationService service = new ShoeQueryNormalizationService(
                restTemplate,
                new com.fasterxml.jackson.databind.ObjectMapper(),
                systemConfigService
        );
        setField(service, "aiApiKey", "test-key");

        when(restTemplate.exchange(any(String.class), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of(
                        "candidates", List.of(Map.of(
                                "content", Map.of(
                                        "parts", List.of(Map.of(
                                                "text", """
                                                        ```json
                                                        {
                                                          "brand": "Nike",
                                                          "model": "Alphafly 3"
                                                        }
                                                        ```
                                                        """
                                        ))
                                )
                        ))
                )));

        ShoeMetadataDto metadata = service.normalize("Nike Alphafly 3");

        assertEquals("Nike", metadata.brand());
        assertEquals("Alphafly 3", metadata.model());
        assertEquals("Nike Alphafly 3", metadata.searchString());
    }

    @Test
    void normalizeRequiresAiConfiguration() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        when(systemConfigService.isAiConfigured()).thenReturn(false);

        ShoeQueryNormalizationService service = new ShoeQueryNormalizationService(
                restTemplate,
                new com.fasterxml.jackson.databind.ObjectMapper(),
                systemConfigService
        );

        IllegalStateException error = assertThrows(
                IllegalStateException.class,
                () -> service.normalize("Anta C202 GT")
        );

        assertEquals("AI normalization is not configured.", error.getMessage());
    }

    @Test
    void normalizeCanUseConfiguredLettaAgent() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        LettaAgentClient lettaAgentClient = mock(LettaAgentClient.class);
        when(lettaAgentClient.isConfigured()).thenReturn(true);
        when(lettaAgentClient.sendUserMessage(any(String.class))).thenReturn("""
                {
                  "brand": "Nike",
                  "model": "Pegasus 41",
                  "searchString": "Nike Pegasus 41"
                }
                """);

        ShoeQueryNormalizationService service = new ShoeQueryNormalizationService(
                restTemplate,
                new com.fasterxml.jackson.databind.ObjectMapper(),
                systemConfigService,
                lettaAgentClient
        );
        setField(service, "aiAgentProvider", "letta");

        ShoeMetadataDto metadata = service.normalize("Nike Peg 41");

        assertEquals("Nike", metadata.brand());
        assertEquals("Pegasus 41", metadata.model());
        assertEquals("Nike Pegasus 41", metadata.searchString());
        verify(lettaAgentClient).sendUserMessage(any(String.class));
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
