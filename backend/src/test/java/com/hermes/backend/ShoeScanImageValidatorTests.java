package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ShoeScanImageValidatorTests {

    private static final String EICAR =
            "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

    private static byte[] bytes(String hexOrText) {
        return hexOrText.getBytes(StandardCharsets.ISO_8859_1);
    }

    private static byte[] concat(byte[]... parts) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            for (byte[] part : parts) {
                out.write(part);
            }
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] minimalPng() {
        return concat(
                bytes("\u0089PNG\r\n\u001A\n"),
                bytes("\u0000\u0000\u0000\u0000IEND\u00AEB`\u0082")
        );
    }

    private static byte[] minimalJpeg() {
        return concat(bytes("\u00FF\u00D8\u00FF\u00E0"), bytes("JFIF\u0000\u0001"), bytes("\u00FF\u00D9"));
    }

    @Test
    void acceptsWellFormedPng() {
        assertTrue(ShoeScanImageValidator.hasImageMagicBytes(minimalPng()));
    }

    @Test
    void acceptsWellFormedJpeg() {
        assertTrue(ShoeScanImageValidator.hasImageMagicBytes(minimalJpeg()));
    }

    @Test
    void acceptsWellFormedGif() {
        byte[] gif = concat(bytes("GIF89a"), bytes("\u00FF\u00FF\u00FF\u00FF\u00FF\u00FF"), bytes("\u003B"));
        assertTrue(ShoeScanImageValidator.hasImageMagicBytes(gif));
    }

    @Test
    void acceptsWellFormedWebp() {
        byte[] webp = concat(bytes("RIFF"), bytes("\u0024\u0000\u0000\u0000"), bytes("WEBPVP8L"));
        assertTrue(ShoeScanImageValidator.hasImageMagicBytes(webp));
    }

    @Test
    void rejectsJpegHeaderWithAppendedPayload() {
        byte[] polyglot = concat(minimalJpeg(), EICAR.getBytes(StandardCharsets.US_ASCII));
        assertFalse(ShoeScanImageValidator.hasImageMagicBytes(polyglot));
    }

    @Test
    void rejectsPngWithTrailingBytesAfterIend() {
        byte[] trailing = concat(minimalPng(), bytes("junk"));
        assertFalse(ShoeScanImageValidator.hasImageMagicBytes(trailing));
    }

    @Test
    void rejectsPngSignatureWithoutIendTrailer() {
        byte[] truncated = concat(bytes("\u0089PNG\r\n\u001A\n"), bytes("IDAT"));
        assertFalse(ShoeScanImageValidator.hasImageMagicBytes(truncated));
    }

    @Test
    void rejectsGifMissingTrailer() {
        byte[] gif = concat(bytes("GIF89a"), bytes("\u00FF\u00FF\u00FF"));
        assertFalse(ShoeScanImageValidator.hasImageMagicBytes(gif));
    }

    @Test
    void rejectsRiffContainerThatIsNotWebp() {
        byte[] wave = concat(bytes("RIFF"), bytes("\u0024\u0000\u0000\u0000"), bytes("WAVEfmt "));
        assertFalse(ShoeScanImageValidator.hasImageMagicBytes(wave));
    }

    @Test
    void rejectsWebpWithoutValidChunk() {
        byte[] webp = concat(bytes("RIFF"), bytes("\u0024\u0000\u0000\u0000"), bytes("WEBPJUNK"));
        assertFalse(ShoeScanImageValidator.hasImageMagicBytes(webp));
    }

    @Test
    void rejectsEicarAndExecutableHeaders() {
        assertFalse(ShoeScanImageValidator.hasImageMagicBytes(EICAR.getBytes(StandardCharsets.US_ASCII)));
        assertFalse(ShoeScanImageValidator.hasImageMagicBytes(bytes("MZ\u0090\u0000")));
    }

    @Test
    void rejectsShortOrNullInput() {
        assertFalse(ShoeScanImageValidator.hasImageMagicBytes(null));
        assertFalse(ShoeScanImageValidator.hasImageMagicBytes(new byte[0]));
        assertFalse(ShoeScanImageValidator.hasImageMagicBytes(bytes("\u00FF\u00D8\u00FF")));
    }
}
