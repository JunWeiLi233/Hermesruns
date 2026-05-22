package com.hermes.backend;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Polygon;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ShoeImagePixelAnalyzerTests {

    private final ShoeImagePixelAnalyzer analyzer = new ShoeImagePixelAnalyzer();

    @Test
    void acceptsCenteredShoeLikeProductSilhouette() throws Exception {
        BufferedImage image = new BufferedImage(640, 360, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, image.getWidth(), image.getHeight());

        g.setColor(new Color(42, 46, 55));
        Polygon upper = new Polygon(
                new int[]{112, 206, 390, 526, 568, 438, 220, 126},
                new int[]{216, 150, 142, 178, 226, 252, 250, 236},
                8
        );
        g.fillPolygon(upper);
        g.setColor(new Color(237, 94, 70));
        g.fillRoundRect(104, 224, 470, 42, 24, 24);
        g.setColor(new Color(246, 246, 246));
        g.fillOval(278, 176, 40, 22);
        g.fillOval(332, 172, 38, 20);
        g.dispose();

        ShoeImagePixelAnalyzer.Analysis analysis = analyzer.analyze(toPngBytes(image));

        assertTrue(analysis.looksLikeShoe(), () -> "Expected shoe-like product silhouette to pass, got " + analysis);
        assertTrue(analysis.score() >= 0.62, () -> "Expected a confident score, got " + analysis);
    }

    @Test
    void rejectsTinyLogoLikeImage() throws Exception {
        BufferedImage image = new BufferedImage(640, 360, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, image.getWidth(), image.getHeight());
        g.setColor(Color.BLACK);
        g.fillOval(286, 126, 68, 68);
        g.dispose();

        ShoeImagePixelAnalyzer.Analysis analysis = analyzer.analyze(toPngBytes(image));

        assertFalse(analysis.looksLikeShoe(), () -> "Expected tiny logo-like image to fail, got " + analysis);
    }

    @Test
    void rejectsBusyScreenshotLikeImage() throws Exception {
        BufferedImage image = new BufferedImage(640, 360, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        for (int y = 0; y < image.getHeight(); y += 12) {
            for (int x = 0; x < image.getWidth(); x += 12) {
                int r = (x * 17 + y * 3) % 255;
                int green = (x * 7 + y * 19) % 255;
                int b = (x * 11 + y * 13) % 255;
                g.setColor(new Color(r, green, b));
                g.fillRect(x, y, 12, 12);
            }
        }
        g.dispose();

        ShoeImagePixelAnalyzer.Analysis analysis = analyzer.analyze(toPngBytes(image));

        assertFalse(analysis.looksLikeShoe(), () -> "Expected busy screenshot-like image to fail, got " + analysis);
    }

    private byte[] toPngBytes(BufferedImage image) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }
}
