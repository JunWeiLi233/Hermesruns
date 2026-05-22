package com.hermes.backend;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Locale;

public class ShoeImagePixelAnalyzer {
    private static final int MAX_SAMPLED_PIXELS = 60000;
    private static final double MIN_FOREGROUND_RATIO = 0.025;
    private static final double MAX_FOREGROUND_RATIO = 0.78;
    private static final double MIN_ASPECT_RATIO = 0.9;
    private static final double MAX_ASPECT_RATIO = 8.0;
    private static final double MIN_FILL_RATIO = 0.08;
    private static final double MAX_FILL_RATIO = 0.92;
    private static final double MAX_CENTER_OFFSET = 0.58;
    private static final double SCORE_THRESHOLD = 0.62;

    public Analysis analyze(byte[] imageBytes) {
        if (imageBytes == null || imageBytes.length == 0) {
            return reject("empty image");
        }

        BufferedImage image;
        try {
            image = ImageIO.read(new ByteArrayInputStream(imageBytes));
        } catch (IOException ex) {
            return reject("image decode failed");
        }

        if (image == null) {
            return reject("unsupported image format");
        }

        int width = image.getWidth();
        int height = image.getHeight();
        if (width < 80 || height < 80) {
            return reject("image too small");
        }

        int step = Math.max(1, (int) Math.ceil(Math.sqrt(width * (double) height / MAX_SAMPLED_PIXELS)));
        Background background = estimateBackground(image, step);
        Scan scan = scanForeground(image, background, step);
        if (scan.foregroundCount == 0) {
            return reject("no separable product silhouette");
        }

        double foregroundRatio = scan.foregroundCount / Math.max(1.0, scan.sampleCount);
        int boxWidth = scan.maxX - scan.minX + 1;
        int boxHeight = scan.maxY - scan.minY + 1;
        double aspectRatio = boxWidth / Math.max(1.0, boxHeight);
        double sampledBoxArea = Math.max(1.0, (boxWidth / (double) step) * (boxHeight / (double) step));
        double fillRatio = scan.foregroundCount / sampledBoxArea;
        double centerOffset = normalizedCenterOffset(width, height, scan.minX, scan.minY, scan.maxX, scan.maxY);
        double borderChaos = scan.borderForegroundCount / Math.max(1.0, scan.borderSampleCount);
        double edgeDensity = scan.edgeTransitions / Math.max(1.0, scan.sampleCount);

        String hardReject = hardRejectReason(foregroundRatio, aspectRatio, fillRatio, centerOffset, borderChaos);
        double score = score(foregroundRatio, aspectRatio, fillRatio, centerOffset, borderChaos, edgeDensity);
        boolean looksLikeShoe = hardReject == null && score >= SCORE_THRESHOLD;
        String reason = looksLikeShoe
                ? String.format(Locale.ROOT, "shoe-like product silhouette score %.2f", score)
                : hardReject != null ? hardReject : String.format(Locale.ROOT, "weak shoe silhouette score %.2f", score);

        return new Analysis(
                looksLikeShoe,
                round(score),
                reason,
                round(foregroundRatio),
                round(aspectRatio),
                round(fillRatio),
                round(centerOffset),
                round(borderChaos),
                round(edgeDensity));
    }

    private Background estimateBackground(BufferedImage image, int step) {
        long red = 0;
        long green = 0;
        long blue = 0;
        long samples = 0;
        int width = image.getWidth();
        int height = image.getHeight();
        int border = Math.max(step, Math.min(width, height) / 16);

        for (int y = 0; y < height; y += step) {
            for (int x = 0; x < width; x += step) {
                if (x > border && x < width - border && y > border && y < height - border) {
                    continue;
                }
                int argb = image.getRGB(x, y);
                if (alpha(argb) < 24) {
                    continue;
                }
                red += red(argb);
                green += green(argb);
                blue += blue(argb);
                samples++;
            }
        }

        if (samples == 0) {
            return new Background(255, 255, 255);
        }

        return new Background((int) (red / samples), (int) (green / samples), (int) (blue / samples));
    }

    private Scan scanForeground(BufferedImage image, Background background, int step) {
        int width = image.getWidth();
        int height = image.getHeight();
        int minX = width;
        int minY = height;
        int maxX = -1;
        int maxY = -1;
        int foregroundCount = 0;
        int sampleCount = 0;
        int borderForegroundCount = 0;
        int borderSampleCount = 0;
        int edgeTransitions = 0;
        int borderBand = Math.max(step, Math.min(width, height) / 20);

        for (int y = 0; y < height; y += step) {
            for (int x = 0; x < width; x += step) {
                int argb = image.getRGB(x, y);
                boolean foreground = isForeground(argb, background);
                sampleCount++;

                boolean borderSample = x <= borderBand || y <= borderBand || x >= width - borderBand || y >= height - borderBand;
                if (borderSample) {
                    borderSampleCount++;
                    if (foreground) {
                        borderForegroundCount++;
                    }
                }

                if (foreground) {
                    foregroundCount++;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }

                if (x + step < width && colorDistance(argb, image.getRGB(x + step, y)) > 48) {
                    edgeTransitions++;
                }
                if (y + step < height && colorDistance(argb, image.getRGB(x, y + step)) > 48) {
                    edgeTransitions++;
                }
            }
        }

        return new Scan(
                foregroundCount,
                sampleCount,
                minX,
                minY,
                maxX,
                maxY,
                borderForegroundCount,
                borderSampleCount,
                edgeTransitions);
    }

    private boolean isForeground(int argb, Background background) {
        if (alpha(argb) < 24) {
            return false;
        }

        int distance = colorDistance(red(argb), green(argb), blue(argb), background.red, background.green, background.blue);
        int saturation = Math.max(red(argb), Math.max(green(argb), blue(argb))) - Math.min(red(argb), Math.min(green(argb), blue(argb)));
        return distance > 42 || saturation > 64 && distance > 30;
    }

    private String hardRejectReason(double foregroundRatio, double aspectRatio, double fillRatio, double centerOffset, double borderChaos) {
        if (foregroundRatio < MIN_FOREGROUND_RATIO) {
            return "too little product foreground";
        }
        if (foregroundRatio > MAX_FOREGROUND_RATIO) {
            return "image is too busy to isolate a shoe";
        }
        if (aspectRatio < MIN_ASPECT_RATIO || aspectRatio > MAX_ASPECT_RATIO) {
            return "foreground shape is not shoe-proportioned";
        }
        if (fillRatio < MIN_FILL_RATIO || fillRatio > MAX_FILL_RATIO) {
            return "foreground shape is not a clean product silhouette";
        }
        if (centerOffset > MAX_CENTER_OFFSET) {
            return "shoe candidate is not centered";
        }
        if (borderChaos > 0.48) {
            return "busy border/background content";
        }
        return null;
    }

    private double score(double foregroundRatio, double aspectRatio, double fillRatio, double centerOffset, double borderChaos, double edgeDensity) {
        double foregroundScore = plateauScore(foregroundRatio, 0.05, 0.12, 0.48, 0.68);
        double aspectScore = plateauScore(aspectRatio, 1.1, 1.45, 5.8, 7.4);
        double fillScore = plateauScore(fillRatio, 0.12, 0.2, 0.74, 0.9);
        double centerScore = 1.0 - clamp(centerOffset / MAX_CENTER_OFFSET);
        double backgroundScore = 1.0 - clamp(borderChaos / 0.42);
        double edgeScore = plateauScore(edgeDensity, 0.006, 0.018, 0.34, 0.52);

        return foregroundScore * 0.24
                + aspectScore * 0.25
                + fillScore * 0.16
                + centerScore * 0.15
                + backgroundScore * 0.13
                + edgeScore * 0.07;
    }

    private double plateauScore(double value, double hardMin, double softMin, double softMax, double hardMax) {
        if (value <= hardMin || value >= hardMax) {
            return 0.0;
        }
        if (value >= softMin && value <= softMax) {
            return 1.0;
        }
        if (value < softMin) {
            return clamp((value - hardMin) / (softMin - hardMin));
        }
        return clamp((hardMax - value) / (hardMax - softMax));
    }

    private double normalizedCenterOffset(int width, int height, int minX, int minY, int maxX, int maxY) {
        double centerX = (minX + maxX) / 2.0;
        double centerY = (minY + maxY) / 2.0;
        double dx = Math.abs(centerX - width / 2.0) / Math.max(1.0, width / 2.0);
        double dy = Math.abs(centerY - height / 2.0) / Math.max(1.0, height / 2.0);
        return Math.sqrt(dx * dx + dy * dy) / Math.sqrt(2.0);
    }

    private Analysis reject(String reason) {
        return new Analysis(false, 0.0, reason, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0);
    }

    private static int alpha(int argb) {
        return (argb >>> 24) & 0xff;
    }

    private static int red(int argb) {
        return (argb >>> 16) & 0xff;
    }

    private static int green(int argb) {
        return (argb >>> 8) & 0xff;
    }

    private static int blue(int argb) {
        return argb & 0xff;
    }

    private static int colorDistance(int argb, int otherArgb) {
        return colorDistance(red(argb), green(argb), blue(argb), red(otherArgb), green(otherArgb), blue(otherArgb));
    }

    private static int colorDistance(int redA, int greenA, int blueA, int redB, int greenB, int blueB) {
        int dr = redA - redB;
        int dg = greenA - greenB;
        int db = blueA - blueB;
        return (int) Math.sqrt(dr * dr + dg * dg + db * db);
    }

    private static double clamp(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }

    private static double round(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }

    public record Analysis(
            boolean looksLikeShoe,
            double score,
            String reason,
            double foregroundRatio,
            double aspectRatio,
            double fillRatio,
            double centerOffset,
            double borderChaos,
            double edgeDensity) {
    }

    private record Background(int red, int green, int blue) {
    }

    private record Scan(
            int foregroundCount,
            int sampleCount,
            int minX,
            int minY,
            int maxX,
            int maxY,
            int borderForegroundCount,
            int borderSampleCount,
            int edgeTransitions) {
    }
}
