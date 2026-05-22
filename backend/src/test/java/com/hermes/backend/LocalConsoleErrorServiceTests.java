package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class LocalConsoleErrorServiceTests {

    @Test
    void recordMergesDuplicateFingerprintsAndWritesLedgerFiles() throws Exception {
        Path workspaceRoot = Files.createTempDirectory("hermes-console-errors-");
        Files.writeString(workspaceRoot.resolve("TASKS.md"), "# Hermes Tasks\n");
        LocalConsoleErrorService service = new LocalConsoleErrorService(new ObjectMapper(), workspaceRoot);

        LocalConsoleErrorReport first = new LocalConsoleErrorReport(
                "console.error",
                "error",
                "Failed to fetch dynamically imported module",
                "TypeError: Failed to fetch dynamically imported module",
                "/heatmap",
                "http://localhost:8080/heatmap",
                "http://localhost:8080/assets/Heatmap.js",
                null,
                "Mozilla/5.0",
                "session-1",
                1
        );
        LocalConsoleErrorReport second = new LocalConsoleErrorReport(
                "console.error",
                "error",
                "Failed to fetch dynamically imported module",
                "TypeError: Failed to fetch dynamically imported module",
                "/heatmap",
                "http://localhost:8080/heatmap",
                "http://localhost:8080/assets/Heatmap.js",
                null,
                "Mozilla/5.0",
                "session-1",
                2
        );

        LocalConsoleErrorService.RecordResult firstResult = service.record(first);
        LocalConsoleErrorService.RecordResult secondResult = service.record(second);

        assertThat(firstResult.fingerprint()).isEqualTo(secondResult.fingerprint());
        assertThat(secondResult.count()).isEqualTo(3);

        Path jsonPath = workspaceRoot.resolve(".ai-sync/LOCAL_CONSOLE_ERRORS.json");
        Path markdownPath = workspaceRoot.resolve(".ai-sync/LOCAL_CONSOLE_ERRORS.md");
        assertThat(Files.exists(jsonPath)).isTrue();
        assertThat(Files.exists(markdownPath)).isTrue();

        LocalConsoleErrorService.Ledger ledger = new ObjectMapper().readValue(jsonPath.toFile(), LocalConsoleErrorService.Ledger.class);
        assertThat(ledger.entries).hasSize(1);
        assertThat(ledger.entries.get(0).count).isEqualTo(3);
        assertThat(ledger.entries.get(0).route).isEqualTo("/heatmap");
        assertThat(Files.readString(markdownPath)).contains("Failed to fetch dynamically imported module");
        assertThat(Files.readString(markdownPath)).contains("/heatmap");
    }
}
