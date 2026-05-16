package com.hermes.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Service
public class QwenPersistentWorkerClient {
    private final ObjectMapper objectMapper;
    private final Object workerLock = new Object();
    private ExecutorService responseReader = newWorkerIoExecutor("qwen-worker-response");
    private ExecutorService stderrDrainer = newWorkerIoExecutor("qwen-worker-stderr");

    @Value("${app.route-extraction.python-command:}")
    private String pythonExecutable;

    @Value("${app.route-extraction.qwen.worker-script:}")
    private String pythonScriptPath;

    @Value("${app.route-extraction.qwen.persistent-worker.keep-alive:true}")
    private boolean keepAlive = true;

    private PythonVenvResolver venvResolver;
    private Process process;
    private BufferedWriter stdin;
    private BufferedReader stdout;
    private final StringBuffer stderrBuffer = new StringBuffer();

    public QwenPersistentWorkerClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void initVenvResolver() {
        this.venvResolver = new PythonVenvResolver(pythonExecutable, pythonScriptPath);
    }

    public String invokeJson(WorkerRequest request, Duration timeout) {
        if (request == null) {
            throw new IllegalArgumentException("Qwen worker request is required.");
        }
        Duration safeTimeout = timeout == null || timeout.isNegative() || timeout.isZero()
                ? Duration.ofSeconds(120)
                : timeout;
        synchronized (workerLock) {
            ensureStarted();
            try {
                stdin.write(objectMapper.writeValueAsString(request.toMap()));
                stdin.newLine();
                stdin.flush();
                String responseLine = readResponseLine(safeTimeout);
                return parseResponse(responseLine);
            } catch (WorkerUnavailableException ex) {
                cleanupProcess();
                throw ex;
            } catch (IOException ex) {
                cleanupProcess();
                throw new WorkerUnavailableException("Persistent Qwen worker I/O failed.", ex);
            } finally {
                if (!keepAlive) {
                    cleanupProcess();
                }
            }
        }
    }

    private void ensureStarted() {
        if (process != null && process.isAlive() && stdin != null && stdout != null) {
            return;
        }
        cleanupProcess();
        if (venvResolver == null) {
            initVenvResolver();
        }
        List<String> command = buildWorkerCommand();
        try {
            process = startWorkerProcess(command);
            stdin = new BufferedWriter(new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8));
            stdout = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8));
            stderrBuffer.setLength(0);
            Process startedProcess = process;
            stderrDrainer.submit(() -> drainStderr(startedProcess.getErrorStream()));
        } catch (IOException ex) {
            cleanupProcess();
            throw new WorkerUnavailableException("Failed to start persistent Qwen worker.", ex);
        }
    }

    protected Process startWorkerProcess(List<String> command) throws IOException {
        ProcessBuilder processBuilder = new ProcessBuilder(command);
        processBuilder.redirectErrorStream(false);
        processBuilder.environment().put("PYTHONIOENCODING", "utf-8");
        return processBuilder.start();
    }

    private List<String> buildWorkerCommand() {
        return List.of(
                venvResolver.resolvePythonCommand("qwen_course_map_worker.py"),
                resolvePythonScriptPath(),
                "--stdio-worker"
        );
    }

    private String readResponseLine(Duration timeout) {
        BufferedReader responseStream = stdout;
        Future<String> response = responseReader.submit(responseStream::readLine);
        try {
            String line = response.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
            if (line == null) {
                throw new WorkerUnavailableException("Persistent Qwen worker exited without a response." + stderrSuffix());
            }
            return line;
        } catch (TimeoutException ex) {
            response.cancel(true);
            cleanupProcess();
            throw new IllegalStateException("Persistent Qwen worker timed out after " + timeout.toSeconds() + " seconds.");
        } catch (InterruptedException ex) {
            response.cancel(true);
            Thread.currentThread().interrupt();
            cleanupProcess();
            throw new IllegalStateException("Persistent Qwen worker was interrupted.", ex);
        } catch (ExecutionException ex) {
            cleanupProcess();
            throw new WorkerUnavailableException("Persistent Qwen worker response read failed." + stderrSuffix(), ex);
        }
    }

    private String parseResponse(String responseLine) {
        try {
            JsonNode root = objectMapper.readTree(responseLine);
            if (!root.path("ok").asBoolean(false)) {
                String error = root.path("error").asText("Persistent Qwen worker failed.");
                throw new IllegalStateException("Persistent Qwen worker failed: " + error);
            }
            JsonNode payload = root.get("payload");
            if (payload == null || payload.isNull()) {
                throw new WorkerUnavailableException("Persistent Qwen worker response did not include payload.");
            }
            return objectMapper.writeValueAsString(payload);
        } catch (WorkerUnavailableException | IllegalStateException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new WorkerUnavailableException("Persistent Qwen worker returned invalid protocol JSON.", ex);
        }
    }

    private void drainStderr(InputStream stderr) {
        try (InputStream stream = stderr) {
            byte[] buffer = new byte[1024];
            int read;
            while ((read = stream.read(buffer)) != -1) {
                if (read > 0) {
                    stderrBuffer.append(new String(buffer, 0, read, StandardCharsets.UTF_8));
                    if (stderrBuffer.length() > 2000) {
                        stderrBuffer.delete(0, stderrBuffer.length() - 2000);
                    }
                }
            }
        } catch (IOException ignored) {
        }
    }

    private String stderrSuffix() {
        String text = stderrBuffer.toString().trim();
        return text.isBlank() ? "" : " Last stderr: " + text;
    }

    private String resolvePythonScriptPath() {
        if (pythonScriptPath != null && !pythonScriptPath.isBlank()) {
            return pythonScriptPath.trim();
        }
        List<Path> candidates = List.of(
                Path.of("src", "main", "resources", "python", "qwen_course_map_worker.py"),
                Path.of("backend", "src", "main", "resources", "python", "qwen_course_map_worker.py"),
                Path.of("target", "classes", "python", "qwen_course_map_worker.py"),
                Path.of("backend", "target", "classes", "python", "qwen_course_map_worker.py")
        );
        for (Path candidate : candidates) {
            if (Files.exists(candidate)) {
                return candidate.toAbsolutePath().toString();
            }
        }
        return candidates.get(0).toString();
    }

    private void cleanupProcess() {
        closeQuietly(stdin);
        closeQuietly(stdout);
        stdin = null;
        stdout = null;
        if (process != null) {
            try {
                process.destroyForcibly();
            } catch (Exception ignored) {
            }
        }
        process = null;
        resetWorkerIoExecutors();
    }

    private void closeQuietly(AutoCloseable closeable) {
        if (closeable == null) return;
        try {
            closeable.close();
        } catch (Exception ignored) {
        }
    }

    @PreDestroy
    void shutdown() {
        synchronized (workerLock) {
            closeQuietly(stdin);
            closeQuietly(stdout);
            stdin = null;
            stdout = null;
            if (process != null) {
                try {
                    process.destroyForcibly();
                } catch (Exception ignored) {
                }
            }
            process = null;
        }
        responseReader.shutdownNow();
        stderrDrainer.shutdownNow();
    }

    private void resetWorkerIoExecutors() {
        responseReader.shutdownNow();
        stderrDrainer.shutdownNow();
        responseReader = newWorkerIoExecutor("qwen-worker-response");
        stderrDrainer = newWorkerIoExecutor("qwen-worker-stderr");
    }

    private static ExecutorService newWorkerIoExecutor(String name) {
        return Executors.newSingleThreadExecutor(daemonThreadFactory(name));
    }

    private static ThreadFactory daemonThreadFactory(String name) {
        return runnable -> {
            Thread thread = new Thread(runnable, name);
            thread.setDaemon(true);
            return thread;
        };
    }

    static final class WorkerUnavailableException extends RuntimeException {
        WorkerUnavailableException(String message) {
            super(message);
        }

        WorkerUnavailableException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public record WorkerRequest(
            String operation,
            String imagePath,
            String prompt,
            List<String> anchors,
            String raceName,
            String city,
            String country,
            Double distanceKm,
            String modelId,
            String deviceMap,
            String cacheDir,
            int maxNewTokens
    ) {
        public static WorkerRequest alignment(
                String imagePath,
                String prompt,
                String modelId,
                String deviceMap,
                String cacheDir,
                int maxNewTokens
        ) {
            return new WorkerRequest("alignment", imagePath, prompt, null, null, null, null, null,
                    modelId, deviceMap, cacheDir, maxNewTokens);
        }

        public static WorkerRequest routeParameters(
                String imagePath,
                String raceName,
                String city,
                String country,
                Double distanceKm,
                String modelId,
                String deviceMap,
                String cacheDir
        ) {
            return new WorkerRequest("route_parameters", imagePath, null, null, raceName, city, country, distanceKm,
                    modelId, deviceMap, cacheDir, 512);
        }

        public static WorkerRequest anchorPixels(
                String imagePath,
                List<String> anchors,
                String modelId,
                String deviceMap,
                String cacheDir
        ) {
            return new WorkerRequest("anchor_pixels", imagePath, null, anchors, null, null, null, null,
                    modelId, deviceMap, cacheDir, 256);
        }

        private Map<String, Object> toMap() {
            Map<String, Object> payload = new LinkedHashMap<>();
            put(payload, "operation", operation);
            put(payload, "imagePath", imagePath);
            put(payload, "prompt", prompt);
            put(payload, "anchors", anchors);
            put(payload, "raceName", raceName);
            put(payload, "city", city);
            put(payload, "country", country);
            put(payload, "distanceKm", distanceKm);
            put(payload, "modelId", modelId);
            put(payload, "deviceMap", deviceMap);
            put(payload, "cacheDir", cacheDir);
            payload.put("maxNewTokens", maxNewTokens);
            return payload;
        }

        private static void put(Map<String, Object> payload, String key, Object value) {
            if (value == null) return;
            if (value instanceof String text && text.isBlank()) return;
            payload.put(key, value);
        }
    }
}
