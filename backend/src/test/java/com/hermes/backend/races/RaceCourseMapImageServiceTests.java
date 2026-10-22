package com.hermes.backend.races;

import com.hermes.backend.races.model.ResolvedCandidateAsset;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
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

        ResolvedCandidateAsset resolved = imageService.resolveUploadedReference(encodedImageUrl);

        assertThat(resolved).isNotNull();
        assertThat(resolved.imageBytes()).isEqualTo(imageBytes);
        server.verify();
    }

    @Test
    void storeCourseMapUploadKeepsHostileRaceIdsInsideTheUploadDirectory(@TempDir Path uploadDirectory) throws Exception {
        RaceCourseMapImageService imageService = new RaceCourseMapImageService(new RestTemplate());
        ReflectionTestUtils.setField(imageService, "courseMapUploadDirectory", uploadDirectory.toString());
        byte[] imageBytes = samplePng();

        ResolvedCandidateAsset stored = imageService.storeCourseMapUpload(
                "../../etc/..passwd", new ResolvedCandidateAsset("data:image/png;base64,x", imageBytes));

        String fileName = stored.imageUrl().substring("local-course-map:".length());
        assertThat(fileName).doesNotContain("..").doesNotContain("/").matches("[a-z0-9._-]+\\.png");
        assertThat(Files.readAllBytes(uploadDirectory.resolve(fileName))).isEqualTo(imageBytes);
    }

    @Test
    void storeCourseMapUploadSanitisesLongDotRunsInLinearTime(@TempDir Path uploadDirectory) throws Exception {
        RaceCourseMapImageService imageService = new RaceCourseMapImageService(new RestTemplate());
        ReflectionTestUtils.setField(imageService, "courseMapUploadDirectory", uploadDirectory.toString());
        byte[] imageBytes = samplePng();
        String raceId = "a" + ".".repeat(200_000) + "b";

        ResolvedCandidateAsset stored = assertTimeoutPreemptively(Duration.ofSeconds(5), () ->
                imageService.storeCourseMapUpload(raceId, new ResolvedCandidateAsset("data:image/png;base64,x", imageBytes)));

        assertThat(stored.imageUrl()).startsWith("local-course-map:a.b-");
    }

    @Test
    void pipelineImageFilesAreFreshTempFilesThatCanBeDeleted() throws Exception {
        RaceCourseMapImageService imageService = new RaceCourseMapImageService(new RestTemplate());
        byte[] imageBytes = samplePng();

        Path staged = imageService.writePipelineImageFile(imageBytes);
        try {
            assertThat(staged.getFileName().toString()).startsWith("hermes-route-").endsWith(".png");
            assertThat(staged.toAbsolutePath().normalize())
                    .startsWith(Path.of(System.getProperty("java.io.tmpdir")).toAbsolutePath().normalize());
            assertThat(Files.readAllBytes(staged)).isEqualTo(imageBytes);
        } finally {
            imageService.deletePipelineImageFile(staged);
        }
        assertThat(staged).doesNotExist();
    }

    private byte[] samplePng() throws Exception {
        BufferedImage image = new BufferedImage(1200, 900, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }
}
