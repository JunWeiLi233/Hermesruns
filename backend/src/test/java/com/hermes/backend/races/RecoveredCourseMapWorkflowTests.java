package com.hermes.backend.races;

import com.hermes.backend.runner.Runner;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.Base64;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class RecoveredCourseMapWorkflowTests {
    @Test
    void hcmcRecognizedJpegRetainsItsExact250PointBindingAcrossTwoUploadResolutions() throws Exception {
        byte[] source=getClass().getResourceAsStream("/course-maps/hcmc-2025.jpg").readAllBytes();
        assertThat(VerifiedCourseMapReference.match(source,"Ho Chi Minh City Marathon","Ho Chi Minh City","Vietnam",42.195))
                .isPresent().get().extracting(c -> c.routePoints().size()).isEqualTo(250);
        var images=new RaceCourseMapImageService(new org.springframework.web.client.RestTemplate());
        var first=images.resolveUploadedReference("data:image/jpeg;base64,"+Base64.getEncoder().encodeToString(source));
        var second=images.resolveUploadedReference(first.imageUrl());

        assertThat(Arrays.equals(first.imageBytes(),source)).as("first resolution retains exact source bytes").isTrue();
        assertThat(Arrays.equals(second.imageBytes(),source)).as("second resolution retains exact source bytes").isTrue();
        for(var resolved : java.util.List.of(first,second)) {
            var binding=VerifiedCourseMapReference.match(resolved.imageBytes(),"Ho Chi Minh City Marathon","Ho Chi Minh City","Vietnam",42.195)
                    .orElseThrow();
            assertThat(binding.routePoints()).hasSize(250);
            assertThat(binding.source()).isEqualTo("reviewed-source-map:ho-chi-minh-city-marathon");
            assertThat(VerifiedCourseMapReference.match(resolved.imageBytes(),"Tokyo Marathon","Tokyo","Japan",42.195)).isEmpty();
            assertThat(VerifiedCourseMapReference.match(resolved.imageBytes(),"Ho Chi Minh City Marathon","Ho Chi Minh City","Vietnam",21.1)).isEmpty();
        }
        byte[] changed=source.clone();changed[changed.length-1]^=1;
        assertThat(VerifiedCourseMapReference.isRecognizedImage(changed)).isFalse();
        assertThat(VerifiedCourseMapReference.match(changed,"Ho Chi Minh City Marathon","Ho Chi Minh City","Vietnam",42.195)).isEmpty();
    }

    @Test
    void recognizedImagesStillDecodeBeforeThePreservationDecision() {
        byte[] invalid="not an image".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        var images=spy(new RaceCourseMapImageService(new org.springframework.web.client.RestTemplate()));
        try(var references=mockStatic(VerifiedCourseMapReference.class)) {
            references.when(() -> VerifiedCourseMapReference.isRecognizedImage(any(byte[].class))).thenReturn(true);
            images.resolveUploadedReference("data:image/jpeg;base64,"+Base64.getEncoder().encodeToString(invalid));
            verify(images).decodeImage(any(byte[].class));
            references.verifyNoInteractions();
        }
    }

    @Test
    void recognizedImagesOutsidePreviewLimitsStillNormalizeInsteadOfPreservingBytes() throws Exception {
        var images=new RaceCourseMapImageService(new org.springframework.web.client.RestTemplate());
        byte[] oversizedDimensions=workflowPng(1900,220);
        byte[] oversizedBytes=Arrays.copyOf(workflowPng(256,256),6*1024*1024+1);
        try(var references=mockStatic(VerifiedCourseMapReference.class)) {
            references.when(() -> VerifiedCourseMapReference.isRecognizedImage(any(byte[].class))).thenReturn(true);
            for(byte[] source : java.util.List.of(oversizedDimensions,oversizedBytes)) {
                var normalized=images.resolveUploadedReference("data:image/png;base64,"+Base64.getEncoder().encodeToString(source));
                assertThat(Arrays.equals(normalized.imageBytes(),source)).isFalse();
                var decoded=images.decodeImage(normalized.imageBytes());
                assertThat(Math.max(decoded.getWidth(),decoded.getHeight())).isLessThanOrEqualTo(1800);
                assertThat(normalized.imageBytes().length).isLessThan(6*1024*1024);
            }
        }
    }

    @Test
    void unrecognizedRasterUploadsKeepTheirExistingNormalization() throws Exception {
        byte[] source=workflowPng(400,300);
        var images=new RaceCourseMapImageService(new org.springframework.web.client.RestTemplate());
        assertThat(VerifiedCourseMapReference.isRecognizedImage(source)).isFalse();
        var normalized=images.resolveUploadedReference("data:image/png;base64,"+Base64.getEncoder().encodeToString(source));
        assertThat(normalized.imageUrl()).startsWith("data:image/jpeg;base64,");
        assertThat(Arrays.equals(normalized.imageBytes(),source)).isFalse();
        assertThat(images.decodeImage(normalized.imageBytes()).getWidth()).isEqualTo(400);
    }

    private byte[] workflowPng(int width,int height) throws Exception {
        var image=new BufferedImage(width,height,BufferedImage.TYPE_INT_RGB);
        var output=new ByteArrayOutputStream();
        ImageIO.write(image,"png",output);
        return output.toByteArray();
    }

    @Test
    void sourceCheckedSingaporeTrackIsLabeledAsAReviewDraftAndExportsItsOriginalPoints() throws Exception {
        byte[] bytes=getClass().getResourceAsStream("/course-maps/singapore-2024.jpg").readAllBytes();
        var course=VerifiedCourseMapReference.match(bytes,"Standard Chartered Singapore Marathon","Singapore","Singapore",42.195).orElseThrow();
        assertThat(course.source()).isEqualTo("reviewed-source-map:singapore-marathon");
        assertThat(course.summary()).contains("review draft","2024").doesNotContain("original ordered organizer coordinates");
        assertThat(course.preview("source.jpg").confidence()).isEqualTo(85);
        var extraction=mock(MarathonRouteExtractionService.class);
        var georeferencing=mock(MarathonRouteGeoreferencingService.class);
        var matching=mock(OsrmMapMatchingClient.class);
        var persistence=mock(GeneratedRaceGpxPersistenceService.class);
        when(persistence.save(any(),anyString(),anyString(),anyString(),anyString(),anyString(),any(),anyString()))
                .thenReturn(new GeneratedRaceGpxAsset());
        var pipeline=new MarathonRoutePipelineService(extraction,georeferencing,
                new MarathonRouteMatchAndExportService(matching,new GpxExportService(),persistence));
        var result=pipeline.runPipeline(new Runner(),"singapore-marathon","Standard Chartered Singapore Marathon","Singapore","Singapore",
                "https://www.singaporemarathon.com",42.195,"data:image/jpeg;base64,"+Base64.getEncoder().encodeToString(bytes));
        assertThat(result.matchExportResult().matchedBreadcrumbs()).hasSize(124);
        assertThat(result.matchExportResult().gpxXml()).contains("review draft");
        verifyNoInteractions(extraction,georeferencing,matching);
    }
    @Test
    void londonRecovered2026ImageKeepsTheCompleteOrganizerLinkedRoute() throws Exception {
        byte[] image=getClass().getResourceAsStream("/course-maps/london-2026.jpg").readAllBytes();
        var reference=VerifiedCourseMapReference.match(image,"TCS London Marathon","London","United Kingdom",42.195);
        assertThat(reference).isPresent();
        var course=reference.orElseThrow();
        assertThat(course.routePoints()).hasSize(850);
        assertThat(new RaceCourseMapGeometryService().polylineDistanceKm(course.routePoints())).isBetween(42.3,42.7);
        assertThat(course.sourceUrl()).contains("3477685973392799106");
        assertThat(VerifiedCourseMapReference.match(image,"Manchester Marathon","Manchester","United Kingdom",42.195)).isEmpty();
        assertThat(VerifiedCourseMapReference.match(image,"TCS London Marathon","London","United Kingdom",21.1)).isEmpty();
    }
    @Test
    void renderedOfficialHonoluluPdfRetainsItsExactSourceBinding() throws Exception {
        byte[] pdf=getClass().getResourceAsStream("/course-maps/honolulu-2026.pdf").readAllBytes();
        var image=new RaceCourseMapImageService(new org.springframework.web.client.RestTemplate()).resolveUploadedReference(
                "data:application/pdf;base64,"+Base64.getEncoder().encodeToString(pdf));
        assertThat(VerifiedCourseMapReference.match(image.imageBytes(),"Honolulu Marathon","Honolulu","United States",42.195))
                .isPresent().get().extracting(c -> c.routePoints().size()).isEqualTo(492);
    }
    @Test
    void honoluluExactOfficialSourceUsesTheFull2026CourseWithoutAiOrRoadRerouting() throws Exception {
        byte[] bytes=getClass().getResourceAsStream("/course-maps/honolulu-2026.jpg").readAllBytes();
        var course=VerifiedCourseMapReference.match(bytes,"Honolulu Marathon","Honolulu","United States",42.195);
        assertThat(course).isPresent();
        assertThat(course.get().routePoints()).hasSize(492);
        assertThat(course.get().summary()).contains("2026");
        assertThat(RaceKnownOrderedCourseCatalog.assessKnownCourseRoute(course.get().routePoints(),
                "Honolulu Marathon","Honolulu","United States",new RaceCourseMapGeometryService()).accepted()).isTrue();
        var extraction=mock(MarathonRouteExtractionService.class);
        var georeferencing=mock(MarathonRouteGeoreferencingService.class);
        var matching=mock(OsrmMapMatchingClient.class);
        var persistence=mock(GeneratedRaceGpxPersistenceService.class);
        when(persistence.save(any(),anyString(),anyString(),anyString(),anyString(),anyString(),any(),anyString()))
                .thenReturn(new GeneratedRaceGpxAsset());
        var pipeline=new MarathonRoutePipelineService(extraction,georeferencing,
                new MarathonRouteMatchAndExportService(matching,new GpxExportService(),persistence));
        var result=pipeline.runPipeline(new Runner(),"honolulu-marathon","Honolulu Marathon","Honolulu","United States","https://www.honolulumarathon.org",42.195,
                "data:image/jpeg;base64,"+Base64.getEncoder().encodeToString(bytes));
        assertThat(result.matchExportResult().matchedBreadcrumbs()).hasSize(492);
        assertThat(result.matchExportResult().gpxXml().split("<trkpt ").length-1).isEqualTo(492);
        verifyNoInteractions(extraction,georeferencing,matching);
    }

    @Test
    void recoveredSourceCannotSupplyAnotherRaceOrDistanceAndRequiresExactContent() throws Exception {
        byte[] bytes=getClass().getResourceAsStream("/course-maps/honolulu-2026.jpg").readAllBytes();
        assertThat(VerifiedCourseMapReference.match(bytes,"Tokyo Marathon","Tokyo","Japan",42.195)).isEmpty();
        assertThat(VerifiedCourseMapReference.match(bytes,"Honolulu Marathon","Honolulu","United States",21.1)).isEmpty();
        bytes[bytes.length-1]^=1;
        assertThat(VerifiedCourseMapReference.match(bytes,"Honolulu Marathon","Honolulu","United States",42.195)).isEmpty();
    }
}
