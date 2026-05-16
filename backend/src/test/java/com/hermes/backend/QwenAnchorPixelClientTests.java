package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class QwenAnchorPixelClientTests {

    @Test
    void extractAnchorPixelsInvokesConfiguredPythonWorkerAndParsesJson(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("course.png");
        Files.write(imagePath, new byte[] {1, 2, 3, 4});

        RecordingQwenAnchorPixelClient client = new RecordingQwenAnchorPixelClient(
                new ObjectMapper(),
                new FakeProcess("""
                        {"anchors":[{"label":"Start","x":123,"y":456},{"label":"River Crossing","x":234,"y":567},{"label":"Downtown Turn","x":345,"y":678},{"label":"Finish","x":456,"y":789}]}
                        """, "", 0)
        );
        ReflectionTestUtils.setField(client, "pythonExecutable", "python-custom");
        ReflectionTestUtils.setField(client, "pythonScriptPath", "backend/src/main/resources/python/extract_anchor_pixels_qwen.py");
        ReflectionTestUtils.setField(client, "modelId", "Qwen/Qwen2.5-VL-7B-Instruct");
        ReflectionTestUtils.setField(client, "deviceMap", "auto");

        List<RouteAnchorPixelPointDTO> result = client.extractAnchorPixels(
                imagePath.toString(),
                new RouteParametersDTO("#22AA66", List.of("Start", "River Crossing", "Downtown Turn", "Finish"))
        );

        assertThat(client.command()).containsExactly(
                "python-custom",
                "backend/src/main/resources/python/extract_anchor_pixels_qwen.py",
                "--image",
                imagePath.toString(),
                "--model-id",
                "Qwen/Qwen2.5-VL-7B-Instruct",
                "--device-map",
                "auto",
                "--anchor",
                "Start",
                "--anchor",
                "River Crossing",
                "--anchor",
                "Downtown Turn",
                "--anchor",
                "Finish"
        );
        assertThat(result)
                .extracting(RouteAnchorPixelPointDTO::label, RouteAnchorPixelPointDTO::x, RouteAnchorPixelPointDTO::y)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("Start", 123, 456),
                        org.assertj.core.groups.Tuple.tuple("River Crossing", 234, 567),
                        org.assertj.core.groups.Tuple.tuple("Downtown Turn", 345, 678),
                        org.assertj.core.groups.Tuple.tuple("Finish", 456, 789)
                );
    }

    @Test
    void extractAnchorPixelsAcceptsSixVisibleAnchors(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("course.png");
        Files.write(imagePath, new byte[] {1, 2, 3, 4});

        RecordingQwenAnchorPixelClient client = new RecordingQwenAnchorPixelClient(
                new ObjectMapper(),
                new FakeProcess("""
                        {"anchors":[{"label":"Start","x":100,"y":200},{"label":"Bridge","x":150,"y":240},{"label":"Park","x":210,"y":280},{"label":"Downtown","x":260,"y":320},{"label":"Stadium","x":310,"y":360},{"label":"Finish","x":360,"y":400}]}
                        """, "", 0)
        );
        ReflectionTestUtils.setField(client, "pythonExecutable", "python-custom");
        ReflectionTestUtils.setField(client, "pythonScriptPath", "backend/src/main/resources/python/extract_anchor_pixels_qwen.py");
        ReflectionTestUtils.setField(client, "modelId", "Qwen/Qwen2.5-VL-7B-Instruct");
        ReflectionTestUtils.setField(client, "deviceMap", "auto");

        List<RouteAnchorPixelPointDTO> result = client.extractAnchorPixels(
                imagePath.toString(),
                new RouteParametersDTO("#22AA66", List.of("Start", "Bridge", "Park", "Downtown", "Stadium", "Finish"))
        );

        assertThat(client.command()).containsSubsequence("--anchor", "Start", "--anchor", "Bridge", "--anchor", "Park", "--anchor", "Downtown", "--anchor", "Stadium", "--anchor", "Finish");
        assertThat(result)
                .extracting(RouteAnchorPixelPointDTO::label, RouteAnchorPixelPointDTO::x, RouteAnchorPixelPointDTO::y)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("Start", 100, 200),
                        org.assertj.core.groups.Tuple.tuple("Bridge", 150, 240),
                        org.assertj.core.groups.Tuple.tuple("Park", 210, 280),
                        org.assertj.core.groups.Tuple.tuple("Downtown", 260, 320),
                        org.assertj.core.groups.Tuple.tuple("Stadium", 310, 360),
                        org.assertj.core.groups.Tuple.tuple("Finish", 360, 400)
                );
    }

    @Test
    void extractAnchorPixelsRejectsResponsesWithoutEveryRequestedAnchor(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("course.png");
        Files.write(imagePath, new byte[] {1, 2, 3, 4});

        RecordingQwenAnchorPixelClient client = new RecordingQwenAnchorPixelClient(
                new ObjectMapper(),
                new FakeProcess("""
                        {"anchors":[{"label":"Start","x":1,"y":2},{"label":"River Crossing","x":3,"y":4},{"label":"Finish","x":7,"y":8}]}
                        """, "", 0)
        );

        assertThatThrownBy(() -> client.extractAnchorPixels(
                imagePath.toString(),
                new RouteParametersDTO("#22AA66", List.of("Start", "River Crossing", "Downtown Turn", "Finish"))
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("one anchor object per requested label");
    }

    @Test
    void extractAnchorPixelsRejectsCoordinatesOutsideImageBounds(@TempDir Path tempDir) throws Exception {
        Path imagePath = tempDir.resolve("course.png");
        BufferedImage image = new BufferedImage(100, 80, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, image.getWidth(), image.getHeight());
        } finally {
            graphics.dispose();
        }
        ImageIO.write(image, "png", imagePath.toFile());

        RecordingQwenAnchorPixelClient client = new RecordingQwenAnchorPixelClient(
                new ObjectMapper(),
                new FakeProcess("""
                        {"anchors":[{"label":"Start","x":10,"y":20},{"label":"River Crossing","x":30,"y":40},{"label":"Downtown Turn","x":101,"y":50},{"label":"Finish","x":60,"y":70}]}
                        """, "", 0)
        );

        assertThatThrownBy(() -> client.extractAnchorPixels(
                imagePath.toString(),
                new RouteParametersDTO("#22AA66", List.of("Start", "River Crossing", "Downtown Turn", "Finish"))
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("outside image bounds");
    }

    private static final class RecordingQwenAnchorPixelClient extends QwenAnchorPixelClient {
        private final Process process;
        private List<String> command;

        private RecordingQwenAnchorPixelClient(ObjectMapper objectMapper, Process process) {
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
