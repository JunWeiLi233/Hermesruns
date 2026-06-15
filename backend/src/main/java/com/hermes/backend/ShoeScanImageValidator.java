package com.hermes.backend;

import java.util.Map;

final class ShoeScanImageValidator {
    private static final Map<String, byte[]> IMAGE_MAGIC = Map.of(
            "PNG",       new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47},
            "JPEG",      new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF},
            "GIF",       new byte[]{0x47, 0x49, 0x46, 0x38},
            "WEBP_RIFF", new byte[]{0x52, 0x49, 0x46, 0x46}
    );

    private ShoeScanImageValidator() {
    }

    static boolean hasImageMagicBytes(byte[] data) {
        if (data == null || data.length < 8) return false;
        for (byte[] magic : IMAGE_MAGIC.values()) {
            boolean match = true;
            for (int i = 0; i < magic.length; i++) {
                if (data[i] != magic[i]) {
                    match = false;
                    break;
                }
            }
            if (match) return true;
        }
        return false;
    }
}
