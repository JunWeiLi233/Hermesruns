package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.TimeUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class QwenCourseMapAlignmentClientTests {

    @Test
    void analyzeCandidateInvokesConfiguredPythonWorkerAndReturnsNormalizedJson() {
        RecordingQwenCourseMapAlignmentClient client = new RecordingQwenCourseMapAlignmentClient(
                new ObjectMapper(),
                new FakeProcess("""
                        {
                          "isCourseMap": true,
                          "confidence": 82,
                          "summary": "Aligned with local Qwen.",
                          "overlayBounds": { "north": 42.4, "south": 42.3, "east": -71.0, "west": -71.2 },
                          "routePoints": [
                            { "lat": 42.31, "lng": -71.15, "label": "Start" },
                            { "lat": 42.32, "lng": -71.14 }
                          ]
                        }
                        """, "", 0)
        );
        ReflectionTestUtils.setField(client, "pythonExecutable", "python-custom");
        ReflectionTestUtils.setField(client, "pythonScriptPath", "backend/src/main/resources/python/analyze_course_map_alignment_qwen.py");
        ReflectionTestUtils.setField(client, "modelId", "Qwen/Qwen2.5-VL-7B-Instruct");
        ReflectionTestUtils.setField(client, "deviceMap", "auto");

        String json = client.analyzeCandidate(new byte[] {1, 2, 3, 4}, "image/png", "prompt text");

        assertThat(client.command()).contains("python-custom");
        assertThat(client.command()).contains("backend/src/main/resources/python/analyze_course_map_alignment_qwen.py");
        assertThat(client.command()).contains("--model-id");
        assertThat(client.command()).contains("Qwen/Qwen2.5-VL-7B-Instruct");
        assertThat(client.command()).contains("--device-map");
        assertThat(client.command()).contains("auto");
        assertThat(client.command()).contains("--prompt-file");
        assertThat(json).contains("\"isCourseMap\":true");
        assertThat(json).contains("\"summary\":\"Aligned with local Qwen.\"");
    }

    @Test
    void analyzeCandidateRaisesHelpfulErrorWhenWorkerFails() {
        RecordingQwenCourseMapAlignmentClient client = new RecordingQwenCourseMapAlignmentClient(
                new ObjectMapper(),
                new FakeProcess("", "Qwen direct alignment failed", 2)
        );

        assertThatThrownBy(() -> client.analyzeCandidate(new byte[] {1, 2, 3, 4}, "image/png", "prompt text"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Qwen direct alignment failed");
    }

    @Test
    void analyzeCandidateRecordsQwenWatcherSteps() {
        CourseMapScanWatcher watcher = new CourseMapScanWatcher();
        RecordingQwenCourseMapAlignmentClient client = new RecordingQwenCourseMapAlignmentClient(
                new ObjectMapper(),
                watcher,
                new FakeProcess("""
                        {
                          "isCourseMap": true,
                          "confidence": 82,
                          "summary": "Aligned with local Qwen.",
                          "routePoints": [
                            { "lat": 42.31, "lng": -71.15 },
                            { "lat": 42.32, "lng": -71.14 }
                          ]
                        }
                        """, "", 0)
        );

        try (CourseMapScanWatcher.ScanScope ignored = watcher.watch("boston-marathon", "reanalyze")) {
            client.analyzeCandidate(new byte[] {1, 2, 3, 4}, "image/png", "prompt text");
            assertThat(watcher.currentSteps())
                    .extracting(CourseMapScanStep::stage)
                    .contains(
                            "qwen.temp_image_written",
                            "qwen.prompt_file_written",
                            "qwen.process_started",
                            "qwen.process_completed",
                            "qwen.stdout_normalized"
                    );
        }
    }

    @Test
    void analyzeCandidateRecordsTimeoutWatcherStep() {
        CourseMapScanWatcher watcher = new CourseMapScanWatcher();
        RecordingQwenCourseMapAlignmentClient client = new RecordingQwenCourseMapAlignmentClient(
                new ObjectMapper(),
                watcher,
                new TimeoutProcess()
        );
        ReflectionTestUtils.setField(client, "alignmentTimeoutSeconds", 1L);

        try (CourseMapScanWatcher.ScanScope ignored = watcher.watch("chicago-marathon", "upload")) {
            assertThatThrownBy(() -> client.analyzeCandidate(new byte[] {1, 2, 3, 4}, "image/png", "prompt text"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("timed out");

            assertThat(watcher.currentSteps())
                    .extracting(CourseMapScanStep::stage)
                    .contains("qwen.process_started", "qwen.process_timed_out", "qwen.temp_files_deleted");
        }
    }

    @Test
    void analyzeCandidateRecordsJsonParseFailureStep() {
        CourseMapScanWatcher watcher = new CourseMapScanWatcher();
        RecordingQwenCourseMapAlignmentClient client = new RecordingQwenCourseMapAlignmentClient(
                new ObjectMapper(),
                watcher,
                new FakeProcess("not valid json at all", "", 0)
        );

        try (CourseMapScanWatcher.ScanScope ignored = watcher.watch("parse-failure-test", "reanalyze")) {
            assertThatThrownBy(() -> client.analyzeCandidate(new byte[] {1, 2, 3}, "image/png", "prompt"))
                    .isInstanceOf(IllegalStateException.class);

            assertThat(watcher.currentSteps())
                    .extracting(CourseMapScanStep::stage)
                    .contains("qwen.process_completed", "qwen.output_read_failed");
        }
    }

    @Test
    void analyzeCandidateDoesNotLeakStepsAcrossSeparateWatcherScopes() {
        CourseMapScanWatcher watcher = new CourseMapScanWatcher();

        try (CourseMapScanWatcher.ScanScope ignored = watcher.watch("first-race", "upload")) {
            watcher.record("test.first_step", "running", "first race");
        }

        try (CourseMapScanWatcher.ScanScope ignored = watcher.watch("second-race", "reanalyze")) {
            watcher.record("test.second_step", "running", "second race");
            assertThat(watcher.currentSteps())
                    .extracting(CourseMapScanStep::stage)
                    .containsExactly("watcher.started", "test.second_step");
        }

        assertThat(watcher.currentSteps()).isEmpty();
    }

    @Test
    void courseMapAlignmentDefaultsToLongVisionTimeout() {
        QwenCourseMapAlignmentClient client = new QwenCourseMapAlignmentClient(new ObjectMapper());

        Long timeoutSeconds = ReflectionTestUtils.invokeMethod(client, "resolveTimeoutSeconds");

        assertThat(timeoutSeconds).isEqualTo(720L);
    }

    private static final class RecordingQwenCourseMapAlignmentClient extends QwenCourseMapAlignmentClient {
        private final Process process;
        private List<String> command;

        private RecordingQwenCourseMapAlignmentClient(ObjectMapper objectMapper, Process process) {
            super(objectMapper);
            this.process = process;
        }

        private RecordingQwenCourseMapAlignmentClient(ObjectMapper objectMapper, CourseMapScanWatcher watcher, Process process) {
            super(objectMapper, watcher);
            this.process = process;
        }

        @Override
        protected Process startPythonProcess(List<String> command) throws IOException {
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

    private static final class TimeoutProcess extends Process {
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
        }

        @Override
        public Process destroyForcibly() {
            return this;
        }

        @Override
        public boolean isAlive() {
            return true;
        }
    }
}
