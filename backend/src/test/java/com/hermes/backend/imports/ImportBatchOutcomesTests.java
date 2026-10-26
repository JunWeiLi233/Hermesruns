package com.hermes.backend.imports;

import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ImportBatchOutcomesTests {
    private ActivityImportService imports;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        AuthService auth = mock(AuthService.class);
        imports = mock(ActivityImportService.class);
        when(auth.findByAuthorizationHeader("Bearer valid")).thenReturn(Optional.of(new Runner()));
        mvc = MockMvcBuilders.standaloneSetup(new ImportController(auth, imports)).build();
    }

    private MockMultipartFile file(String name) {
        return new MockMultipartFile("exports", name, "application/octet-stream", new byte[]{1});
    }

    private void outcome(MockMultipartFile file, int imported, int duplicates, int nonRuns) {
        when(imports.importFile(any(Runner.class), eq(ImportProvider.GARMIN), eq(file)))
                .thenReturn(new ImportResult("GARMIN", imported, 0, duplicates, nonRuns, "Processed", List.of()));
    }

    @Test
    void oneArchiveCanImportSeveralActivities() throws Exception {
        MockMultipartFile archive = file("runs.zip");
        outcome(archive, 4, 0, 0);
        mvc.perform(multipart("/api/import/batch").file(archive).header("Authorization", "Bearer valid"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.importedActivities").value(4))
                .andExpect(jsonPath("$.skippedDuplicates").value(0))
                .andExpect(jsonPath("$.rejectedFiles").isEmpty());
    }

    @Test
    void duplicateOnlyResponseHasZeroImports() throws Exception {
        MockMultipartFile archive = file("duplicates.zip");
        outcome(archive, 0, 3, 0);
        mvc.perform(multipart("/api/import/batch").file(archive).header("Authorization", "Bearer valid"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.importedActivities").value(0))
                .andExpect(jsonPath("$.skippedDuplicates").value(3));
    }

    @Test
    void mixedSuccessKeepsActivityCountsAndRejectionDetails() throws Exception {
        MockMultipartFile archive = file("runs.zip");
        MockMultipartFile broken = file("bad.fit");
        outcome(archive, 2, 1, 1);
        when(imports.importFile(any(Runner.class), eq(ImportProvider.GARMIN), eq(broken)))
                .thenThrow(new IllegalArgumentException("Parse error"));
        mvc.perform(multipart("/api/import/batch").file(archive).file(broken).header("Authorization", "Bearer valid"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.importedActivities").value(2))
                .andExpect(jsonPath("$.skippedDuplicates").value(1))
                .andExpect(jsonPath("$.skippedNonRuns").value(1))
                .andExpect(jsonPath("$.rejectedFiles[0]").value("bad.fit: Parse error"));
    }

    @Test
    void failedBatchRetainsEveryRejectionAlongsideTheCompatibleErrorField() throws Exception {
        MockMultipartFile first = file("first.fit");
        MockMultipartFile second = file("second.gpx");
        when(imports.importFile(any(Runner.class), eq(ImportProvider.GARMIN), eq(first)))
                .thenThrow(new IllegalArgumentException("Parse error"));
        when(imports.importFile(any(Runner.class), eq(ImportProvider.GARMIN), eq(second)))
                .thenThrow(new IllegalArgumentException("Invalid GPX"));
        mvc.perform(multipart("/api/import/batch").file(first).file(second).header("Authorization", "Bearer valid"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("first.fit: Parse error"))
                .andExpect(jsonPath("$.importedActivities").value(0))
                .andExpect(jsonPath("$.skippedDuplicates").value(0))
                .andExpect(jsonPath("$.skippedNonRuns").value(0))
                .andExpect(jsonPath("$.rejectedFiles[0]").value("first.fit: Parse error"))
                .andExpect(jsonPath("$.rejectedFiles[1]").value("second.gpx: Invalid GPX"));
    }

    @Test
    void rejectedAndDuplicateFilesStillReportDuplicatesOnHttp400() throws Exception {
        MockMultipartFile archive = file("duplicates.zip");
        outcome(archive, 0, 3, 0);
        mvc.perform(multipart("/api/import/batch").file(archive).file(file("unsupported.txt"))
                        .header("Authorization", "Bearer valid"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.skippedDuplicates").value(3))
                .andExpect(jsonPath("$.rejectedFiles[0]").value("unsupported.txt: Unsupported upload file type."));
    }

    @Test
    void emptyFilesAreReportedInsteadOfSilentlyDiscarded() throws Exception {
        MockMultipartFile archive = file("runs.zip");
        outcome(archive, 2, 0, 0);
        MockMultipartFile empty = new MockMultipartFile("exports", "empty.gpx", "application/octet-stream", new byte[0]);
        mvc.perform(multipart("/api/import/batch").file(archive).file(empty).header("Authorization", "Bearer valid"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.importedActivities").value(2))
                .andExpect(jsonPath("$.rejectedFiles[0]").value("empty.gpx: Empty upload file."));
        verify(imports, never()).importFile(any(), any(), eq(empty));
    }
}
