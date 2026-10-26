package com.hermes.backend.shoes;

import com.hermes.backend.billing.AiBudgetExceededException;
import com.hermes.backend.billing.AiSpendingBudget;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AiShoeScanServiceTests {
    @ParameterizedTest
    @ValueSource(strings = {"gemini", "claude"})
    void exhaustedBudgetBlocksEveryProviderBeforeNetworkCall(String provider) {
        RestTemplate http = mock(RestTemplate.class);
        AiSpendingBudget budget = mock(AiSpendingBudget.class);
        AiShoeScanService service = new AiShoeScanService(http, budget);
        ReflectionTestUtils.setField(service, "aiProvider", provider);
        doThrow(new AiBudgetExceededException()).when(budget).reserve();
        assertThatThrownBy(() -> service.callAi("image", "image/jpeg")).isInstanceOf(AiBudgetExceededException.class);
        verifyNoInteractions(http);
    }

    @Test
    void uncertainProviderFailureStillConsumesOneSafetyReservation() {
        RestTemplate http = mock(RestTemplate.class);
        AiSpendingBudget budget = mock(AiSpendingBudget.class);
        AiShoeScanService service = new AiShoeScanService(http, budget);
        ReflectionTestUtils.setField(service, "aiApiKey", "test-key");
        when(http.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenThrow(new ResourceAccessException("provider response timed out"));
        assertThatThrownBy(() -> service.callAi("image", "image/jpeg")).isInstanceOf(ResourceAccessException.class);
        var order = inOrder(budget, http);
        order.verify(budget).reserve();
        order.verify(http).exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class));
        verifyNoMoreInteractions(budget);
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void geminiRequestCapsGeneratedTokens() {
        RestTemplate http = mock(RestTemplate.class);
        AiShoeScanService service = new AiShoeScanService(http, mock(AiSpendingBudget.class));
        ReflectionTestUtils.setField(service, "aiApiKey", "test-key");
        when(http.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of()));
        service.callAi("image", "image/jpeg");
        ArgumentCaptor<HttpEntity> body = ArgumentCaptor.forClass(HttpEntity.class);
        verify(http).exchange(anyString(), eq(HttpMethod.POST), body.capture(), eq(Map.class));
        assertThat((Map) ((Map) body.getValue().getBody()).get("generationConfig")).containsEntry("maxOutputTokens", 1024);
    }
}
