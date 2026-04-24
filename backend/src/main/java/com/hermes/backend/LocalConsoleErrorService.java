package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

@Service
public class LocalConsoleErrorService {
    private static final int MAX_ENTRIES = 250;

    private final ObjectMapper objectMapper;
    private final Path workspaceRoot;
    private final Path jsonPath;
    private final Path markdownPath;

    @Autowired
    public LocalConsoleErrorService(ObjectMapper objectMapper) {
        this(objectMapper, locateWorkspaceRoot());
    }

    LocalConsoleErrorService(ObjectMapper objectMapper, Path workspaceRoot) {
        this.objectMapper = objectMapper;
        this.workspaceRoot = workspaceRoot;
        this.jsonPath = workspaceRoot.resolve(".ai-sync").resolve("LOCAL_CONSOLE_ERRORS.json");
        this.markdownPath = workspaceRoot.resolve(".ai-sync").resolve("LOCAL_CONSOLE_ERRORS.md");
    }

    public synchronized RecordResult record(LocalConsoleErrorReport report) {
        Ledger ledger = readLedger();
        String fingerprint = fingerprintFor(report);
        LedgerEntry entry = ledger.entries.stream()
                .filter(candidate -> fingerprint.equals(candidate.fingerprint))
                .findFirst()
                .orElse(null);

        String now = Instant.now().toString();
        int increment = report.count() == null ? 1 : report.count();

        if (entry == null) {
            entry = new LedgerEntry();
            entry.fingerprint = fingerprint;
            entry.kind = fallback(report.kind(), "console.error");
            entry.severity = fallback(report.severity(), "error");
            entry.message = fallback(report.message(), "Unknown console error");
            entry.stack = report.stack();
            entry.route = report.route();
            entry.pageUrl = report.pageUrl();
            entry.sourceUrl = report.sourceUrl();
            entry.assetUrl = report.assetUrl();
            entry.userAgent = report.userAgent();
            entry.sessionId = report.sessionId();
            entry.firstSeen = now;
            entry.lastSeen = now;
            entry.count = increment;
            ledger.entries.add(entry);
        } else {
            entry.kind = fallback(report.kind(), entry.kind);
            entry.severity = fallback(report.severity(), entry.severity);
            entry.message = fallback(report.message(), entry.message);
            if (report.stack() != null) entry.stack = report.stack();
            if (report.route() != null) entry.route = report.route();
            if (report.pageUrl() != null) entry.pageUrl = report.pageUrl();
            if (report.sourceUrl() != null) entry.sourceUrl = report.sourceUrl();
            if (report.assetUrl() != null) entry.assetUrl = report.assetUrl();
            if (report.userAgent() != null) entry.userAgent = report.userAgent();
            if (report.sessionId() != null) entry.sessionId = report.sessionId();
            entry.lastSeen = now;
            entry.count += increment;
        }

        ledger.entries.sort(Comparator.comparing((LedgerEntry candidate) -> fallback(candidate.lastSeen, "")).reversed());
        if (ledger.entries.size() > MAX_ENTRIES) {
            ledger.entries = new ArrayList<>(ledger.entries.subList(0, MAX_ENTRIES));
        }
        ledger.lastUpdated = now;

        writeLedger(ledger);
        return new RecordResult(fingerprint, entry.count);
    }

    static String fingerprintFor(LocalConsoleErrorReport report) {
        String raw = String.join("||",
                fallback(report.kind(), "console.error"),
                fallback(report.severity(), "error"),
                fallback(report.route(), ""),
                fallback(report.message(), ""),
                firstStackLine(report.stack()),
                fallback(report.sourceUrl(), ""),
                fallback(report.assetUrl(), "")
        );
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-1");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Missing SHA-1 support.", exception);
        }
    }

    private Ledger readLedger() {
        if (!Files.exists(jsonPath)) {
            return new Ledger();
        }
        try {
            Ledger ledger = objectMapper.readValue(jsonPath.toFile(), Ledger.class);
            if (ledger.entries == null) {
                ledger.entries = new ArrayList<>();
            }
            return ledger;
        } catch (IOException ignored) {
            return new Ledger();
        }
    }

    private void writeLedger(Ledger ledger) {
        try {
            Files.createDirectories(jsonPath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(jsonPath.toFile(), ledger);
            Files.writeString(markdownPath, renderMarkdown(ledger), StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to persist local console error ledger.", exception);
        }
    }

    private String renderMarkdown(Ledger ledger) {
        StringBuilder builder = new StringBuilder();
        builder.append("# Local Console Errors\n\n");
        builder.append("Local-only Hermes console error ledger captured from `localhost:8080`.\n\n");
        builder.append("- Last Updated: ").append(fallback(ledger.lastUpdated, "unknown")).append('\n');
        builder.append("- Open Entries: ").append(ledger.entries.size()).append("\n\n");
        if (ledger.entries.isEmpty()) {
            builder.append("No recorded local console errors.\n");
            return builder.toString();
        }

        for (LedgerEntry entry : ledger.entries) {
            builder.append("## ").append(truncate(entry.message, 140)).append("\n\n");
            builder.append("- Severity: ").append(fallback(entry.severity, "error")).append('\n');
            builder.append("- Kind: ").append(fallback(entry.kind, "console.error")).append('\n');
            builder.append("- Count: ").append(entry.count).append('\n');
            builder.append("- Route: ").append(fallback(entry.route, "(unknown route)")).append('\n');
            if (entry.sourceUrl != null) builder.append("- Source: ").append(entry.sourceUrl).append('\n');
            if (entry.assetUrl != null) builder.append("- Asset: ").append(entry.assetUrl).append('\n');
            builder.append("- First Seen: ").append(fallback(entry.firstSeen, "unknown")).append('\n');
            builder.append("- Last Seen: ").append(fallback(entry.lastSeen, "unknown")).append('\n');
            if (entry.stack != null) {
                builder.append("- Stack: `").append(truncate(firstStackLine(entry.stack), 220)).append("`\n");
            }
            builder.append("- Fingerprint: `").append(entry.fingerprint).append("`\n\n");
        }
        return builder.toString();
    }

    static Path locateWorkspaceRoot() {
        Path current = Path.of("").toAbsolutePath().normalize();
        for (Path cursor = current; cursor != null; cursor = cursor.getParent()) {
            if (Files.exists(cursor.resolve("TASKS.md")) || Files.exists(cursor.resolve("AGENTS.md"))) {
                return cursor;
            }
        }
        if (current.getFileName() != null && "backend".equalsIgnoreCase(current.getFileName().toString()) && current.getParent() != null) {
            return current.getParent();
        }
        return current;
    }

    private static String firstStackLine(String stack) {
        if (stack == null || stack.isBlank()) return "";
        String[] lines = stack.split("\\R");
        return lines.length == 0 ? "" : lines[0].trim();
    }

    private static String fallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) return fallback(value, "");
        return value.substring(0, Math.max(0, maxLength - 3)) + "...";
    }

    public static final class Ledger {
        public String lastUpdated;
        public List<LedgerEntry> entries = new ArrayList<>();
    }

    public static final class LedgerEntry {
        public String fingerprint;
        public String kind;
        public String severity;
        public String message;
        public String stack;
        public String route;
        public String pageUrl;
        public String sourceUrl;
        public String assetUrl;
        public String userAgent;
        public String sessionId;
        public String firstSeen;
        public String lastSeen;
        public int count;
    }

    public record RecordResult(String fingerprint, int count) {}
}
