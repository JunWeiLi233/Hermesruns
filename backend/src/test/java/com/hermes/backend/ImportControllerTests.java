package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ImportControllerTests {

    @Test
    void batchImportReturns401JsonWhenSessionExpired() {
        AuthService authService = mock(AuthService.class);
        ActivityImportService importService = mock(ActivityImportService.class);

        ImportController controller = new ImportController(authService, importService);
        when(authService.findByAuthorizationHeader("Bearer expired")).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.importBatch("Bearer expired", null, null, null, null);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertInstanceOf(Map.class, response.getBody());
        @SuppressWarnings("unchecked")
        Map<String, String> body = (Map<String, String>) response.getBody();
        assertNotNull(body.get("error"));
    }

    @Test
    void batchImportReturnsPartialSuccessWithRejectedFiles() throws Exception {
        AuthService authService = mock(AuthService.class);
        ActivityImportService importService = mock(ActivityImportService.class);

        ImportController controller = new ImportController(authService, importService);

        Runner runner = new Runner();
        runner.setId(1L);
        when(authService.findByAuthorizationHeader("Bearer valid")).thenReturn(Optional.of(runner));

        // Valid file — imported successfully
        MockMultipartFile validFile = new MockMultipartFile(
                "exports", "valid.gpx", "application/octet-stream",
                new byte[]{0x3C, 0x67, 0x70, 0x78} // minimal content
        );
        when(importService.importFile(eq(runner), eq(ImportProvider.GARMIN), eq(validFile)))
                .thenReturn(new ImportResult("GARMIN", 1, 10, 0, 0, "ok", List.of()));

        // Invalid file — triggers IllegalArgumentException
        MockMultipartFile badFile = new MockMultipartFile(
                "exports", "bad.gpx", "application/octet-stream",
                new byte[]{0x00}
        );
        when(importService.importFile(eq(runner), eq(ImportProvider.GARMIN), eq(badFile)))
                .thenThrow(new IllegalArgumentException("Parse error"));

        ResponseEntity<?> response = controller.importBatch(
                "Bearer valid", List.of(validFile, badFile), null, null, null
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertInstanceOf(ImportResult.class, response.getBody());
        ImportResult result = (ImportResult) response.getBody();
        assertEquals(1, result.importedActivities());
        assertEquals(1, result.rejectedFiles().size());
        assertTrue(result.rejectedFiles().get(0).contains("bad.gpx"));
    }

    @Test
    void batchImportRejectsBatchExceedingFileCountCap() {
        AuthService authService = mock(AuthService.class);
        ActivityImportService importService = mock(ActivityImportService.class);

        ImportController controller = new ImportController(authService, importService);

        Runner runner = new Runner();
        runner.setId(1L);
        when(authService.findByAuthorizationHeader("Bearer valid")).thenReturn(Optional.of(runner));

        // 51 files — exceeds MAX_BATCH_FILES=50
        List<MockMultipartFile> files = new java.util.ArrayList<>();
        for (int i = 0; i < 51; i++) {
            files.add(new MockMultipartFile(
                    "exports", "run" + i + ".gpx", "application/octet-stream",
                    new byte[]{0x3C}
            ));
        }

        @SuppressWarnings("unchecked")
        List<org.springframework.web.multipart.MultipartFile> cast =
                (List<org.springframework.web.multipart.MultipartFile>) (List<?>) files;

        ResponseEntity<?> response = controller.importBatch("Bearer valid", cast, null, null, null);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertInstanceOf(Map.class, response.getBody());
        @SuppressWarnings("unchecked")
        Map<String, String> body = (Map<String, String>) response.getBody();
        assertNotNull(body.get("error"));
        assertTrue(body.get("error").contains("50"));
    }
}
