package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class QwenCourseMapAlignmentClient {
    private final ObjectMapper objectMapper;
    private final CourseMapScanWatcher scanWatcher;
    private final QwenPersistentWorkerClient persistentWorkerClient;

    @Value("${app.route-extraction.python-command:}")
    private String pythonExecutable;

    @Value("${app.route-extraction.qwen.alignment-script:}")
    private String pythonScriptPath;

    @Value("${app.route-extraction.qwen.model-id:Qwen/Qwen2.5-VL-7B-Instruct}")
    private String modelId;

    @Value("${app.route-extraction.qwen.device-map:auto}")
    private String deviceMap;

    @Value("${app.route-extraction.qwen.cache-dir:}")
    private String cacheDir;

    @Value("${app.route-extraction.qwen.alignment-timeout-seconds:720}")
    private long alignmentTimeoutSeconds;

    @Value("${app.route-extraction.qwen.persistent-worker.enabled:true}")
    private boolean persistentWorkerEnabled;

    private PythonVenvResolver venvResolver;

    public QwenCourseMapAlignmentClient(ObjectMapper objectMapper) {
        this(objectMapper, new CourseMapScanWatcher(), null);
    }

    @PostConstruct
    private void initVenvResolver() {
        this.venvResolver = new PythonVenvResolver(pythonExecutable, pythonScriptPath);
    }

    @Autowired
    public QwenCourseMapAlignmentClient(
            ObjectMapper objectMapper,
            CourseMapScanWatcher scanWatcher,
            QwenPersistentWorkerClient persistentWorkerClient
    ) {
        this.objectMapper = objectMapper;
        this.scanWatcher = scanWatcher;
        this.persistentWorkerClient = persistentWorkerClient;
    }

    public QwenCourseMapAlignmentClient(ObjectMapper objectMapper, CourseMapScanWatcher scanWatcher) {
        this(objectMapper, scanWatcher, null);
    }

    public String analyzeCandidate(byte[] imageBytes, String mediaType, String prompt) {
        scanWatcher.beginStep("qwen.input_validate", "Validating Qwen alignment inputs.");
        if (imageBytes == null || imageBytes.length == 0) {
            scanWatcher.completeStep("qwen.input_validate", "FAILED", "Course-map image bytes are required.");
            throw new IllegalArgumentException("Course-map image bytes are required.");
        }
        if (prompt == null || prompt.isBlank()) {
            scanWatcher.completeStep("qwen.input_validate", "FAILED", "Course-map alignment prompt is required.");
            throw new IllegalArgumentException("Course-map alignment prompt is required.");
        }
        scanWatcher.completeStep("qwen.input_validate", "SUCCESS", "Qwen alignment input validated.", Map.of(
                "mediaType", mediaType == null ? "" : mediaType,
                "imageBytes", imageBytes.length,
                "instructionChars", prompt.length()
        ));
        scanWatcher.record("qwen.input_validated", "SUCCESS", "Qwen alignment input validated.", Map.of(
                "mediaType", mediaType == null ? "" : mediaType,
                "imageBytes", imageBytes.length,
                "instructionChars", prompt.length()
        ));

        String suffix = mediaTypeToSuffix(mediaType);
        Path tempImage = null;
        Path promptFile = null;
        try {
            scanWatcher.beginStep("qwen.temp_files", "Writing temporary Qwen scan files.");
            tempImage = Files.createTempFile("hermes-course-map-", suffix);
            Files.write(tempImage, imageBytes);
            scanWatcher.completeStep("qwen.temp_files", "SUCCESS", "Temporary course-map image written for Qwen.", Map.of(
                    "suffix", suffix,
                    "imageBytes", imageBytes.length
            ));
            scanWatcher.record("qwen.temp_image_written", "SUCCESS", "Temporary course-map image written for Qwen.", Map.of(
                    "suffix", suffix,
                    "imageBytes", imageBytes.length
            ));
            if (shouldUsePersistentWorker()) {
                scanWatcher.beginStep("qwen.persistent_worker", "Sending request to warm Qwen persistent worker.");
                try {
                    scanWatcher.record("qwen.persistent_worker_starting", "RUNNING", "Sending course-map alignment request to the warm Qwen worker.", Map.of(
                            "timeoutSeconds", resolveTimeoutSeconds(),
                            "modelId", resolveModelId(),
                            "deviceMap", resolveDeviceMap()
                    ));
                    String persistentOutput = persistentWorkerClient.invokeJson(
                            QwenPersistentWorkerClient.WorkerRequest.alignment(
                                    tempImage.toAbsolutePath().toString(),
                                    prompt,
                                    resolveModelId(),
                                    resolveDeviceMap(),
                                    cacheDir,
                                    2048
                            ),
                            Duration.ofSeconds(resolveTimeoutSeconds())
                    );
                    scanWatcher.record("qwen.persistent_worker_completed", "SUCCESS", "Warm Qwen worker returned course-map alignment JSON.", Map.of(
                            "stdoutChars", persistentOutput.length()
                    ));
                    if (persistentOutput.isBlank()) {
                        scanWatcher.completeStep("qwen.persistent_worker", "FAILED", "Qwen worker produced no stdout JSON.");
                        scanWatcher.record("qwen.stdout_empty", "FAILED", "Qwen worker produced no stdout JSON.");
                        throw new IllegalStateException("Qwen course-map alignment produced no stdout JSON.");
                    }
                    scanWatcher.beginStep("qwen.normalize_output", "Normalizing Qwen stdout JSON.");
                    String normalized = normalizeJson(persistentOutput);
                    scanWatcher.completeStep("qwen.normalize_output", "SUCCESS", "Qwen stdout JSON parsed and normalized.", Map.of(
                            "jsonChars", normalized.length()
                    ));
                    scanWatcher.completeStep("qwen.persistent_worker", "SUCCESS", "Warm Qwen worker completed successfully.");
                    scanWatcher.record("qwen.stdout_normalized", "SUCCESS", "Qwen stdout JSON parsed and normalized.", Map.of(
                            "jsonChars", normalized.length()
                    ));
                    return normalized;
                } catch (QwenPersistentWorkerClient.WorkerUnavailableException ex) {
                    scanWatcher.completeStep("qwen.persistent_worker", "FAILED", "Warm Qwen worker was unavailable; falling back to one-shot Qwen process.", Map.of(
                            "error", safeExceptionMessage(ex)
                    ));
                    scanWatcher.record("qwen.persistent_worker_unavailable", "FAILED", "Warm Qwen worker was unavailable; falling back to one-shot Qwen process.", Map.of(
                            "error", safeExceptionMessage(ex)
                    ));
                }
            }
            promptFile = Files.createTempFile("hermes-course-map-prompt-", ".txt");
            Files.writeString(promptFile, prompt, StandardCharsets.UTF_8);
            scanWatcher.record("qwen.prompt_file_written", "SUCCESS", "Qwen prompt file written.", Map.of(
                    "instructionChars", prompt.length()
            ));

            scanWatcher.beginStep("qwen.process_run", "Starting one-shot Qwen course-map alignment process.");
            List<String> command = buildPythonCommand(tempImage, promptFile);
            scanWatcher.record("qwen.process_starting", "RUNNING", "Starting Qwen course-map alignment worker.", Map.of(
                    "commandParts", command.size(),
                    "timeoutSeconds", resolveTimeoutSeconds(),
                    "modelId", resolveModelId(),
                    "deviceMap", resolveDeviceMap()
            ));
            Process process;
            try {
                process = startPythonProcess(command);
                scanWatcher.record("qwen.process_started", "RUNNING", "Qwen worker process started.", Map.of(
                        "pid", safeProcessId(process)
                ));
            } catch (IOException e) {
                scanWatcher.completeStep("qwen.process_run", "FAILED", "Failed to start Qwen worker process.", Map.of(
                        "error", safeExceptionMessage(e)
                ));
                scanWatcher.record("qwen.process_start_failed", "FAILED", "Failed to start Qwen worker process.", Map.of(
                        "error", safeExceptionMessage(e)
                ));
                throw new IllegalStateException("Failed to start Qwen course-map alignment.", e);
            }

            QwenProcessResult output = QwenProcessRunner.collect(
                    process,
                    Duration.ofSeconds(resolveTimeoutSeconds()),
                    "Qwen course-map alignment"
            );
            scanWatcher.record("qwen.process_completed", output.exitCode() == 0 ? "SUCCESS" : "FAILED", "Qwen worker process completed.", Map.of(
                    "exitCode", output.exitCode(),
                    "stdoutChars", output.stdout() == null ? 0 : output.stdout().length(),
                    "stderrChars", output.stderr() == null ? 0 : output.stderr().length()
            ));
            if (output.exitCode() != 0) {
                scanWatcher.completeStep("qwen.process_run", "FAILED", "Qwen worker process exited with code " + output.exitCode() + ".", Map.of(
                        "exitCode", output.exitCode()
                ));
                throw new IllegalStateException(output.stderr().isBlank()
                        ? "Qwen course-map alignment failed with exit code " + output.exitCode() + "."
                        : output.stderr());
            }
            if (output.stdout().isBlank()) {
                scanWatcher.completeStep("qwen.process_run", "FAILED", "Qwen worker produced no stdout JSON.");
                scanWatcher.record("qwen.stdout_empty", "FAILED", "Qwen worker produced no stdout JSON.");
                throw new IllegalStateException("Qwen course-map alignment produced no stdout JSON.");
            }
            scanWatcher.beginStep("qwen.normalize_output", "Normalizing Qwen stdout JSON.");
            String normalized = normalizeJson(output.stdout());
            scanWatcher.completeStep("qwen.normalize_output", "SUCCESS", "Qwen stdout JSON parsed and normalized.", Map.of(
                    "jsonChars", normalized.length()
            ));
            scanWatcher.completeStep("qwen.process_run", "SUCCESS", "Qwen worker process completed successfully.", Map.of(
                    "exitCode", output.exitCode()
            ));
            scanWatcher.record("qwen.stdout_normalized", "SUCCESS", "Qwen stdout JSON parsed and normalized.", Map.of(
                    "jsonChars", normalized.length()
            ));
            return normalized;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            scanWatcher.completeStep("qwen.process_run", "FAILED", "Qwen course-map alignment was interrupted.", Map.of(
                    "error", safeExceptionMessage(e)
            ));
            scanWatcher.record("qwen.interrupted", "FAILED", "Qwen course-map alignment was interrupted.", Map.of(
                    "error", safeExceptionMessage(e)
            ));
            throw new IllegalStateException("Qwen course-map alignment was interrupted.", e);
        } catch (IOException e) {
            scanWatcher.record("qwen.output_read_failed", "FAILED", "Failed to read or normalize Qwen course-map output.", Map.of(
                    "error", safeExceptionMessage(e)
            ));
            throw new IllegalStateException("Failed to read Qwen course-map alignment output.", e);
        } catch (RuntimeException e) {
            String message = safeExceptionMessage(e);
            if (message.toLowerCase(Locale.ROOT).contains("timed out")) {
                scanWatcher.completeStep("qwen.process_run", "FAILED", "Qwen course-map alignment timed out before producing JSON.", Map.of(
                        "timeoutSeconds", resolveTimeoutSeconds(),
                        "error", message
                ));
                scanWatcher.record("qwen.process_timed_out", "FAILED", "Qwen course-map alignment timed out before producing JSON.", Map.of(
                        "timeoutSeconds", resolveTimeoutSeconds(),
                        "error", message
                ));
            } else {
                scanWatcher.record("qwen.process_failed", "FAILED", "Qwen course-map alignment failed before a usable result was produced.", Map.of(
                        "error", message
                ));
            }
            throw e;
        } finally {
            deleteQuietly(promptFile);
            deleteQuietly(tempImage);
            scanWatcher.record("qwen.temp_files_deleted", "SUCCESS", "Temporary Qwen scan files cleaned up.");
        }
    }

    protected Process startPythonProcess(List<String> command) throws IOException {
        ProcessBuilder processBuilder = new ProcessBuilder(command);
        processBuilder.redirectErrorStream(false);
        processBuilder.environment().put("PYTHONIOENCODING", "utf-8");
        return processBuilder.start();
    }

    private List<String> buildPythonCommand(Path imagePath, Path promptFile) {
        List<String> command = new ArrayList<>();
        command.add(resolveVenvResolver().resolvePythonCommand("analyze_course_map_alignment_qwen.py"));
        command.add(resolvePythonScriptPath());
        command.add("--image");
        command.add(imagePath.toAbsolutePath().toString());
        command.add("--prompt-file");
        command.add(promptFile.toAbsolutePath().toString());
        command.add("--model-id");
        command.add(resolveModelId());
        command.add("--device-map");
        command.add(resolveDeviceMap());
        if (cacheDir != null && !cacheDir.isBlank()) {
            command.add("--cache-dir");
            command.add(cacheDir.trim());
        }
        return List.copyOf(command);
    }

    private String normalizeJson(String stdout) throws IOException {
        return objectMapper.writeValueAsString(objectMapper.readTree(stdout));
    }

    private String resolvePythonScriptPath() {
        if (pythonScriptPath != null && !pythonScriptPath.isBlank()) {
            return pythonScriptPath.trim();
        }
        List<Path> candidates = List.of(
                Path.of("src", "main", "resources", "python", "analyze_course_map_alignment_qwen.py"),
                Path.of("backend", "src", "main", "resources", "python", "analyze_course_map_alignment_qwen.py"),
                Path.of("target", "classes", "python", "analyze_course_map_alignment_qwen.py"),
                Path.of("backend", "target", "classes", "python", "analyze_course_map_alignment_qwen.py")
        );
        for (Path candidate : candidates) {
            if (Files.exists(candidate)) {
                return candidate.toAbsolutePath().toString();
            }
        }
        return candidates.get(0).toString();
    }

    private String resolveModelId() {
        return modelId == null || modelId.isBlank() ? "Qwen/Qwen2.5-VL-7B-Instruct" : modelId.trim();
    }

    private String resolveDeviceMap() {
        return deviceMap == null || deviceMap.isBlank() ? "auto" : deviceMap.trim();
    }

    private long resolveTimeoutSeconds() {
        return alignmentTimeoutSeconds <= 0 ? 720 : alignmentTimeoutSeconds;
    }

    private PythonVenvResolver resolveVenvResolver() {
        if (venvResolver == null) {
            venvResolver = new PythonVenvResolver(pythonExecutable, pythonScriptPath);
        }
        return venvResolver;
    }

    private boolean shouldUsePersistentWorker() {
        return persistentWorkerEnabled && persistentWorkerClient != null;
    }

    private long safeProcessId(Process process) {
        try {
            return process.pid();
        } catch (Exception ignored) {
            return -1;
        }
    }

    private String safeExceptionMessage(Exception exception) {
        return exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage();
    }

    private String mediaTypeToSuffix(String mediaType) {
        if (mediaType == null) {
            return ".png";
        }
        return switch (mediaType.trim().toLowerCase()) {
            case "image/jpeg", "image/jpg" -> ".jpg";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            case "image/bmp" -> ".bmp";
            default -> ".png";
        };
    }

    private void deleteQuietly(Path path) {
        if (path == null) return;
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
        }
    }
}
