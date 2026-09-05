package com.hermes.backend.shoes;

/**
 * Structural validation for shoe-scan image uploads.
 * <p>
 * Rejects polyglot files that carry a real image header but hide a non-image
 * payload after the image data: every accepted format must both start with its
 * full signature and end with its proper end-of-image structure. Uploads are
 * never stored on disk; these checks are defense in depth in case that ever
 * changes.
 * </p>
 */
final class ShoeScanImageValidator {
    private static final byte[] PNG_SIGNATURE = {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    };
    private static final byte[] PNG_IEND_CHUNK = {
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, (byte) 0xAE, 0x42, 0x60, (byte) 0x82
    };
    private static final byte[] JPEG_SOI = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF };
    private static final byte[] JPEG_EOI = { (byte) 0xFF, (byte) 0xD9 };
    private static final byte[] GIF_87A = { 0x47, 0x49, 0x46, 0x38, 0x37, 0x61 };
    private static final byte[] GIF_89A = { 0x47, 0x49, 0x46, 0x38, 0x39, 0x61 };
    private static final byte[] RIFF = { 0x52, 0x49, 0x46, 0x46 };
    private static final byte[] WEBP = { 0x57, 0x45, 0x42, 0x50 };
    private static final byte[][] WEBP_CHUNKS = {
            { 0x56, 0x50, 0x38, 0x20 }, // "VP8 "
            { 0x56, 0x50, 0x38, 0x4C }, // "VP8L"
            { 0x56, 0x50, 0x38, 0x58 }  // "VP8X"
    };

    private static final int MIN_BYTES = 12;

    private ShoeScanImageValidator() {
    }

    static boolean hasImageMagicBytes(byte[] data) {
        if (data == null || data.length < MIN_BYTES) {
            return false;
        }
        if (startsWith(data, PNG_SIGNATURE)) {
            return endsWith(data, PNG_IEND_CHUNK);
        }
        if (startsWith(data, JPEG_SOI)) {
            return endsWith(data, JPEG_EOI);
        }
        if (startsWith(data, GIF_87A) || startsWith(data, GIF_89A)) {
            return data[data.length - 1] == 0x3B;
        }
        if (startsWith(data, RIFF) && regionMatches(data, 8, WEBP)) {
            return hasValidWebpChunk(data);
        }
        return false;
    }

    private static boolean hasValidWebpChunk(byte[] data) {
        if (data.length < 16) {
            return false;
        }
        for (byte[] chunk : WEBP_CHUNKS) {
            if (regionMatches(data, 12, chunk)) {
                return true;
            }
        }
        return false;
    }

    private static boolean startsWith(byte[] data, byte[] prefix) {
        return regionMatches(data, 0, prefix);
    }

    private static boolean endsWith(byte[] data, byte[] suffix) {
        return regionMatches(data, data.length - suffix.length, suffix);
    }

    private static boolean regionMatches(byte[] data, int offset, byte[] expected) {
        if (offset < 0 || data.length - offset < expected.length) {
            return false;
        }
        for (int i = 0; i < expected.length; i++) {
            if (data[offset + i] != expected[i]) {
                return false;
            }
        }
        return true;
    }
}
