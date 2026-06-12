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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class QwenRouteParameterClientTests {

    @Test
    void extractRouteParametersInvokesConfiguredPythonWorkerAndParsesJson(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("course.png");
        Files.write(imagePath, new byte[] {1, 2, 3, 4});

        RecordingQwenRouteParameterClient client = new RecordingQwenRouteParameterClient(
                new ObjectMapper(),
                new FakeProcess("""
                        {"routeHexColor":"#00FF88","anchorPoints":["start arch","river bend","downtown turn","finish gantry"]}
                        """, "", 0)
        );
        ReflectionTestUtils.setField(client, "pythonExecutable", "python-custom");
        ReflectionTestUtils.setField(client, "pythonScriptPath", "backend/src/main/resources/python/extract_route_parameters_qwen.py");
        ReflectionTestUtils.setField(client, "modelId", "Qwen/Qwen2.5-VL-7B-Instruct");
        ReflectionTestUtils.setField(client, "deviceMap", "auto");

        RouteParametersDTO result = client.extractRouteParameters(
                imagePath.toString(),
                "Osaka Marathon",
                "Osaka",
                "Japan",
                42.195
        );

        assertThat(client.command()).containsExactly(
                "python-custom",
                "backend/src/main/resources/python/extract_route_parameters_qwen.py",
                "--image",
                imagePath.toString(),
                "--race-name",
                "Osaka Marathon",
                "--city",
                "Osaka",
                "--country",
                "Japan",
                "--distance-km",
                "42.195",
                "--model-id",
                "Qwen/Qwen2.5-VL-7B-Instruct",
                "--device-map",
                "auto"
        );
        assertThat(result.routeHexColor()).isEqualTo("#00FF88");
        assertThat(result.anchorPoints()).containsExactly("start arch", "river bend", "downtown turn", "finish gantry");
    }

    @Test
    void parseRouteParametersKeepsVisibleAnchorSetsBetweenFourAndTen() {
        QwenRouteParameterClient client = new QwenRouteParameterClient(new ObjectMapper());

        RouteParametersDTO result = client.parseRouteParameters("""
                {
                  "routeHexColor": "#00ff88",
                  "anchorPoints": [
                    "start arch",
                    "river bend",
                    "downtown turn",
                    "north park",
                    "stadium loop",
                    "finish gantry"
                  ]
                }
                """);

        assertThat(result.routeHexColor()).isEqualTo("#00FF88");
        assertThat(result.anchorPoints()).containsExactly(
                "start arch",
                "river bend",
                "downtown turn",
                "north park",
                "stadium loop",
                "finish gantry"
        );
    }

    @Test
    void parseRouteParametersRejectsMissingRouteColorInsteadOfGuessingRed() {
        QwenRouteParameterClient client = new QwenRouteParameterClient(new ObjectMapper());

        assertThatThrownBy(() -> client.parseRouteParameters("""
                {
                  "anchorPoints": ["Start", "Bridge", "Park", "Finish"]
                }
                """))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("routeHexColor");
    }

    @Test
    void parseRouteParametersRejectsTooFewAnchorsInsteadOfUsingSyntheticBounds() {
        QwenRouteParameterClient client = new QwenRouteParameterClient(new ObjectMapper());

        assertThatThrownBy(() -> client.parseRouteParameters("""
                {
                  "routeHexColor": "#ff0000",
                  "anchorPoints": ["Start", "Finish"]
                }
                """))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least 4");
    }

    @Test
    void extractRouteParametersRaisesHelpfulErrorWhenWorkerFails(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("course.png");
        Files.write(imagePath, new byte[] {1, 2, 3, 4});

        RecordingQwenRouteParameterClient client = new RecordingQwenRouteParameterClient(
                new ObjectMapper(),
                new FakeProcess("", "Qwen model failed to load", 2)
        );

        assertThatThrownBy(() -> client.extractRouteParameters(imagePath.toString(), null, null, null, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Qwen model failed to load");
    }

    private static final class RecordingQwenRouteParameterClient extends QwenRouteParameterClient {
        private final Process process;
        private List<String> command;

        private RecordingQwenRouteParameterClient(ObjectMapper objectMapper, Process process) {
            super(objectMapper);
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
