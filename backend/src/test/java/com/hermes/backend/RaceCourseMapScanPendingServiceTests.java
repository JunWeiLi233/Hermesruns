package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RaceCourseMapScanPendingServiceTests {

    @Test
    void scanPendingCourseMapStagesDiscoveredCandidateWhenNoPendingUploadExists(@TempDir Path courseMapUploadDirectory) throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isCourseMapAiConfigured()).thenReturn(false);
        when(repository.findByRaceId("race-no-pending")).thenReturn(Optional.empty());
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));
        Files.write(courseMapUploadDirectory.resolve("race-no-pending-local.png"), samplePng());

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository, courseMapUploadDirectory);

        RaceCourseMapResult result = service.scanPendingCourseMap(
                "race-no-pending",
                "Race No Pending Marathon",
                "Boston",
                "United States",
                "https://example.com/race",
                42.3601,
                -71.0589,
                42.195,
                "admin@hermes.test"
        );

        assertThat(result.imageUrl()).startsWith("local-course-map:race-no-pending");
        assertThat(result.summary()).contains("Course-map AI is not configured");
        verify(repository).save(any(RaceCourseMapAsset.class));
    }

    private RaceCourseMapService createService(
            RestTemplate restTemplate,
            SystemConfigService systemConfigService,
            RaceCourseMapAssetRepository repository,
            Path courseMapUploadDirectory
    ) {
        ObjectMapper objectMapper = new ObjectMapper();
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        RaceCourseMapSearchService searchService = new RaceCourseMapSearchService(restTemplate);
        RaceCourseMapImageService imageService = new RaceCourseMapImageService(restTemplate);
        ReflectionTestUtils.setField(imageService, "courseMapUploadDirectory", courseMapUploadDirectory.toString());
        RaceCourseMapAiService aiService = new RaceCourseMapAiService(
                restTemplate,
                objectMapper,
                geometryService,
                mock(QwenCourseMapAlignmentClient.class)
        );
        return new RaceCourseMapService(restTemplate, objectMapper, systemConfigService, repository, null, geometryService, searchService, imageService, aiService);
    }

    private byte[] samplePng() throws Exception {
        BufferedImage image = new BufferedImage(1200, 900, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }
}
