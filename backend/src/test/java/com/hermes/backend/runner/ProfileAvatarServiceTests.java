package com.hermes.backend.runner;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.zip.CRC32;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class ProfileAvatarServiceTests {
    private final RunnerRepository runnerRepository = mock(RunnerRepository.class);
    private final ProfileAvatarService service = new ProfileAvatarService(runnerRepository);

    @Test
    void jpegIsNormalizedToPngAtTheSameAspectRatioWithoutSaving() throws IOException {
        byte[] result = service.normalizeAvatarImage(imageBytes("jpeg", 1200, 600));

        assertThat(result).startsWith((byte) 0x89, (byte) 0x50, (byte) 0x4e, (byte) 0x47);
        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(result));
        assertThat(decoded.getWidth()).isEqualTo(512);
        assertThat(decoded.getHeight()).isEqualTo(256);
        verifyNoInteractions(runnerRepository);
    }

    @Test
    void smallPngIsNotUpscaled() throws IOException {
        byte[] result = service.normalizeAvatarImage(imageBytes("png", 8, 4));

        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(result));
        assertThat(decoded.getWidth()).isEqualTo(8);
        assertThat(decoded.getHeight()).isEqualTo(4);
    }

    @Test
    void sourceDimensionAndPixelLimitsAreCheckedBeforeDecoding() throws IOException {
        byte[] png = imageBytes("png", 8, 8);
        byte[] tooWide = dimensions(png, 4097, 1);
        byte[] tooManyPixels = dimensions(png, 4001, 4000);

        assertThatThrownBy(() -> service.normalizeAvatarImage(tooWide))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Profile image dimensions are too large.");
        assertThatThrownBy(() -> service.normalizeAvatarImage(tooManyPixels))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Profile image dimensions are too large.");
        verifyNoInteractions(runnerRepository);
    }

    @Test
    void invalidImageBytesKeepTheExistingValidationMessage() {
        assertThatThrownBy(() -> service.normalizeAvatarImage(new byte[] { 1, 2, 3 }))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Upload a valid PNG or JPEG profile image.");
    }

    private byte[] imageBytes(String format, int width, int height) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), format, output);
        return output.toByteArray();
    }

    private byte[] dimensions(byte[] png, int width, int height) {
        // Valid IHDR metadata exercises the pre-decode guard without allocating a huge image.
        byte[] result = png.clone();
        ByteBuffer.wrap(result).putInt(16, width).putInt(20, height);
        CRC32 checksum = new CRC32();
        checksum.update(result, 12, 17);
        ByteBuffer.wrap(result).putInt(29, (int) checksum.getValue());
        return result;
    }
}
