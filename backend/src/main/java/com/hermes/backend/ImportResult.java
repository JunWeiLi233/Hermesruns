package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

public record ImportResult(
        String provider,
        int importedActivities,
        int importedPoints,
        int skippedDuplicates,
        int skippedNonRuns,
        String message,
        List<String> rejectedFiles
) {
    public static ImportResult empty(String provider, String message) {
        return new ImportResult(provider, 0, 0, 0, 0, message, List.of());
    }

    public ImportResult merge(ImportResult other) {
        if (other == null) {
            return this;
        }

        List<String> merged = new ArrayList<>();
        if (rejectedFiles != null) merged.addAll(rejectedFiles);
        if (other.rejectedFiles() != null) merged.addAll(other.rejectedFiles());

        return new ImportResult(
                provider != null ? provider : other.provider(),
                importedActivities + other.importedActivities(),
                importedPoints + other.importedPoints(),
                skippedDuplicates + other.skippedDuplicates(),
                skippedNonRuns + other.skippedNonRuns(),
                other.message() != null && !other.message().isBlank() ? other.message() : message,
                List.copyOf(merged)
        );
    }

    public ImportResult withRejection(String filename, String reason) {
        List<String> updated = new ArrayList<>();
        if (rejectedFiles != null) updated.addAll(rejectedFiles);
        updated.add(filename + ": " + reason);
        return new ImportResult(provider, importedActivities, importedPoints,
                skippedDuplicates, skippedNonRuns, message, List.copyOf(updated));
    }
}
