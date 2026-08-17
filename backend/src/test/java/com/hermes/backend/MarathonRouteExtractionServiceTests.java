package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MarathonRouteExtractionServiceTests {

    @Test
    void extractRoutePathReturnsRouteParametersAndOrderedPixelPoints() throws Exception {
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);
        when(qwenRouteParameterClient.extractRouteParameters("C:\\maps\\boston-course.png", "Providence Marathon", "Providence", "USA", 42.195))
                .thenReturn(new RouteParametersDTO(
                        "#22AA66",
                        List.of("start line", "bridge turn", "park loop", "finish chute")
                ));

RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"points":[[12,34],[56,78],[90,123]],"pointCount":3,"maskPixelCount":456,"skeletonPixelCount":78}
                        """, "", 0)
        );
        RoutePathExtractionResultDTO result = service.extractRoutePath("C:\\maps\\boston-course.png", "Providence Marathon", "Providence", "USA", 42.195);

        assertThat(service.command())
                .containsExactly(
                        "python-custom",
                        "backend/src/main/resources/python/extract_route_path.py",
                        "--image",
                        "C:\\maps\\boston-course.png",
                        "--route-hex-color",
                        "#22AA66"
                );
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#22AA66");
        assertThat(result.routeParameters().anchorPoints()).containsExactly("start line", "bridge turn", "park loop", "finish chute");
        assertThat(result.points())
                .extracting(RoutePixelPointDTO::x, RoutePixelPointDTO::y)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(12, 34),
                        org.assertj.core.groups.Tuple.tuple(56, 78),
                        org.assertj.core.groups.Tuple.tuple(90, 123)
                );
        assertThat(result.pointCount()).isEqualTo(3);
        assertThat(result.maskPixelCount()).isEqualTo(456);
        assertThat(result.skeletonPixelCount()).isEqualTo(78);
    }

    @Test
    void extractRoutePathRaisesHelpfulErrorWhenPythonCliFails() throws Exception {
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);
        when(qwenRouteParameterClient.extractRouteParameters("C:\\maps\\broken-course.png", null, null, null, null))
                .thenReturn(new RouteParametersDTO(
                        "#CC3311",
                        List.of("start", "turn one", "turn two", "finish")
                ));

RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("", ""),
                new FakeProcess("", "mask generation failed", 2)
        );

        assertThatThrownBy(() -> service.extractRoutePath("C:\\maps\\broken-course.png"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("mask generation failed");
    }

    @Test
    void extractRoutePathTimesOutAndDestroysPythonRouteExtraction() throws Exception {
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);
        when(qwenRouteParameterClient.extractRouteParameters("C:\\maps\\slow-course.png", null, null, null, null))
                .thenReturn(new RouteParametersDTO(
                        "#CC3311",
                        List.of("start", "turn one", "turn two", "finish")
                ));
        TimeoutProcess process = new TimeoutProcess();

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("", ""),
                process
        );
        ReflectionTestUtils.setField(service, "extractionTimeoutSeconds", 1L);

        assertThatThrownBy(() -> service.extractRoutePath("C:\\maps\\slow-course.png"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Python route extraction timed out");
        assertThat(process.destroyedForcibly()).isTrue();
    }

    @Test
    void extractRoutePathReusesCachedQwenAndCvResultForSameImage(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("course.png");
        Files.write(imagePath, new byte[] {5, 5, 5, 5});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);
        when(qwenRouteParameterClient.extractRouteParameters(imagePath.toString(), "Providence Marathon", "Providence", "USA", 42.195))
                .thenReturn(new RouteParametersDTO(
                        "#FF0000",
                        List.of("Start", "Downtown", "College Hill", "Finish")
                ));

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"points":[[1,2],[3,4]],"pointCount":2,"maskPixelCount":20,"skeletonPixelCount":10}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO first = service.extractRoutePath(imagePath.toString(), "Providence Marathon", "Providence", "USA", 42.195);
        RoutePathExtractionResultDTO second = service.extractRoutePath(imagePath.toString(), "Providence Marathon", "Providence", "USA", 42.195);

        assertThat(second).isEqualTo(first);
        assertThat(service.startCount()).isEqualTo(1);
        verify(qwenRouteParameterClient, times(1))
                .extractRouteParameters(imagePath.toString(), "Providence Marathon", "Providence", "USA", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicChicagoFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("chicago-course.png");
        Files.write(imagePath, new byte[] {8, 8, 8, 8});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeSource":"saturated","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Chicago Marathon", "Chicago", "USA", 42.195);

        assertThat(service.command()).doesNotContain("--route-hex-color");
        assertThat(service.command())
                .containsSubsequence("--exclude-region", "0.0,0.0,0.36,1.0")
                .containsSubsequence("--exclude-region", "0.78,0.0,1.0,0.18")
                .contains("--append-prominent-branch");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#002068");
        assertThat(result.routeSource()).isEqualTo("saturated");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Grant Park", "Magnificent Mile", "River North", "Lincoln Park");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Chicago Marathon", "Chicago", "USA", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicNewYorkFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("nyc-course.png");
        Files.write(imagePath, new byte[] {9, 9, 9, 9});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#071B42","routeSource":"target","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "New York City Marathon", "New York City", "USA", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#071B42");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#071B42");
        assertThat(result.routeSource()).isEqualTo("target");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Start", "Brooklyn", "Queensboro Bridge", "Finish");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "New York City Marathon", "New York City", "USA", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicOsakaFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("osaka-course.png");
        Files.write(imagePath, new byte[] {10, 10, 10, 10});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#2096D5","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Osaka Marathon", "Osaka", "Japan", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#2096D5");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#2096D5");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Osaka Castle Park", "Osaka City Hall", "Kyocera Dome Osaka", "Nakanoshima Park");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Osaka Marathon", "Osaka", "Japan", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicTokyoFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("tokyo-course.png");
        Files.write(imagePath, new byte[] {11, 11, 11, 11});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#E50058","routeSource":"target","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Tokyo Marathon", "Tokyo", "Japan", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#E50058");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#E50058");
        assertThat(result.routeSource()).isEqualTo("target");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Start", "Asakusa", "Ginza", "Finish");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Tokyo Marathon", "Tokyo", "Japan", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicAthensFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("athens-course.png");
        Files.write(imagePath, new byte[] {12, 12, 12, 12});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#FC5200","routeSource":"target","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Athens Marathon", "Athens", "Greece", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#FC5200");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#FC5200");
        assertThat(result.routeSource()).isEqualTo("target");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Marathon", "Nea Makri", "Pikermi", "Finish");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Athens Marathon", "Athens", "Greece", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicLosAngelesFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("la-course.png");
        Files.write(imagePath, new byte[] {13, 13, 13, 13});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#E8545C","routeSource":"target","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Los Angeles Marathon", "Los Angeles", "United States", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#E8545C");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#E8545C");
        assertThat(result.routeSource()).isEqualTo("target");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Dodger Stadium", "Hollywood", "Beverly Hills", "Finish");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Los Angeles Marathon", "Los Angeles", "United States", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicAucklandFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("auckland-course.png");
        Files.write(imagePath, new byte[] {14, 14, 14, 14});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#D61058","routeSource":"target","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Auckland Marathon", "Auckland", "New Zealand", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#D61058");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#D61058");
        assertThat(result.routeSource()).isEqualTo("target");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Devonport", "Takapuna", "St Heliers", "Finish");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Auckland Marathon", "Auckland", "New Zealand", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicBangkokFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("bangkok-course.png");
        Files.write(imagePath, new byte[] {15, 15, 15, 15});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#C0D828","routeSource":"target","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Bangkok Marathon", "Bangkok", "Thailand", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#C0D828");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#C0D828");
        assertThat(result.routeSource()).isEqualTo("target");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("MBK Center", "Victory Monument", "Rama VIII Bridge", "Finish");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Bangkok Marathon", "Bangkok", "Thailand", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicBuenosAiresFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("buenos-aires-course.png");
        Files.write(imagePath, new byte[] {16, 16, 16, 16});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#C84A4A","routeSource":"target","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Buenos Aires Marathon", "Buenos Aires", "Argentina", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#C84A4A");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#C84A4A");
        assertThat(result.routeSource()).isEqualTo("target");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Largada", "Ciudad Universitaria", "Obelisco", "Boca Juniors");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Buenos Aires Marathon", "Buenos Aires", "Argentina", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicCapeTownFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("cape-town-course.png");
        Files.write(imagePath, new byte[] {17, 17, 17, 17});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#FFD400","routeSource":"target","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Cape Town Marathon", "Cape Town", "South Africa", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#FFD400");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#FFD400");
        assertThat(result.routeSource()).isEqualTo("target");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Beach Rd Start", "Salt River", "Rondebosch Common", "Sea Point");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Cape Town Marathon", "Cape Town", "South Africa", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicChengduMultiColorFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("chengdu-course.png");
        Files.write(imagePath, new byte[] {18, 18, 18, 18});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#B83840","routeSource":"target","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Chengdu Marathon", "Chengdu", "China", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#B83840");
        assertThat(service.command()).containsSubsequence("--route-hex-color", "#185890");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.0,0.0,1.0,0.08");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.0,0.90,1.0,1.0");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#B83840");
        assertThat(result.routeSource()).isEqualTo("target");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Jinsha Site Museum", "Tianfu Square", "Sichuan University Museum", "Century City Finish");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Chengdu Marathon", "Chengdu", "China", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicDalianFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("dalian-course.jpg");
        Files.write(imagePath, new byte[] {19, 19, 19, 19});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"","routeSource":"saturated","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Dalian Marathon", "Dalian", "China", 42.195);

        assertThat(service.command()).doesNotContain("--route-hex-color");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.0,0.0,1.0,0.13");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.0,0.735,1.0,1.0");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.0,0.13,0.045,0.735");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.80,0.13,1.0,0.53");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.69,0.52,0.95,0.73");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.36,0.67,0.95,0.735");
        assertThat(service.command()).contains("--append-prominent-branch");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#FF0000");
        assertThat(result.routeSource()).isEqualTo("saturated");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Start", "Xinghai Bay", "Zhongshan Road", "Finish");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Dalian Marathon", "Dalian", "China", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicHoChiMinhFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("hcmc-course.jpg");
        Files.write(imagePath, new byte[] {20, 20, 20, 20});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#212121","routeSource":"target","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Ho Chi Minh City Marathon", "Ho Chi Minh City", "Vietnam", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#212121");
        assertThat(service.command()).containsSubsequence("--route-hex-color", "#000000");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.0,0.0,1.0,0.14");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.0,0.76,1.0,1.0");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#212121");
        assertThat(result.routeSource()).isEqualTo("target");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Le Duan Nguyen Binh Khiem", "Vo Van Kiet", "Tran Bach Dang", "Road No. 103 TML", "Empire City");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Ho Chi Minh City Marathon", "Ho Chi Minh City", "Vietnam", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicHongKongFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("hong-kong-course.jpg");
        Files.write(imagePath, new byte[] {21, 21, 21, 21});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#E0008A","routeSource":"target","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Hong Kong Marathon", "Hong Kong", "China", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#E0008A");
        assertThat(service.command()).containsSubsequence("--route-hex-color", "#D0007F");
        assertThat(service.command()).containsSubsequence("--route-hex-color", "#EC008C");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.64,0.0,1.0,0.18");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#E0008A");
        assertThat(result.routeSource()).isEqualTo("target");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Nathan Road Tsim Sha Tsui", "Tsing Ma Bridge", "Lai King", "Western Harbour Crossing", "Victoria Park Causeway Bay");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Hong Kong Marathon", "Hong Kong", "China", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicDohaFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("doha-course.png");
        Files.write(imagePath, new byte[] {21, 21, 21, 21});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#FF0000","routeSource":"target","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Doha Marathon", "Doha", "Qatar", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#FF0000");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.0,0.0,1.0,0.06");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.0,0.39,1.0,1.0");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.0,0.0,0.05,1.0");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.36,0.0,1.0,1.0");
        assertThat(service.command()).contains("--append-prominent-branch");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#FF0000");
        assertThat(result.routeSource()).isEqualTo("target");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Hotel Park", "Al Bidda Park", "Doha Port", "Sheraton Grand Doha Resort");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Doha Marathon", "Doha", "Qatar", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicBeijingFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("beijing-course.png");
        Files.write(imagePath, new byte[] {16, 16, 16, 16});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#FF0000","routeSource":"target","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Beijing Marathon", "Beijing", "China", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#FF0000");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#FF0000");
        assertThat(result.routeSource()).isEqualTo("target");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Start", "CCTV Tower", "National Speed Skating Oval", "Finish");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Beijing Marathon", "Beijing", "China", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicBrusselsFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("brussels-course.png");
        Files.write(imagePath, new byte[] {17, 17, 17, 17});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"","routeSource":"saturated","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Brussels Airport Marathon", "Brussels", "Belgium", 42.195);

        assertThat(service.command()).doesNotContain("--route-hex-color");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.70,0.02,1.0,0.25");
        assertThat(service.command()).containsSubsequence("--exclude-region", "0.0,0.69,1.0,1.0");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#FF0000");
        assertThat(result.routeSource()).isEqualTo("saturated");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Start", "Atomium", "Cinquantenaire Park", "Finish");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Brussels Airport Marathon", "Brussels", "Belgium", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicBostonFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("boston-course.png");
        Files.write(imagePath, new byte[] {11, 11, 11, 11});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#FDD835","routeSource":"target","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12,"candidateErrors":["palette:#1E88E5: maximum recursion depth exceeded"]}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Boston Marathon", "Boston", "United States", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#FDD835");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#FDD835");
        assertThat(result.routeSource()).isEqualTo("target");
        assertThat(result.candidateErrors()).contains("palette:#1E88E5: maximum recursion depth exceeded");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Hopkinton", "Framingham", "Wellesley", "Finish");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Boston Marathon", "Boston", "United States", 42.195);
    }

    @Test
    void extractRoutePathSelectsYellowRouteFromOfficialBostonFixture(@TempDir Path tempDir) throws Exception {
        Path python = resolveRouteExtractionPython();
        org.junit.jupiter.api.Assumptions.assumeTrue(python != null, "route extraction Python venv unavailable");
        Path fixture = tempDir.resolve("boston-official-course-map.gif");
        try (InputStream inputStream = MarathonRouteExtractionServiceTests.class.getResourceAsStream("/course-maps/boston-official-course-map.gif")) {
            org.junit.jupiter.api.Assumptions.assumeTrue(inputStream != null, "Boston course-map fixture unavailable");
            Files.copy(inputStream, fixture);
        }
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);
        MarathonRouteExtractionService service = new MarathonRouteExtractionService(qwenRouteParameterClient, new ObjectMapper());
        String pythonExecutable = python == null ? null : python.toString();
        ReflectionTestUtils.setField(service, "pythonExecutable", pythonExecutable);
        ReflectionTestUtils.setField(service, "pythonScriptPath", Path.of("src", "main", "resources", "python", "extract_route_path.py").toString());
        ReflectionTestUtils.setField(service, "extractionTimeoutSeconds", 30L);

        RoutePathExtractionResultDTO result = service.extractRoutePath(fixture.toString(), "Boston Marathon", "Boston", "United States", 42.195);

        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#FDD835");
        assertThat(result.routeSource()).isEqualTo("target");
        assertThat(result.pointCount()).isGreaterThan(800);
        assertThat(result.candidateErrors()).isEmpty();
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(fixture.toString(), "Boston Marathon", "Boston", "United States", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicHonoluluFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("honolulu-course.png");
        Files.write(imagePath, new byte[] {12, 12, 12, 12});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#FF0000","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Honolulu Marathon", "Honolulu", "United States", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#FF0000");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#FF0000");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Ala Moana Beach Park", "Diamond Head", "Hawaii Kai", "Kapiolani Park");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Honolulu Marathon", "Honolulu", "United States", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicManchesterFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("manchester-course.webp");
        Files.write(imagePath, new byte[] {13, 13, 13, 13});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#F5325F","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Manchester Marathon", "Manchester", "United Kingdom", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#F5325F");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#F5325F");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Old Trafford", "Sale", "Altrincham", "Manchester City Centre");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Manchester Marathon", "Manchester", "United Kingdom", 42.195);
    }

    @Test
    void extractRoutePathUsesDeterministicMarineCorpsFastScanBeforeQwen(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("marine-corps-course.png");
        Files.write(imagePath, new byte[] {14, 14, 14, 14});
        QwenRouteParameterClient qwenRouteParameterClient = mock(QwenRouteParameterClient.class);

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                qwenRouteParameterClient,
                new ObjectMapper(),
                new PythonVenvResolver("python-custom", "backend/src/main/resources/python/extract_route_path.py"),
                new FakeProcess("""
                        {"routeHexColor":"#FF0000","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Marine Corps Marathon", "Washington, D.C.", "United States", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#FF0000");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#FF0000");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("MCM START", "Georgetown", "National Mall", "MCM FINISH");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Marine Corps Marathon", "Washington, D.C.", "United States", 42.195);
    }

@Test
    void resolvePythonCommandReturnsExplicitOverride() {
        PythonVenvResolver resolver = new PythonVenvResolver("python-custom", "");
        String resolved = resolver.resolvePythonCommand("extract_route_path.py");
        assertThat(resolved).isEqualTo("python-custom");
    }

    @Test
    void resolvePythonCommandFallsBackToDefaultWhenNoVenvFound() {
        PythonVenvResolver resolver = new PythonVenvResolver("python", "");
        String resolved = resolver.resolvePythonCommand("extract_route_path.py");
        assertThat(resolved)
                .satisfiesAnyOf(
                        value -> assertThat(value).isEqualTo("python"),
                        value -> assertThat(value).endsWith("python.exe"),
                        value -> assertThat(value).endsWith("python")
                );
    }

    private static Path resolveRouteExtractionPython() {
        for (Path candidate : List.of(
                Path.of(".venv", "Scripts", "python.exe"),
                Path.of("backend", ".venv", "Scripts", "python.exe"),
                Path.of(".venv", "bin", "python"),
                Path.of("backend", ".venv", "bin", "python")
        )) {
            if (Files.exists(candidate)) {
                return candidate.toAbsolutePath();
            }
        }
        return null;
    }

private static final class RecordingMarathonRouteExtractionService extends MarathonRouteExtractionService {
        private final Process process;
        private List<String> command;
        private int startCount;

        private RecordingMarathonRouteExtractionService(
                QwenRouteParameterClient qwenRouteParameterClient,
                ObjectMapper objectMapper,
                PythonVenvResolver pythonVenvResolver,
                Process process
        ) {
            super(qwenRouteParameterClient, objectMapper);
            ReflectionTestUtils.setField(this, "pythonExecutable", pythonVenvResolver.resolvePythonCommand("extract_route_path.py"));
            ReflectionTestUtils.setField(this, "pythonScriptPath", pythonVenvResolver.resolveScriptPath("extract_route_path.py"));
            this.process = process;
        }

        @Override
        protected Process startPythonProcess(List<String> command) {
            this.command = List.copyOf(command);
            this.startCount++;
            return process;
        }

        private List<String> command() {
            return command;
        }

        private int startCount() {
            return startCount;
        }
    }

    private static final class FakeProcess extends Process {
        private final InputStream inputStream;
        private final InputStream errorStream;
        private final int exitCode;

        private FakeProcess(String stdout, String stderr, int exitCode) {
            this.inputStream = new ByteArrayInputStream(stdout.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            this.errorStream = new ByteArrayInputStream(stderr.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            this.exitCode = exitCode;
        }

        @Override
        public OutputStream getOutputStream() {
            return OutputStream.nullOutputStream();
        }

        @Override
        public InputStream getInputStream() {
            return inputStream;
        }

        @Override
        public InputStream getErrorStream() {
            return errorStream;
        }

        @Override
        public int waitFor() {
            return exitCode;
        }

        @Override
        public int exitValue() {
            return exitCode;
        }

        @Override
        public void destroy() {
        }

        @Override
        public Process destroyForcibly() {
            return this;
        }

        @Override
        public boolean isAlive() {
            return false;
        }
    }

    private static final class TimeoutProcess extends Process {
        private boolean destroyedForcibly;

        @Override
        public OutputStream getOutputStream() {
            return OutputStream.nullOutputStream();
        }

        @Override
        public InputStream getInputStream() {
            return new ByteArrayInputStream(new byte[0]);
        }

        @Override
        public InputStream getErrorStream() {
            return new ByteArrayInputStream(new byte[0]);
        }

        @Override
        public int waitFor() {
            return 0;
        }

        @Override
        public boolean waitFor(long timeout, TimeUnit unit) {
            return false;
        }

        @Override
        public int exitValue() {
            return 0;
        }

        @Override
        public void destroy() {
            destroyedForcibly = true;
        }

        @Override
        public Process destroyForcibly() {
            destroyedForcibly = true;
            return this;
        }

        @Override
        public boolean isAlive() {
            return !destroyedForcibly;
        }

        private boolean destroyedForcibly() {
            return destroyedForcibly;
        }
    }
}
