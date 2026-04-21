package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LocalConsoleErrorControllerTests {

    @Test
    void recordRejectsNonLocalRequests() {
        LocalConsoleErrorService service = mock(LocalConsoleErrorService.class);
        LocalConsoleErrorController controller = new LocalConsoleErrorController(service, new ObjectMapper());

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("10.0.0.8");
        when(request.getServerName()).thenReturn("example.com");
        when(request.getServerPort()).thenReturn(8080);
        when(request.getHeader("Host")).thenReturn("example.com:8080");

        ResponseEntity<?> response = controller.record(Map.of("errors", List.of(Map.of("message", "boom"))), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void recordPersistsBatchForLocalhostRequests() {
        LocalConsoleErrorService service = mock(LocalConsoleErrorService.class);
        when(service.record(any(LocalConsoleErrorReport.class)))
                .thenReturn(new LocalConsoleErrorService.RecordResult("abc123", 2));
        LocalConsoleErrorController controller = new LocalConsoleErrorController(service, new ObjectMapper());

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getServerName()).thenReturn("localhost");
        when(request.getServerPort()).thenReturn(8080);
        when(request.getHeader("Host")).thenReturn("localhost:8080");

        ResponseEntity<?> response = controller.record(Map.of(
                "errors", List.of(Map.of(
                        "kind", "console.error",
                        "severity", "error",
                        "message", "boom",
                        "route", "/shoes"
                ))
        ), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) response.getBody();
        assertThat(payload.get("recorded")).isEqualTo(true);
        assertThat(payload.get("count")).isEqualTo(1);
        verify(service).record(any(LocalConsoleErrorReport.class));
    }
}
