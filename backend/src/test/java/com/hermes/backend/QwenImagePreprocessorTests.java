package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Path;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;

class QwenImagePreprocessorTests {
    @Test
    void prepareDownscalesLargeImagesForQwenWithoutMutatingOriginal(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("large-course-map.png");
        BufferedImage source = new BufferedImage(2000, 1000, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = source.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, source.getWidth(), source.getHeight());
        } finally {
            graphics.dispose();
        }
        ImageIO.write(source, "png", imagePath.toFile());

        QwenImagePreprocessor.PreparedImage prepared = QwenImagePreprocessor.prepare(imagePath, 1200, "hermes-qwen-test-");

        assertThat(prepared.temporary()).isTrue();
        assertThat(prepared.path()).isNotEqualTo(imagePath);
        assertThat(prepared.originalWidth()).isEqualTo(2000);
        assertThat(prepared.originalHeight()).isEqualTo(1000);
        assertThat(prepared.width()).isEqualTo(1200);
        assertThat(prepared.height()).isEqualTo(600);
        assertThat(ImageIO.read(imagePath.toFile()).getWidth()).isEqualTo(2000);

        QwenImagePreprocessor.deleteQuietly(prepared);
        assertThat(prepared.path()).doesNotExist();
    }

    @Test
    void preprocessBytesAppliesContrastAndSharpenAndReencodesAsPng() throws Exception {
        BufferedImage noisy = new BufferedImage(800, 600, BufferedImage.TYPE_INT_RGB);
        Random random = new Random(42);
        for (int y = 0; y < noisy.getHeight(); y++) {
            for (int x = 0; x < noisy.getWidth(); x++) {
                int luminance = 80 + random.nextInt(40); // narrow band → contrast stretch should expand it
                noisy.setRGB(x, y, (luminance << 16) | (luminance << 8) | luminance);
            }
        }
        ByteArrayOutputStream encoded = new ByteArrayOutputStream();
        ImageIO.write(noisy, "jpg", encoded);
        byte[] originalBytes = encoded.toByteArray();
        assertThat(originalBytes).isNotEmpty();

        byte[] prepared = QwenImagePreprocessor.preprocessBytes(originalBytes);

        assertThat(prepared).isNotEmpty();
        assertThat(prepared).isNotEqualTo(originalBytes);
        // PNG magic — preprocessing always re-encodes as PNG so downstream Qwen calls advertise image/png.
        assertThat(prepared[0]).isEqualTo((byte) 0x89);
        assertThat(prepared[1]).isEqualTo((byte) 0x50);
        assertThat(prepared[2]).isEqualTo((byte) 0x4E);
        assertThat(prepared[3]).isEqualTo((byte) 0x47);

        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(prepared));
        assertThat(decoded).isNotNull();
        assertThat(decoded.getWidth()).isEqualTo(noisy.getWidth());
        assertThat(decoded.getHeight()).isEqualTo(noisy.getHeight());
    }

    @Test
    void preprocessBytesReturnsOriginalBytesOnUndecodableInput() {
        byte[] junk = new byte[] {0x01, 0x02, 0x03, 0x04};
        byte[] prepared = QwenImagePreprocessor.preprocessBytes(junk);
        assertThat(prepared).isSameAs(junk);
    }

    @Test
    void preprocessBytesDownscalesImagesAboveTheQwenLimit() throws Exception {
        BufferedImage huge = new BufferedImage(3200, 1600, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = huge.createGraphics();
        try {
            graphics.setColor(Color.LIGHT_GRAY);
            graphics.fillRect(0, 0, huge.getWidth(), huge.getHeight());
        } finally {
            graphics.dispose();
        }
        ByteArrayOutputStream encoded = new ByteArrayOutputStream();
        ImageIO.write(huge, "png", encoded);

        byte[] prepared = QwenImagePreprocessor.preprocessBytes(encoded.toByteArray());

        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(prepared));
        assertThat(decoded).isNotNull();
        assertThat(Math.max(decoded.getWidth(), decoded.getHeight()))
                .isLessThanOrEqualTo(QwenImagePreprocessor.DEFAULT_QWEN_MAX_DIMENSION);
    }
}
