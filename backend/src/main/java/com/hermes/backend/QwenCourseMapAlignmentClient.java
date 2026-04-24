package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
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

    public QwenCourseMapAlignmentClient(ObjectMapper objectMapper) {
        this(objectMapper, new CourseMapScanWatcher());
    }

    @Autowired
    public QwenCourseMapAlignmentClient(ObjectMapper objectMapper, CourseMapScanWatcher scanWatcher) {
        this.objectMapper = objectMapper;
        this.scanWatcher = scanWatcher;
    }

    public String analyzeCandidate(byte[] imageBytes, String mediaType, String prompt) {
        if (imageBytes == null || imageBytes.length == 0) {
            throw new IllegalArgumentException("Course-map image bytes are required.");
        }
        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("Course-map alignment prompt is required.");
        }

        String suffix = mediaTypeToSuffix(mediaType);
        Path tempImage = null;
        Path promptFile = null;
        try {
            scanWatcher.record("qwen.input_validated", "completed", "Qwen alignment input validated.", Map.of(
                    "mediaType", mediaType == null ? "" : mediaType,
                    "imageBytes", imageBytes.length,
                    "instructionChars", prompt.length()
            ));
            tempImage = Files.createTempFile("hermes-course-map-", suffix);
            Files.write(tempImage, imageBytes);
            scanWatcher.record("qwen.temp_image_written", "completed", "Temporary course-map image written for Qwen.", Map.of(
                    "suffix", suffix,
                    "imageBytes", imageBytes.length
            ));
            promptFile = Files.createTempFile("hermes-course-map-prompt-", ".txt");
            Files.writeString(promptFile, prompt, StandardCharsets.UTF_8);
            scanWatcher.record("qwen.prompt_file_written", "completed", "Qwen prompt file written.", Map.of(
                    "instructionChars", prompt.length()
            ));

            List<String> command = buildPythonCommand(tempImage, promptFile);
            scanWatcher.record("qwen.process_starting", "running", "Starting Qwen course-map alignment worker.", Map.of(
                    "commandParts", command.size(),
                    "timeoutSeconds", resolveTimeoutSeconds(),
                    "modelId", resolveModelId(),
                    "deviceMap", resolveDeviceMap()
            ));
            Process process;
            try {
                process = startPythonProcess(command);
                scanWatcher.record("qwen.process_started", "running", "Qwen worker process started.", Map.of(
                        "pid", safeProcessId(process)
                ));
            } catch (IOException e) {
                scanWatcher.record("qwen.process_start_failed", "failed", "Failed to start Qwen worker process.", Map.of(
                        "error", safeExceptionMessage(e)
                ));
                throw new IllegalStateException("Failed to start Qwen course-map alignment.", e);
            }

            QwenProcessResult output = QwenProcessRunner.collect(
                    process,
                    Duration.ofSeconds(resolveTimeoutSeconds()),
                    "Qwen course-map alignment"
            );
            scanWatcher.record("qwen.process_completed", output.exitCode() == 0 ? "completed" : "failed", "Qwen worker process completed.", Map.of(
                    "exitCode", output.exitCode(),
                    "stdoutChars", output.stdout() == null ? 0 : output.stdout().length(),
                    "stderrChars", output.stderr() == null ? 0 : output.stderr().length()
            ));
            if (output.exitCode() != 0) {
                throw new IllegalStateException(output.stderr().isBlank()
                        ? "Qwen course-map alignment failed with exit code " + output.exitCode() + "."
                        : output.stderr());
            }
            if (output.stdout().isBlank()) {
                scanWatcher.record("qwen.stdout_empty", "failed", "Qwen worker produced no stdout JSON.");
                throw new IllegalStateException("Qwen course-map alignment produced no stdout JSON.");
            }
            String normalized = normalizeJson(output.stdout());
            scanWatcher.record("qwen.stdout_normalized", "completed", "Qwen stdout JSON parsed and normalized.", Map.of(
                    "jsonChars", normalized.length()
            ));
            return normalized;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            scanWatcher.record("qwen.interrupted", "failed", "Qwen course-map alignment was interrupted.", Map.of(
                    "error", safeExceptionMessage(e)
            ));
            throw new IllegalStateException("Qwen course-map alignment was interrupted.", e);
        } catch (IOException e) {
            scanWatcher.record("qwen.output_read_failed", "failed", "Failed to read or normalize Qwen course-map output.", Map.of(
                    "error", safeExceptionMessage(e)
            ));
            throw new IllegalStateException("Failed to read Qwen course-map alignment output.", e);
        } catch (RuntimeException e) {
            String message = safeExceptionMessage(e);
            if (message.toLowerCase(Locale.ROOT).contains("timed out")) {
                scanWatcher.record("qwen.process_timed_out", "failed", "Qwen course-map alignment timed out before producing JSON.", Map.of(
                        "timeoutSeconds", resolveTimeoutSeconds(),
                        "error", message
                ));
            } else {
                scanWatcher.record("qwen.process_failed", "failed", "Qwen course-map alignment failed before a usable result was produced.", Map.of(
                        "error", message
                ));
            }
            throw e;
        } finally {
            deleteQuietly(promptFile);
            deleteQuietly(tempImage);
            scanWatcher.record("qwen.temp_files_deleted", "completed", "Temporary Qwen scan files cleaned up.");
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
        command.add(resolvePythonExecutable());
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

    private String resolvePythonExecutable() {
        if (pythonExecutable != null && !pythonExecutable.isBlank() && !"python".equalsIgnoreCase(pythonExecutable.trim())) {
            return pythonExecutable.trim();
        }

        Path workingDirectory = Path.of("").toAbsolutePath().normalize();
        Path parentDirectory = workingDirectory.getParent();
        List<Path> candidates = List.of(
                Path.of(".venv", "Scripts", "python.exe"),
                Path.of(".venv", "bin", "python"),
                parentDirectory == null ? Path.of("_missing_parent_python_") : parentDirectory.resolve(Path.of(".venv", "Scripts", "python.exe")),
                parentDirectory == null ? Path.of("_missing_parent_python_bin_") : parentDirectory.resolve(Path.of(".venv", "bin", "python")),
                Path.of("backend", ".venv", "Scripts", "python.exe"),
                Path.of("backend", ".venv", "bin", "python")
        );
        for (Path candidate : candidates) {
            if (Files.exists(candidate)) {
                return candidate.toAbsolutePath().toString();
            }
        }
        return "python";
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
