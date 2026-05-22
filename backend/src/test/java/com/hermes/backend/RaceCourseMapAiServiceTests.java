package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.mockito.ArgumentCaptor;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RaceCourseMapAiServiceTests {

    @Test
    void analyzeCandidateUsesQwenEvenWhenLegacyGeminiProviderFlagsAreSet() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        QwenCourseMapAlignmentClient qwenClient = mock(QwenCourseMapAlignmentClient.class);
        when(qwenClient.analyzeCandidate(any(), eq("image/png"), any())).thenReturn("""
                {
                  "isCourseMap": true,
                  "confidence": 82,
                  "summary": "Aligned with local Qwen.",
                  "overlayBounds": { "north": 42.4, "south": 42.3, "east": -71.0, "west": -71.2 },
                  "routePoints": [
                    { "lat": 42.2280, "lng": -71.5220, "label": "Start" },
                    { "lat": 42.2450, "lng": -71.4800 },
                    { "lat": 42.2620, "lng": -71.4380 },
                    { "lat": 42.2790, "lng": -71.3960 },
                    { "lat": 42.2960, "lng": -71.3540 },
                    { "lat": 42.3130, "lng": -71.3120 },
                    { "lat": 42.3300, "lng": -71.2700 },
                    { "lat": 42.3380, "lng": -71.2300 },
                    { "lat": 42.3430, "lng": -71.1900 },
                    { "lat": 42.3460, "lng": -71.1500 },
                    { "lat": 42.3485, "lng": -71.1100 },
                    { "lat": 42.3498, "lng": -71.0785, "label": "Finish" }
                  ]
                }
                """);

        RaceCourseMapAiService service = new RaceCourseMapAiService(restTemplate, new ObjectMapper(), geometryService, qwenClient);

        RaceCourseMapService.CourseMapAlignment alignment = service.analyzeCandidate(
                "https://cdn.example.com/course-map.png",
                samplePngBytes(),
                "Boston Marathon",
                "Boston",
                "United States",
                42.3601,
                -71.0589,
                42.195,
                false,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT,
                "image/png"
        );

        assertThat(alignment).isNotNull();
        assertThat(alignment.summary()).contains("Qwen");
        verify(qwenClient, atLeastOnce()).analyzeCandidate(any(), eq("image/png"), any());
        verify(restTemplate, never()).exchange(any(String.class), any(), any(), eq(java.util.Map.class));
    }

    @Test
    void analyzeCandidateUsesQwenDirectAlignmentWhenCourseMapProviderIsQwenLocal() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        QwenCourseMapAlignmentClient qwenClient = mock(QwenCourseMapAlignmentClient.class);
        when(qwenClient.analyzeCandidate(any(), eq("image/png"), any())).thenReturn("""
                {
                  "isCourseMap": true,
                  "confidence": 82,
                  "summary": "Aligned with local Qwen.",
                  "overlayBounds": { "north": 42.4, "south": 42.3, "east": -71.0, "west": -71.2 },
                  "routePoints": [
                    { "lat": 42.2280, "lng": -71.5220, "label": "Start" },
                    { "lat": 42.2450, "lng": -71.4800 },
                    { "lat": 42.2620, "lng": -71.4380 },
                    { "lat": 42.2790, "lng": -71.3960 },
                    { "lat": 42.2960, "lng": -71.3540 },
                    { "lat": 42.3130, "lng": -71.3120 },
                    { "lat": 42.3300, "lng": -71.2700 },
                    { "lat": 42.3380, "lng": -71.2300 },
                    { "lat": 42.3430, "lng": -71.1900 },
                    { "lat": 42.3460, "lng": -71.1500 },
                    { "lat": 42.3485, "lng": -71.1100 },
                    { "lat": 42.3498, "lng": -71.0785, "label": "Finish" }
                  ]
                }
                """);

        RaceCourseMapAiService service = new RaceCourseMapAiService(restTemplate, new ObjectMapper(), geometryService, qwenClient);

        RaceCourseMapService.CourseMapAlignment alignment = service.analyzeCandidate(
                "https://cdn.example.com/course-map.png",
                samplePngBytes(),
                "Boston Marathon",
                "Boston",
                "United States",
                42.3601,
                -71.0589,
                42.195,
                false,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT,
                "image/png"
        );

        assertThat(alignment).isNotNull();
        assertThat(alignment.isCourseMap()).isTrue();
        assertThat(alignment.confidence()).isEqualTo(82);
        assertThat(alignment.summary()).contains("Qwen");
        assertThat(alignment.routePoints()).hasSize(12);
    }

    @Test
    void parseAlignmentTreatsStringBooleanCourseMapFlagAsTrue() {
        RaceCourseMapAiService service = new RaceCourseMapAiService(mock(RestTemplate.class), new ObjectMapper(), new RaceCourseMapGeometryService());

        RaceCourseMapService.CourseMapAlignment alignment = ReflectionTestUtils.invokeMethod(
                service,
                "parseAlignment",
                """
                        {
                          "isCourseMap": "true",
                          "confidence": "79",
                          "summary": "Aligned a stylized course map.",
                          "overlayBounds": { "north": 42.4, "south": 42.3, "east": -71.0, "west": -71.2 },
                          "routePoints": [
                            { "lat": 42.31, "lng": -71.15, "label": "Start" },
                            { "lat": 42.32, "lng": -71.14 },
                            { "lat": 42.33, "lng": -71.13 },
                            { "lat": 42.34, "lng": -71.12 },
                            { "lat": 42.35, "lng": -71.11 },
                            { "lat": 42.36, "lng": -71.10 }
                          ]
                        }
                        """,
                42.3601,
                -71.0589,
                42.195,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT
        );

        assertThat(alignment).isNotNull();
        assertThat(alignment.isCourseMap()).isTrue();
        assertThat(alignment.confidence()).isEqualTo(79);
        assertThat(alignment.routePoints()).hasSize(6);
    }

    @Test
    void analyzeCandidateRetriesWhenInitialQwenAlignmentOnlyCoversShortFinishAreaSegment() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        QwenCourseMapAlignmentClient qwenClient = mock(QwenCourseMapAlignmentClient.class);
        when(qwenClient.analyzeCandidate(any(), eq("image/png"), any())).thenReturn(
                """
                {
                  "isCourseMap": true,
                  "confidence": 90,
                  "summary": "Detected the Boston finish-area route.",
                  "overlayBounds": { "north": 42.38, "south": 42.22, "east": -71.04, "west": -71.55 },
                  "routePoints": [
                    { "lat": 42.3490, "lng": -71.0900, "label": "Beacon St" },
                    { "lat": 42.3492, "lng": -71.0860 },
                    { "lat": 42.3494, "lng": -71.0820 },
                    { "lat": 42.3496, "lng": -71.0800 },
                    { "lat": 42.3498, "lng": -71.0782, "label": "Finish" }
                  ]
                }
                """,
                """
                {
                  "isCourseMap": true,
                  "confidence": 91,
                  "summary": "Recovered the full Boston Marathon route from Hopkinton to Boston.",
                  "overlayBounds": { "north": 42.38, "south": 42.22, "east": -71.04, "west": -71.55 },
                  "routePoints": [
                    { "lat": 42.2280, "lng": -71.5220, "label": "Start" },
                    { "lat": 42.2340, "lng": -71.5080 },
                    { "lat": 42.2400, "lng": -71.4940 },
                    { "lat": 42.2460, "lng": -71.4800 },
                    { "lat": 42.2520, "lng": -71.4660 },
                    { "lat": 42.2580, "lng": -71.4520 },
                    { "lat": 42.2640, "lng": -71.4380 },
                    { "lat": 42.2700, "lng": -71.4240 },
                    { "lat": 42.2760, "lng": -71.4100 },
                    { "lat": 42.2820, "lng": -71.3960 },
                    { "lat": 42.2880, "lng": -71.3820 },
                    { "lat": 42.2940, "lng": -71.3680 },
                    { "lat": 42.3000, "lng": -71.3540 },
                    { "lat": 42.3060, "lng": -71.3400 },
                    { "lat": 42.3120, "lng": -71.3260 },
                    { "lat": 42.3180, "lng": -71.3120 },
                    { "lat": 42.3240, "lng": -71.2980 },
                    { "lat": 42.3300, "lng": -71.2840 },
                    { "lat": 42.3360, "lng": -71.2700 },
                    { "lat": 42.3400, "lng": -71.2400 },
                    { "lat": 42.3430, "lng": -71.2050 },
                    { "lat": 42.3460, "lng": -71.1700 },
                    { "lat": 42.3485, "lng": -71.1200 },
                    { "lat": 42.3498, "lng": -71.0785, "label": "Finish" }
                  ]
                }
                """
        );

        RaceCourseMapAiService service = new RaceCourseMapAiService(restTemplate, new ObjectMapper(), geometryService, qwenClient);

        RaceCourseMapService.CourseMapAlignment alignment = service.analyzeCandidate(
                "https://cdn.example.com/course-map.png",
                samplePngBytes(),
                "Boston Marathon",
                "Boston",
                "United States",
                42.3601,
                -71.0589,
                42.195,
                false,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT,
                "image/png"
        );

        assertThat(alignment).isNotNull();
        assertThat(alignment.summary()).contains("Recovered the full Boston Marathon route");
        assertThat(alignment.routePoints()).hasSizeGreaterThan(12);
        verify(qwenClient, times(2)).analyzeCandidate(any(), eq("image/png"), any());
    }

    @Test
    void analyzeCandidateRetriesWhenQwenRepeatsChicagoCityCenterAsRoute() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        QwenCourseMapAlignmentClient qwenClient = mock(QwenCourseMapAlignmentClient.class);
        when(qwenClient.analyzeCandidate(any(), eq("image/png"), any())).thenReturn(
                """
                {
                  "isCourseMap": true,
                  "confidence": 75,
                  "summary": "Detected the Chicago Marathon course map, but reused city center points.",
                  "overlayBounds": { "north": 41.93, "south": 41.83, "east": -87.50, "west": -87.75 },
                  "routePoints": [
                    { "lat": 41.8781, "lng": -87.6298, "label": "Start" },
                    { "lat": 41.8781, "lng": -87.6298 },
                    { "lat": 41.8781, "lng": -87.6298 },
                    { "lat": 41.8781, "lng": -87.6298 },
                    { "lat": 41.8781, "lng": -87.6298, "label": "Finish" }
                  ]
                }
                """,
                """
                {
                  "isCourseMap": true,
                  "confidence": 88,
                  "summary": "Recovered the full Chicago Marathon course across distinct neighborhoods.",
                  "overlayBounds": { "north": 42.03, "south": 41.75, "east": -87.57, "west": -87.76 },
                  "routePoints": [
                    { "lat": 41.8819, "lng": -87.6233, "label": "Start" },
                    { "lat": 41.9005, "lng": -87.6310 },
                    { "lat": 41.9280, "lng": -87.6405 },
                    { "lat": 41.9476, "lng": -87.6550 },
                    { "lat": 41.9250, "lng": -87.6430 },
                    { "lat": 41.8955, "lng": -87.6350 },
                    { "lat": 41.8840, "lng": -87.6500 },
                    { "lat": 41.8810, "lng": -87.6680 },
                    { "lat": 41.8680, "lng": -87.6565 },
                    { "lat": 41.8520, "lng": -87.6500 },
                    { "lat": 41.8430, "lng": -87.6320 },
                    { "lat": 41.8320, "lng": -87.6265 },
                    { "lat": 41.8160, "lng": -87.6170 },
                    { "lat": 41.7900, "lng": -87.6155 },
                    { "lat": 41.8230, "lng": -87.6230 },
                    { "lat": 41.8756, "lng": -87.6244, "label": "Finish" }
                  ]
                }
                """
        );

        RaceCourseMapAiService service = new RaceCourseMapAiService(restTemplate, new ObjectMapper(), geometryService, qwenClient);

        RaceCourseMapService.CourseMapAlignment alignment = service.analyzeCandidate(
                "https://cdn.example.com/chicago-course-map.jpg",
                samplePngBytes(),
                "Bank of America Chicago Marathon",
                "Chicago",
                "United States",
                41.8781,
                -87.6298,
                42.195,
                false,
                RaceCourseMapService.PromptRaceType.LOOP,
                "image/png"
        );

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(qwenClient, times(2)).analyzeCandidate(any(), eq("image/png"), promptCaptor.capture());
        assertThat(alignment).isNotNull();
        assertThat(alignment.summary()).contains("Recovered the full Chicago Marathon course");
        assertThat(alignment.routePoints()).hasSizeGreaterThan(12);
        assertThat(promptCaptor.getAllValues().get(0)).contains("Known Chicago Marathon corridor");
        assertThat(promptCaptor.getAllValues().get(0)).contains("consecutive route points share the same coordinate");
        assertThat(promptCaptor.getAllValues().get(1)).contains("Do NOT reuse the Chicago city center");
    }

    @Test
    void analyzeCandidateRejectsCollapsedCityCenterRouteWhenCorrectiveQwenDoesNotFixIt() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        QwenCourseMapAlignmentClient qwenClient = mock(QwenCourseMapAlignmentClient.class);
        when(qwenClient.analyzeCandidate(any(), eq("image/png"), any())).thenReturn("""
                {
                  "isCourseMap": true,
                  "confidence": 84,
                  "summary": "Detected a course map but only returned city center points.",
                  "overlayBounds": { "north": 41.93, "south": 41.83, "east": -87.50, "west": -87.75 },
                  "routePoints": [
                    { "lat": 41.8781, "lng": -87.6298, "label": "Start" },
                    { "lat": 41.8781, "lng": -87.6298 },
                    { "lat": 41.8781, "lng": -87.6298 },
                    { "lat": 41.8781, "lng": -87.6298 },
                    { "lat": 41.8781, "lng": -87.6298, "label": "Finish" }
                  ]
                }
                """);

        RaceCourseMapAiService service = new RaceCourseMapAiService(restTemplate, new ObjectMapper(), geometryService, qwenClient);

        RaceCourseMapService.CourseMapAlignment alignment = service.analyzeCandidate(
                "https://cdn.example.com/chicago-course-map.jpg",
                samplePngBytes(),
                "Bank of America Chicago Marathon",
                "Chicago",
                "United States",
                41.8781,
                -87.6298,
                42.195,
                false,
                RaceCourseMapService.PromptRaceType.LOOP,
                "image/png"
        );

        assertThat(alignment).isNull();
        verify(qwenClient, times(2)).analyzeCandidate(any(), eq("image/png"), any());
    }

    @Test
    void analyzeCandidateRejectsNewYorkMarathonRouteThatDriftsIntoOpenWaterWhenCorrectiveQwenDoesNotFixIt() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        QwenCourseMapAlignmentClient qwenClient = mock(QwenCourseMapAlignmentClient.class);
        when(qwenClient.analyzeCandidate(any(), eq("image/png"), any())).thenReturn("""
                {
                  "isCourseMap": true,
                  "confidence": 91,
                  "summary": "Guessed the NYC Marathon route from memory, including a lower-bay/ocean waypoint.",
                  "overlayBounds": { "north": 40.84, "south": 40.54, "east": -73.88, "west": -74.10 },
                  "routePoints": [
                    { "lat": 40.6036, "lng": -74.0566, "label": "Start" },
                    { "lat": 40.6150, "lng": -74.0350 },
                    { "lat": 40.5600, "lng": -73.9300, "label": "Ocean waypoint" },
                    { "lat": 40.6500, "lng": -73.9900 },
                    { "lat": 40.6782, "lng": -73.9442, "label": "Brooklyn" },
                    { "lat": 40.7000, "lng": -73.9400 },
                    { "lat": 40.7250, "lng": -73.9300 },
                    { "lat": 40.7567, "lng": -73.9548, "label": "Queensboro Bridge" },
                    { "lat": 40.7700, "lng": -73.9500 },
                    { "lat": 40.7900, "lng": -73.9400 },
                    { "lat": 40.8150, "lng": -73.9300 },
                    { "lat": 40.8050, "lng": -73.9150 },
                    { "lat": 40.7900, "lng": -73.9300 },
                    { "lat": 40.7800, "lng": -73.9500 },
                    { "lat": 40.7711, "lng": -73.9742, "label": "Finish" }
                  ]
                }
                """);

        RaceCourseMapAiService service = new RaceCourseMapAiService(restTemplate, new ObjectMapper(), geometryService, qwenClient);

        RaceCourseMapService.CourseMapAlignment alignment = service.analyzeCandidate(
                "https://cdn.example.com/nyc-course-map.jpg",
                samplePngBytes(),
                "TCS New York City Marathon",
                "New York",
                "United States",
                40.7128,
                -74.0060,
                42.195,
                false,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT,
                "image/png"
        );

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(qwenClient, times(2)).analyzeCandidate(any(), eq("image/png"), promptCaptor.capture());
        assertThat(alignment).isNull();
        assertThat(promptCaptor.getAllValues().get(0)).contains("Known New York City Marathon corridor");
        assertThat(promptCaptor.getAllValues().get(1)).contains("open water");
    }

    @Test
    void analyzeCandidateRejectsKnownMarathonRouteOutsideLocalCourseBoundsWhenCorrectiveQwenDoesNotFixIt() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        QwenCourseMapAlignmentClient qwenClient = mock(QwenCourseMapAlignmentClient.class);
        when(qwenClient.analyzeCandidate(any(), eq("image/png"), any())).thenReturn("""
                {
                  "isCourseMap": true,
                  "confidence": 90,
                  "summary": "Recovered a Chicago route but drifted outside the known marathon corridor into Lake Michigan.",
                  "overlayBounds": { "north": 42.03, "south": 41.75, "east": -87.56, "west": -87.76 },
                  "routePoints": [
                    { "lat": 41.8819, "lng": -87.6233, "label": "Start" },
                    { "lat": 41.9005, "lng": -87.6310 },
                    { "lat": 41.9280, "lng": -87.6405 },
                    { "lat": 41.9476, "lng": -87.6550 },
                    { "lat": 41.9250, "lng": -87.6430 },
                    { "lat": 41.8955, "lng": -87.5600, "label": "Lake Michigan waypoint" },
                    { "lat": 41.8840, "lng": -87.6500 },
                    { "lat": 41.8810, "lng": -87.6680 },
                    { "lat": 41.8680, "lng": -87.6565 },
                    { "lat": 41.8520, "lng": -87.6500 },
                    { "lat": 41.8430, "lng": -87.6320 },
                    { "lat": 41.8320, "lng": -87.6265 },
                    { "lat": 41.8160, "lng": -87.6170 },
                    { "lat": 41.7900, "lng": -87.6155 },
                    { "lat": 41.8230, "lng": -87.6230 },
                    { "lat": 41.8756, "lng": -87.6244, "label": "Finish" }
                  ]
                }
                """);

        RaceCourseMapAiService service = new RaceCourseMapAiService(restTemplate, new ObjectMapper(), geometryService, qwenClient);

        RaceCourseMapService.CourseMapAlignment alignment = service.analyzeCandidate(
                "https://cdn.example.com/chicago-course-map.jpg",
                samplePngBytes(),
                "Bank of America Chicago Marathon",
                "Chicago",
                "United States",
                41.8781,
                -87.6298,
                42.195,
                false,
                RaceCourseMapService.PromptRaceType.LOOP,
                "image/png"
        );

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(qwenClient, times(2)).analyzeCandidate(any(), eq("image/png"), promptCaptor.capture());
        assertThat(alignment).isNull();
        assertThat(promptCaptor.getAllValues().get(0)).contains("Known Chicago Marathon corridor");
        assertThat(promptCaptor.getAllValues().get(1)).contains("outside the known");
    }

    @Test
    void analyzeCandidateReturnsLowerDensityCorrectiveRouteForServiceSpecificPlausibility() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        QwenCourseMapAlignmentClient qwenClient = mock(QwenCourseMapAlignmentClient.class);
        when(qwenClient.analyzeCandidate(any(), eq("image/png"), any())).thenReturn(
                """
                {
                  "isCourseMap": true,
                  "confidence": 90,
                  "summary": "Detected a collapsed Tokyo finish-area route.",
                  "overlayBounds": { "north": 35.75, "south": 35.55, "east": 139.85, "west": 139.55 },
                  "routePoints": [
                    { "lat": 35.6895, "lng": 139.6917, "label": "Start" },
                    { "lat": 35.6895, "lng": 139.6917 },
                    { "lat": 35.6895, "lng": 139.6917, "label": "Finish" }
                  ]
                }
                """,
                """
                {
                  "isCourseMap": true,
                  "confidence": 90,
                  "summary": "Recovered a lower-density Tokyo Marathon route.",
                  "overlayBounds": { "north": 35.75, "south": 35.55, "east": 139.85, "west": 139.55 },
                  "routePoints": [
                    { "lat": 35.4000, "lng": 139.6500, "label": "Start" },
                    { "lat": 35.4550, "lng": 139.6500 },
                    { "lat": 35.5100, "lng": 139.6500 },
                    { "lat": 35.5650, "lng": 139.6500 },
                    { "lat": 35.6200, "lng": 139.6500 },
                    { "lat": 35.6750, "lng": 139.6500 },
                    { "lat": 35.7300, "lng": 139.6500 },
                    { "lat": 35.7800, "lng": 139.6500, "label": "Finish" }
                  ]
                }
                """
        );

        RaceCourseMapAiService service = new RaceCourseMapAiService(restTemplate, new ObjectMapper(), geometryService, qwenClient);

        RaceCourseMapService.CourseMapAlignment alignment = service.analyzeCandidate(
                "https://cdn.example.com/tokyo-course-map.webp",
                samplePngBytes(),
                "Tokyo Marathon",
                "Tokyo",
                "Japan",
                35.6762,
                139.6503,
                42.195,
                false,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT,
                "image/png"
        );

        assertThat(alignment).isNotNull();
        assertThat(alignment.summary()).contains("lower-density Tokyo Marathon route");
        assertThat(alignment.routePoints()).hasSize(8);
        verify(qwenClient, times(2)).analyzeCandidate(any(), eq("image/png"), any());
    }

    @Test
    void analyzeCandidatePreservesLowerDensityOriginalRouteWhenCorrectiveRouteRegresses() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        QwenCourseMapAlignmentClient qwenClient = mock(QwenCourseMapAlignmentClient.class);
        when(qwenClient.analyzeCandidate(any(), eq("image/png"), any())).thenReturn(
                """
                {
                  "isCourseMap": true,
                  "confidence": 90,
                  "summary": "Recovered a lower-density Tokyo Marathon route.",
                  "overlayBounds": { "north": 35.75, "south": 35.55, "east": 139.85, "west": 139.55 },
                  "routePoints": [
                    { "lat": 35.4000, "lng": 139.6500, "label": "Start" },
                    { "lat": 35.4550, "lng": 139.6500 },
                    { "lat": 35.5100, "lng": 139.6500 },
                    { "lat": 35.5650, "lng": 139.6500 },
                    { "lat": 35.6200, "lng": 139.6500 },
                    { "lat": 35.6750, "lng": 139.6500 },
                    { "lat": 35.7300, "lng": 139.6500 },
                    { "lat": 35.7800, "lng": 139.6500, "label": "Finish" }
                  ]
                }
                """,
                """
                {
                  "isCourseMap": true,
                  "confidence": 70,
                  "summary": "Regressed to a single city-center point.",
                  "overlayBounds": { "north": 35.75, "south": 35.55, "east": 139.85, "west": 139.55 },
                  "routePoints": [
                    { "lat": 35.6895, "lng": 139.6917, "label": "Start" }
                  ]
                }
                """
        );

        RaceCourseMapAiService service = new RaceCourseMapAiService(restTemplate, new ObjectMapper(), geometryService, qwenClient);

        RaceCourseMapService.CourseMapAlignment alignment = service.analyzeCandidate(
                "https://cdn.example.com/tokyo-course-map.webp",
                samplePngBytes(),
                "Tokyo Marathon",
                "Tokyo",
                "Japan",
                35.6762,
                139.6503,
                42.195,
                false,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT,
                "image/png"
        );

        assertThat(alignment).isNotNull();
        assertThat(alignment.summary()).contains("lower-density Tokyo Marathon route");
        assertThat(alignment.routePoints()).hasSize(8);
        verify(qwenClient, times(2)).analyzeCandidate(any(), eq("image/png"), any());
    }

    @Test
    void buildAlignmentPromptRequestsDenseFullMarathonCheckpointsWithBostonCorridorHints() {
        RaceCourseMapPromptBuilder promptBuilder = new RaceCourseMapPromptBuilder();

        String prompt = promptBuilder.buildAlignmentPrompt(
                "Boston Marathon",
                "Boston",
                "United States",
                42.3601,
                -71.0589,
                42.195,
                false,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT,
                null
        );

        assertThat(prompt).contains("16 to 24 routePoints");
        assertThat(prompt).contains("Hopkinton");
        assertThat(prompt).contains("Wellesley");
        assertThat(prompt).contains("Copley");
        assertThat(prompt).contains("Spread points EVENLY");
        assertThat(prompt).contains("Do NOT focus only on the final downtown segment");
    }

    @Test
    void buildAlignmentPromptPreservesExplicitOutAndBackReturnGeometry() {
        RaceCourseMapPromptBuilder promptBuilder = new RaceCourseMapPromptBuilder();

        String prompt = promptBuilder.buildAlignmentPrompt(
                "Example Out And Back Marathon",
                "Example City",
                "United States",
                40.0,
                -75.0,
                42.195,
                false,
                RaceCourseMapService.PromptRaceType.OUT_AND_BACK,
                null
        );

        assertThat(prompt).contains("Trace the full outbound leg, the turnaround point, and the return leg");
        assertThat(prompt).contains("When the return lane is visibly separate from the outbound");
        assertThat(prompt).doesNotContain("Trace ONLY the outbound direction");
        assertThat(prompt).doesNotContain("Reported distance should be HALF");
    }

    @Test
    void buildAlignmentPromptScansAnyRouteBearingCourseMapPictureWithoutWeakeningAccuracy() {
        RaceCourseMapPromptBuilder promptBuilder = new RaceCourseMapPromptBuilder();

        String prompt = promptBuilder.buildAlignmentPrompt(
                "Chicago Marathon",
                "Chicago",
                "United States",
                41.8781,
                -87.6298,
                42.195,
                true,
                RaceCourseMapService.PromptRaceType.LOOP,
                null
        );

        assertThat(prompt).contains("ACCEPT AS A COURSE MAP");
        assertThat(prompt).contains("Printed course maps");
        assertThat(prompt).contains("photographed maps");
        assertThat(prompt).contains("screenshots");
        assertThat(prompt).contains("PDF-rendered maps");
        assertThat(prompt).contains("Poster-style official race graphics");
        assertThat(prompt).contains("STAGE 1");
        assertThat(prompt).contains("STAGE 2");
        assertThat(prompt).contains("STAGE 3");
        assertThat(prompt).contains("routePoints=[]");
        assertThat(prompt).contains("distinct, ordered checkpoints");
        assertThat(prompt).contains("street names");
        assertThat(prompt).contains("mile or kilometer markers");
        assertThat(prompt).contains("HONESTY RULE");
        assertThat(prompt).contains("Known Chicago Marathon corridor");
        assertThat(prompt).contains("NEVER copy cityCenterLat/cityCenterLng");
        assertThat(prompt).contains("consecutive route points share the same coordinate");
    }

    private byte[] samplePngBytes() {
        return new byte[] {
                (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x0D
        };
    }
}
