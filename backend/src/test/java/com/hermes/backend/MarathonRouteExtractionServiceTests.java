package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MarathonRouteExtractionServiceTests {

    @Test
    void extractRoutePathReturnsRouteParametersAndOrderedPixelPoints() throws Exception {
        GeminiRouteParameterClient geminiRouteParameterClient = mock(GeminiRouteParameterClient.class);
        when(geminiRouteParameterClient.extractRouteParameters("C:\\maps\\boston-course.png"))
                .thenReturn(new RouteParametersDTO(
                        "#22AA66",
                        List.of("start line", "bridge turn", "park loop", "finish chute")
                ));

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                geminiRouteParameterClient,
                new ObjectMapper(),
                new FakeProcess("""
                        {"points":[[12,34],[56,78],[90,123]],"pointCount":3,"maskPixelCount":456,"skeletonPixelCount":78}
                        """, "", 0)
        );
        ReflectionTestUtils.setField(service, "pythonExecutable", "python-custom");
        ReflectionTestUtils.setField(service, "pythonScriptPath", "backend/src/main/resources/python/extract_route_path.py");

        RoutePathExtractionResultDTO result = service.extractRoutePath("C:\\maps\\boston-course.png");

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
        GeminiRouteParameterClient geminiRouteParameterClient = mock(GeminiRouteParameterClient.class);
        when(geminiRouteParameterClient.extractRouteParameters("C:\\maps\\broken-course.png"))
                .thenReturn(new RouteParametersDTO(
                        "#CC3311",
                        List.of("start", "turn one", "turn two", "finish")
                ));

        RecordingMarathonRouteExtractionService service = new RecordingMarathonRouteExtractionService(
                geminiRouteParameterClient,
                new ObjectMapper(),
                new FakeProcess("", "mask generation failed", 2)
        );

        assertThatThrownBy(() -> service.extractRoutePath("C:\\maps\\broken-course.png"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("mask generation failed");
    }

    private static final class RecordingMarathonRouteExtractionService extends MarathonRouteExtractionService {
        private final Process process;
        private List<String> command;

        private RecordingMarathonRouteExtractionService(
                GeminiRouteParameterClient geminiRouteParameterClient,
                ObjectMapper objectMapper,
                Process process
        ) {
            super(geminiRouteParameterClient, objectMapper);
            this.process = process;
        }

        @Override
        protected Process startPythonProcess(List<String> command) {
            this.command = List.copyOf(command);
            return process;
        }

        private List<String> command() {
            return command;
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
}
