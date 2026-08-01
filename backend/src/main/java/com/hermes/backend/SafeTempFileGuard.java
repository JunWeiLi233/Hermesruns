package com.hermes.backend;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Constrains filesystem operations on paths that originate from user input.
 *
 * <p>CodeQL's {@code java/path-injection} query tracks the image reference
 * string the route-extraction / anchor-pixel services receive from callers all
 * the way to {@link Path#of(String)}. When the service first materialises a
 * real file it does so via {@link Files#createTempFile} inside the system temp
 * directory, so the actual on-disk target is safe — but the data-flow still
 * reads as tainted because the original string came from outside. This guard
 * makes the containment explicit and rejects anything outside the temp dir.
 */
public final class SafeTempFileGuard {
    private SafeTempFileGuard() {}

    private static final Path TEMP_DIR = Path.of(System.getProperty("java.io.tmpdir")).toAbsolutePath().normalize();

    /**
     * @return the resolved, normalized {@link Path} for {@code pathString},
     *         only if it stays inside the system temp directory; otherwise
     *         {@code null}. Used to bound the temp-file delete path so a
     *         crafted {@code imageReference} can never escape the temp dir.
     */
    public static Path tempFileOrNull(String pathString) {
        if (pathString == null || pathString.isBlank()) {
            return null;
        }
        Path resolved;
        try {
            resolved = Path.of(pathString).toAbsolutePath().normalize();
        } catch (Exception ignored) {
            return null;
        }
        return resolved.startsWith(TEMP_DIR) ? resolved : null;
    }
}
