package com.hermes.backend;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.awt.image.ConvolveOp;
import java.awt.image.Kernel;
import java.awt.image.RescaleOp;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

final class QwenImagePreprocessor {
    // Max dimension for Qwen input — higher than the old 4M-pixel-equivalent limit
    // to preserve course map detail. At 2400^2 = 5.76M pixels, we keep more line/text sharpness
    // while staying within Qwen VL practical memory limits.
    static final int DEFAULT_QWEN_MAX_DIMENSION = 2400;

    // 3x3 mild unsharp mask kernel (sum = 1.0, edge pixels softened to reduce halos)
    private static final float[] MILD_SHARPEN_KERNEL = {
        0, -0.5f, 0,
        -0.5f, 3, -0.5f,
        0, -0.5f, 0
    };

    private QwenImagePreprocessor() {
    }

    static PreparedImage prepare(Path imagePath, int maxDimension, String tempPrefix) throws IOException {
        if (imagePath == null || maxDimension <= 0) {
            return PreparedImage.original(imagePath);
        }
        BufferedImage source = ImageIO.read(imagePath.toFile());
        if (source == null) {
            return PreparedImage.original(imagePath);
        }

        int originalWidth = source.getWidth();
        int originalHeight = source.getHeight();
        int longestSide = Math.max(originalWidth, originalHeight);
        if (longestSide <= maxDimension) {
            return new PreparedImage(imagePath, false, originalWidth, originalHeight, originalWidth, originalHeight);
        }

        double scale = (double) maxDimension / longestSide;
        int width = Math.max(1, (int) Math.round(originalWidth * scale));
        int height = Math.max(1, (int) Math.round(originalHeight * scale));
        BufferedImage resized = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = resized.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.drawImage(source, 0, 0, width, height, null);
        } finally {
            graphics.dispose();
        }

        Path preparedPath = Files.createTempFile(tempPrefix == null || tempPrefix.isBlank() ? "hermes-qwen-image-" : tempPrefix, ".jpg");
        ImageIO.write(resized, "jpg", preparedPath.toFile());
        return new PreparedImage(preparedPath, true, originalWidth, originalHeight, width, height);
    }

    // Full preprocessing pipeline for Qwen course-map analysis:
    // resize → contrast enhance → sharpen → output as lossless PNG
    static PreparedImage prepareForQwen(Path imagePath, String tempPrefix) throws IOException {
        return prepareForQwen(imagePath, DEFAULT_QWEN_MAX_DIMENSION, tempPrefix);
    }

    static PreparedImage prepareForQwen(Path imagePath, int maxDimension, String tempPrefix) throws IOException {
        if (imagePath == null || maxDimension <= 0) {
            return PreparedImage.original(imagePath);
        }
        BufferedImage source = ImageIO.read(imagePath.toFile());
        if (source == null) {
            return PreparedImage.original(imagePath);
        }

        int originalWidth = source.getWidth();
        int originalHeight = source.getHeight();

        // Step 1: Resize to maxDimension while preserving aspect ratio
        BufferedImage processed = resizeIfNeeded(source, maxDimension);

        // Step 2: Enhance contrast to make thin route lines more distinct
        processed = enhanceContrast(processed);

        // Step 3: Mild sharpen to crispen text labels and route edges
        processed = sharpen(processed);

        // Step 4: Write as PNG — preserves thin lines and text better than JPEG
        String prefix = tempPrefix == null || tempPrefix.isBlank() ? "hermes-qwen-prepped-" : tempPrefix;
        Path preparedPath = Files.createTempFile(prefix, ".png");
        ImageIO.write(processed, "png", preparedPath.toFile());

        return new PreparedImage(preparedPath, true, originalWidth, originalHeight, processed.getWidth(), processed.getHeight());
    }

    // Resize image so the longest side fits within maxDimension, preserving aspect ratio
    static BufferedImage resizeIfNeeded(BufferedImage source, int maxDimension) {
        int width = source.getWidth();
        int height = source.getHeight();
        int longestSide = Math.max(width, height);
        if (longestSide <= maxDimension) return source;

        double scale = (double) maxDimension / longestSide;
        int newWidth = Math.max(1, (int) Math.round(width * scale));
        int newHeight = Math.max(1, (int) Math.round(height * scale));
        int imageType = source.getType() == BufferedImage.TYPE_CUSTOM
                ? BufferedImage.TYPE_INT_RGB
                : source.getType();
        BufferedImage resized = new BufferedImage(newWidth, newHeight, imageType);
        Graphics2D g = resized.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(source, 0, 0, newWidth, newHeight, null);
        } finally {
            g.dispose();
        }
        return resized;
    }

    // Contrast enhancement via 2%-98% percentile stretch — makes thin route lines
    // and faded map text more readable without blowing out highlights.
    static BufferedImage enhanceContrast(BufferedImage source) {
        int width = source.getWidth();
        int height = source.getHeight();

        // Convert to RGB for safe RescaleOp processing
        BufferedImage rgb;
        if (source.getType() == BufferedImage.TYPE_INT_RGB) {
            rgb = source;
        } else {
            rgb = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = rgb.createGraphics();
            g.drawImage(source, 0, 0, null);
            g.dispose();
        }

        // Build luminance histogram
        int[] histogram = new int[256];
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int pixel = rgb.getRGB(x, y);
                int r = (pixel >> 16) & 0xFF;
                int g = (pixel >> 8) & 0xFF;
                int b = pixel & 0xFF;
                int lum = (int) (0.299 * r + 0.587 * g + 0.114 * b);
                histogram[lum]++;
            }
        }

        // Find 2nd and 98th percentile luminance values for clipped contrast stretch
        int pixelCount = width * height;
        int lowClip = Math.max(1, (int) (pixelCount * 0.02));
        int highClip = (int) (pixelCount * 0.98);
        int lowVal = 0;
        int highVal = 255;
        int cumulative = 0;
        for (int i = 0; i < 256; i++) {
            cumulative += histogram[i];
            if (lowVal == 0 && cumulative >= lowClip) {
                lowVal = i;
            }
            if (cumulative >= highClip) {
                highVal = i;
                break;
            }
        }

        if (highVal <= lowVal) return rgb; // uniform or near-uniform image

        float scale = 255.0f / (highVal - lowVal);
        float offset = -lowVal * scale;
        RescaleOp op = new RescaleOp(scale, offset, null);
        return op.filter(rgb, null);
    }

    // Apply mild sharpening to make route edges and text labels crisper
    static BufferedImage sharpen(BufferedImage source) {
        BufferedImage workImage = source;
        if (source.getType() == BufferedImage.TYPE_CUSTOM) {
            workImage = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = workImage.createGraphics();
            g.drawImage(source, 0, 0, null);
            g.dispose();
        }
        Kernel kernel = new Kernel(3, 3, MILD_SHARPEN_KERNEL);
        ConvolveOp op = new ConvolveOp(kernel, ConvolveOp.EDGE_NO_OP, null);
        return op.filter(workImage, null);
    }

    // Apply the Qwen preprocessing pipeline (resize → contrast → sharpen → PNG) to raw image bytes.
    // Returns the original bytes when decoding or re-encoding fails so the alignment call can still proceed.
    static byte[] preprocessBytes(byte[] imageBytes) {
        if (imageBytes == null || imageBytes.length == 0) {
            return imageBytes;
        }
        try {
            BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(imageBytes));
            if (decoded == null) {
                return imageBytes;
            }
            BufferedImage resized = resizeIfNeeded(decoded, DEFAULT_QWEN_MAX_DIMENSION);
            BufferedImage enhanced = enhanceContrast(resized);
            BufferedImage sharpened = sharpen(enhanced);
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            if (!ImageIO.write(sharpened, "png", output)) {
                return imageBytes;
            }
            byte[] encoded = output.toByteArray();
            return encoded.length > 0 ? encoded : imageBytes;
        } catch (Exception ignored) {
            return imageBytes;
        }
    }

    static void deleteQuietly(PreparedImage preparedImage) {
        if (preparedImage == null || !preparedImage.temporary() || preparedImage.path() == null) {
            return;
        }
        try {
            Files.deleteIfExists(preparedImage.path());
        } catch (IOException ignored) {
        }
    }

    record PreparedImage(Path path, boolean temporary, int originalWidth, int originalHeight, int width, int height) {
        static PreparedImage original(Path path) {
            return new PreparedImage(path, false, 0, 0, 0, 0);
        }
    }
}
