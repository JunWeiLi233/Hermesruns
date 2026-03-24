package com.hermes.backend;

public record ImportResult(
        String provider,
        int importedActivities,
        int importedPoints,
        int skippedDuplicates,
        int skippedNonRuns,
        String message
) {
    public static ImportResult empty(String provider, String message) {
        return new ImportResult(provider, 0, 0, 0, 0, message);
    }

    public ImportResult merge(ImportResult other) {
        if (other == null) {
            return this;
        }

        return new ImportResult(
                provider != null ? provider : other.provider(),
                importedActivities + other.importedActivities(),
                importedPoints + other.importedPoints(),
                skippedDuplicates + other.skippedDuplicates(),
                skippedNonRuns + other.skippedNonRuns(),
                other.message() != null && !other.message().isBlank() ? other.message() : message
        );
    }
}
