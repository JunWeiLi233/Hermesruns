package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.locks.LockSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class QwenPersistentWorkerClientTests {

    @Test
    void invokeJsonStartsStdioWorkerAndReturnsPayload() {
        ScriptedWorkerProcess process = new ScriptedWorkerProcess(List.of("""
                {"ok":true,"payload":{"routeHexColor":"#112233","anchorPoints":["A","B","C","D"]}}
                """));
        RecordingQwenPersistentWorkerClient client = new RecordingQwenPersistentWorkerClient(new ObjectMapper(), process);
        ReflectionTestUtils.setField(client, "pythonExecutable", "python-custom");
        ReflectionTestUtils.setField(client, "pythonScriptPath", "backend/src/main/resources/python/qwen_course_map_worker.py");

        String json = client.invokeJson(
                QwenPersistentWorkerClient.WorkerRequest.routeParameters(
                        "course.png",
                        "Boston Marathon",
                        "Boston",
                        "United States",
                        42.195,
                        "Qwen/Qwen2.5-VL-7B-Instruct",
                        "auto",
                        null
                ),
                Duration.ofSeconds(1)
        );

        assertThat(client.command()).containsExactly(
                "python-custom",
                "backend/src/main/resources/python/qwen_course_map_worker.py",
                "--stdio-worker"
        );
        assertThat(json).contains("\"routeHexColor\":\"#112233\"");
        assertThat(process.requests()).hasSize(1);
        assertThat(process.requests().get(0)).contains("\"operation\":\"route_parameters\"");
        assertThat(process.requests().get(0)).contains("\"raceName\":\"Boston Marathon\"");

        client.shutdown();
    }

    @Test
    void invokeJsonReusesOneWarmWorkerAcrossRequests() {
        ScriptedWorkerProcess process = new ScriptedWorkerProcess(List.of(
                "{\"ok\":true,\"payload\":{\"routeHexColor\":\"#112233\",\"anchorPoints\":[\"A\",\"B\",\"C\",\"D\"]}}",
                "{\"ok\":true,\"payload\":{\"anchors\":[{\"label\":\"A\",\"x\":1,\"y\":2},{\"label\":\"B\",\"x\":3,\"y\":4},{\"label\":\"C\",\"x\":5,\"y\":6},{\"label\":\"D\",\"x\":7,\"y\":8}]}}"
        ));
        RecordingQwenPersistentWorkerClient client = new RecordingQwenPersistentWorkerClient(new ObjectMapper(), process);
        ReflectionTestUtils.setField(client, "pythonExecutable", "python-custom");
        ReflectionTestUtils.setField(client, "pythonScriptPath", "backend/src/main/resources/python/qwen_course_map_worker.py");

        client.invokeJson(
                QwenPersistentWorkerClient.WorkerRequest.routeParameters(
                        "course.png", "Race", "City", "Country", 42.195, "model", "auto", null),
                Duration.ofSeconds(1)
        );
        client.invokeJson(
                QwenPersistentWorkerClient.WorkerRequest.anchorPixels(
                        "course.png", List.of("A", "B", "C", "D"), "model", "auto", null),
                Duration.ofSeconds(1)
        );

        assertThat(client.startCount()).isEqualTo(1);
        assertThat(process.requests()).hasSize(2);
        assertThat(process.requests().get(1)).contains("\"operation\":\"anchor_pixels\"");

        client.shutdown();
    }

    @Test
    void invokeJsonClosesWorkerAfterRequestWhenKeepAliveDisabled() {
        ScriptedWorkerProcess firstProcess = new ScriptedWorkerProcess(List.of(
                "{\"ok\":true,\"payload\":{\"routeHexColor\":\"#112233\",\"anchorPoints\":[\"A\",\"B\",\"C\",\"D\"]}}"
        ));
        ScriptedWorkerProcess secondProcess = new ScriptedWorkerProcess(List.of(
                "{\"ok\":true,\"payload\":{\"anchors\":[{\"label\":\"A\",\"x\":1,\"y\":2},{\"label\":\"B\",\"x\":3,\"y\":4},{\"label\":\"C\",\"x\":5,\"y\":6},{\"label\":\"D\",\"x\":7,\"y\":8}]}}"
        ));
        RecordingQwenPersistentWorkerClient client = new RecordingQwenPersistentWorkerClient(
                new ObjectMapper(),
                List.of(firstProcess, secondProcess)
        );
        ReflectionTestUtils.setField(client, "keepAlive", false);

        client.invokeJson(
                QwenPersistentWorkerClient.WorkerRequest.routeParameters(
                        "course.png", "Race", "City", "Country", 42.195, "model", "auto", null),
                Duration.ofSeconds(1)
        );
        client.invokeJson(
                QwenPersistentWorkerClient.WorkerRequest.anchorPixels(
                        "course.png", List.of("A", "B", "C", "D"), "model", "auto", null),
                Duration.ofSeconds(1)
        );

        assertThat(client.startCount()).isEqualTo(2);
        assertThat(firstProcess.isAlive()).isFalse();
        assertThat(secondProcess.isAlive()).isFalse();
        assertThat(firstProcess.requests()).hasSize(1);
        assertThat(secondProcess.requests()).hasSize(1);

        client.shutdown();
    }

    @Test
    void invokeJsonPropagatesWorkerModelError() {
        ScriptedWorkerProcess process = new ScriptedWorkerProcess(List.of("""
                {"ok":false,"error":"Qwen model failed to load"}
                """));
        RecordingQwenPersistentWorkerClient client = new RecordingQwenPersistentWorkerClient(new ObjectMapper(), process);

        assertThatThrownBy(() -> client.invokeJson(
                QwenPersistentWorkerClient.WorkerRequest.alignment(
                        "course.png", "prompt", "model", "auto", null, 1024),
                Duration.ofSeconds(1)
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Qwen model failed to load");

        client.shutdown();
    }

    @Test
    void invokeJsonRecoversAfterTimedOutWorkerLeavesReaderBlocked() {
        HangingWorkerProcess hangingProcess = new HangingWorkerProcess();
        ScriptedWorkerProcess recoveredProcess = new ScriptedWorkerProcess(List.of("""
                {"ok":true,"payload":{"routeHexColor":"#445566","anchorPoints":["A","B","C","D"]}}
                """));
        RecordingQwenPersistentWorkerClient client = new RecordingQwenPersistentWorkerClient(
                new ObjectMapper(),
                List.of(hangingProcess, recoveredProcess)
        );

        assertThatThrownBy(() -> client.invokeJson(
                QwenPersistentWorkerClient.WorkerRequest.alignment(
                        "course.png", "prompt", "model", "auto", null, 1024),
                Duration.ofMillis(50)
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("timed out");

        String json = client.invokeJson(
                QwenPersistentWorkerClient.WorkerRequest.routeParameters(
                        "course.png", "Race", "City", "Country", 42.195, "model", "auto", null),
                Duration.ofSeconds(1)
        );

        assertThat(client.startCount()).isEqualTo(2);
        assertThat(json).contains("\"routeHexColor\":\"#445566\"");
        assertThat(recoveredProcess.requests()).hasSize(1);

        client.shutdown();
    }

    private static final class RecordingQwenPersistentWorkerClient extends QwenPersistentWorkerClient {
        private final Queue<Process> processes;
        private List<String> command;
        private int startCount;

        private RecordingQwenPersistentWorkerClient(ObjectMapper objectMapper, Process process) {
            this(objectMapper, List.of(process));
        }

        private RecordingQwenPersistentWorkerClient(ObjectMapper objectMapper, List<Process> processes) {
            super(objectMapper);
            this.processes = new ArrayDeque<>(processes);
        }

        @Override
        protected Process startWorkerProcess(List<String> command) {
            this.command = List.copyOf(command);
            this.startCount++;
            return processes.remove();
        }

        private List<String> command() {
            return command;
        }

        private int startCount() {
            return startCount;
        }
    }

    private static final class ScriptedWorkerProcess extends Process {
        private final PipedInputStream processStdout = new PipedInputStream();
        private final PipedOutputStream workerStdout;
        private final PipedInputStream workerStdin = new PipedInputStream();
        private final PipedOutputStream processStdin;
        private final Queue<String> responses;
        private final List<String> requests = new ArrayList<>();
        private final Thread workerThread;
        private volatile boolean alive = true;

        private ScriptedWorkerProcess(List<String> responses) {
            try {
                this.workerStdout = new PipedOutputStream(processStdout);
                this.processStdin = new PipedOutputStream(workerStdin);
            } catch (IOException ex) {
                throw new IllegalStateException(ex);
            }
            this.responses = new ArrayDeque<>(responses);
            this.workerThread = new Thread(this::runWorker, "scripted-qwen-worker");
            this.workerThread.setDaemon(true);
            this.workerThread.start();
        }

        private void runWorker() {
            try (
                    BufferedReader reader = new BufferedReader(new InputStreamReader(workerStdin, StandardCharsets.UTF_8));
                    BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(workerStdout, StandardCharsets.UTF_8))
            ) {
                String line;
                while ((line = reader.readLine()) != null) {
                    requests.add(line);
                    writer.write(responses.isEmpty()
                            ? "{\"ok\":false,\"error\":\"missing scripted response\"}"
                            : responses.remove().trim());
                    writer.newLine();
                    writer.flush();
                }
            } catch (IOException ignored) {
            } finally {
                alive = false;
            }
        }

        private List<String> requests() {
            return List.copyOf(requests);
        }

        @Override
        public OutputStream getOutputStream() {
            return processStdin;
        }

        @Override
        public InputStream getInputStream() {
            return processStdout;
        }

        @Override
        public InputStream getErrorStream() {
            return new ByteArrayInputStream(new byte[0]);
        }

        @Override
        public int waitFor() {
            alive = false;
            return 0;
        }

        @Override
        public int exitValue() {
            return 0;
        }

        @Override
        public void destroy() {
            destroyForcibly();
        }

        @Override
        public Process destroyForcibly() {
            alive = false;
            closeQuietly(processStdin);
            closeQuietly(workerStdin);
            closeQuietly(workerStdout);
            closeQuietly(processStdout);
            return this;
        }

        @Override
        public boolean isAlive() {
            return alive;
        }

        private void closeQuietly(AutoCloseable closeable) {
            try {
                closeable.close();
            } catch (Exception ignored) {
            }
        }
    }

    private static final class HangingWorkerProcess extends Process {
        private final InputStream blockingStdout = new SlowUninterruptibleInputStream();
        private volatile boolean alive = true;

        @Override
        public OutputStream getOutputStream() {
            return OutputStream.nullOutputStream();
        }

        @Override
        public InputStream getInputStream() {
            return blockingStdout;
        }

        @Override
        public InputStream getErrorStream() {
            return new SlowUninterruptibleInputStream();
        }

        @Override
        public int waitFor() {
            alive = false;
            return 0;
        }

        @Override
        public int exitValue() {
            return 0;
        }

        @Override
        public void destroy() {
            destroyForcibly();
        }

        @Override
        public Process destroyForcibly() {
            alive = false;
            return this;
        }

        @Override
        public boolean isAlive() {
            return alive;
        }
    }

    private static final class SlowUninterruptibleInputStream extends InputStream {
        @Override
        public int read() {
            long deadline = System.nanoTime() + 2_000_000_000L;
            while (System.nanoTime() < deadline) {
                LockSupport.parkNanos(Math.max(1L, deadline - System.nanoTime()));
                Thread.interrupted();
            }
            return -1;
        }
    }
}
