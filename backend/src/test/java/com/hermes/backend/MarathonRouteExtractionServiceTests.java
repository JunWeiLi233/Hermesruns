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
                        {"routeHexColor":"#253858","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Chicago Marathon", "Chicago", "USA", 42.195);

        assertThat(service.command()).doesNotContain("--route-hex-color");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#253858");
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
                        {"routeHexColor":"#0000FF","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "New York City Marathon", "New York City", "USA", 42.195);

        assertThat(service.command()).doesNotContain("--route-hex-color");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#0000FF");
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
                        {"routeHexColor":"#D71920","points":[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]],"pointCount":12,"maskPixelCount":120,"skeletonPixelCount":12}
                        """, "", 0)
        );

        RoutePathExtractionResultDTO result = service.extractRoutePath(imagePath.toString(), "Osaka Marathon", "Osaka", "Japan", 42.195);

        assertThat(service.command()).containsSubsequence("--route-hex-color", "#D00000");
        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#D71920");
        assertThat(result.routeParameters().anchorPoints())
                .containsExactly("Osaka Castle Park", "Osaka City Hall", "Kyocera Dome Osaka", "Nakanoshima Park");
        verify(qwenRouteParameterClient, never())
                .extractRouteParameters(imagePath.toString(), "Osaka Marathon", "Osaka", "Japan", 42.195);
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
        ReflectionTestUtils.setField(service, "pythonExecutable", python.toString());
        ReflectionTestUtils.setField(service, "pythonScriptPath", Path.of("src", "main", "resources", "python", "extract_route_path.py").toString());
        ReflectionTestUtils.setField(service, "extractionTimeoutSeconds", 30L);

        RoutePathExtractionResultDTO result = service.extractRoutePath(fixture.toString(), "Boston Marathon", "Boston", "United States", 42.195);

        assertThat(result.routeParameters().routeHexColor()).isEqualTo("#FDD835");
        assertThat(result.routeSource()).isEqualTo("target");
        assertThat(result.pointCount()).isGreaterThan(1_000);
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
