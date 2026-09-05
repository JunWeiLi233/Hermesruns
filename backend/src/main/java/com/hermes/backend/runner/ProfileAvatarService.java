package com.hermes.backend.runner;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.Iterator;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.springframework.stereotype.Service;

@Service
public class ProfileAvatarService {
    private static final int MAX_PROFILE_AVATAR_SOURCE_DIMENSION = 4096;
    private static final long MAX_PROFILE_AVATAR_SOURCE_PIXELS = 16_000_000L;
    private static final int PROFILE_AVATAR_RENDER_DIMENSION = 512;

    private final RunnerRepository runnerRepository;

    public ProfileAvatarService(RunnerRepository runnerRepository) {
        this.runnerRepository = runnerRepository;
    }

    public void storeAvatar(Runner runner, byte[] normalizedImage) {
        runner.setAvatarImage(normalizedImage);
        runnerRepository.save(runner);
    }

    public void deleteAvatar(Runner runner) {
        runner.setAvatarImage(null);
        runnerRepository.save(runner);
    }

    public byte[] normalizeAvatarImage(byte[] sourceBytes) throws IOException {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(sourceBytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw new IllegalArgumentException("Upload a valid PNG or JPEG profile image.");
            }

            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                int sourceWidth = reader.getWidth(0);
                int sourceHeight = reader.getHeight(0);
                if (sourceWidth <= 0 || sourceHeight <= 0
                        || sourceWidth > MAX_PROFILE_AVATAR_SOURCE_DIMENSION
                        || sourceHeight > MAX_PROFILE_AVATAR_SOURCE_DIMENSION
                        || (long) sourceWidth * sourceHeight > MAX_PROFILE_AVATAR_SOURCE_PIXELS) {
                    throw new IllegalArgumentException("Profile image dimensions are too large.");
                }

                BufferedImage source = reader.read(0);
                if (source == null) {
                    throw new IllegalArgumentException("Upload a valid PNG or JPEG profile image.");
                }

                double scale = Math.min(1d, PROFILE_AVATAR_RENDER_DIMENSION / (double) Math.max(sourceWidth, sourceHeight));
                int targetWidth = Math.max(1, (int) Math.round(sourceWidth * scale));
                int targetHeight = Math.max(1, (int) Math.round(sourceHeight * scale));
                BufferedImage normalized = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_ARGB);
                Graphics2D graphics = normalized.createGraphics();
                try {
                    graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                    graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                    graphics.drawImage(source, 0, 0, targetWidth, targetHeight, null);
                } finally {
                    graphics.dispose();
                }

                ByteArrayOutputStream output = new ByteArrayOutputStream();
                if (!ImageIO.write(normalized, "png", output)) {
                    throw new IOException("PNG writer unavailable");
                }
                return output.toByteArray();
            } finally {
                reader.dispose();
            }
        }
    }

    public String avatarDataUrl(Runner runner) {
        byte[] avatarImage = runner.getAvatarImage();
        if (avatarImage == null || avatarImage.length == 0) {
            return null;
        }
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(avatarImage);
    }
}
