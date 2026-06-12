package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class RaceCourseMapImageServiceTests {

    @Test
    void fetchDocumentBytesPreservesAlreadyEncodedUrlPathSegments() throws Exception {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).build();
        RaceCourseMapImageService imageService = new RaceCourseMapImageService(restTemplate);
        String encodedImageUrl = "https://example.test/maps/2026%20TCSLM%20Road%20Closure%20Leaflet_DIGITAL.png";
        byte[] imageBytes = samplePng();

        server.expect(requestTo(encodedImageUrl))
                .andRespond(withSuccess(imageBytes, MediaType.IMAGE_PNG));

        RaceCourseMapService.ResolvedCandidateAsset resolved = imageService.resolveUploadedReference(encodedImageUrl);

        assertThat(resolved).isNotNull();
        assertThat(resolved.imageBytes()).isEqualTo(imageBytes);
        server.verify();
    }

    private byte[] samplePng() throws Exception {
        BufferedImage image = new BufferedImage(1200, 900, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }
}
