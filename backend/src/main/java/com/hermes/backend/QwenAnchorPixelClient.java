package com.hermes.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

@Service
public class QwenAnchorPixelClient {
    private final ObjectMapper objectMapper;

    @Value("${app.route-extraction.python-command:}")
    private String pythonExecutable;

    @Value("${app.route-extraction.qwen.anchor-script:}")
    private String pythonScriptPath;

    @Value("${app.route-extraction.qwen.model-id:Qwen/Qwen2.5-VL-7B-Instruct}")
    private String modelId;

    @Value("${app.route-extraction.qwen.device-map:auto}")
    private String deviceMap;

    @Value("${app.route-extraction.qwen.cache-dir:}")
    private String cacheDir;

    @Value("${app.route-extraction.qwen.timeout-seconds:120}")
    private long timeoutSeconds;

    private PythonVenvResolver venvResolver;

    public QwenAnchorPixelClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    private void initVenvResolver() {
        this.venvResolver = new PythonVenvResolver(pythonExecutable, pythonScriptPath);
    }

    public List<RouteAnchorPixelPointDTO> extractAnchorPixels(String imageReference, RouteParametersDTO routeParameters) {
        List<String> anchorLabels = extractAnchorLabels(routeParameters);
        String actualImagePath = imageReference;
        boolean isTemporaryFile = false;
        if (imageReference != null && imageReference.regionMatches(true, 0, "data:image/", 0, 11)) {
            try {
                actualImagePath = saveDataUrlToTempFile(imageReference);
                isTemporaryFile = true;
            } catch (IOException e) {
                throw new IllegalStateException("Failed to save route image data URL to temporary file.", e);
            }
        }
        validateImageFile(actualImagePath);

        try {
            List<String> command = buildPythonCommand(actualImagePath, anchorLabels);
            Process process;
            try {
                process = startPythonProcess(command);
            } catch (IOException e) {
                throw new IllegalStateException("Failed to start Qwen anchor-pixel extraction.", e);
            }

            try {
                QwenProcessResult output = QwenProcessRunner.collect(
                        process,
                        Duration.ofSeconds(resolveTimeoutSeconds()),
                        "Qwen anchor-pixel extraction"
                );
                if (output.exitCode() != 0) {
                    throw new IllegalStateException(output.stderr().isBlank()
                            ? "Qwen anchor-pixel extraction failed with exit code " + output.exitCode() + "."
                            : output.stderr());
                }
                if (output.stdout().isBlank()) {
                    throw new IllegalStateException("Qwen anchor-pixel extraction produced no stdout JSON.");
                }
                return parseAnchorPixels(output.stdout(), anchorLabels);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Qwen anchor-pixel extraction was interrupted.", e);
            } catch (IOException e) {
                throw new IllegalStateException("Failed to read Qwen anchor-pixel extraction output.", e);
            }
        } finally {
            if (isTemporaryFile) {
                try {
                    Files.deleteIfExists(Path.of(actualImagePath));
                } catch (IOException ignored) {
                }
            }
        }
    }

    protected Process startPythonProcess(List<String> command) throws IOException {
        ProcessBuilder processBuilder = new ProcessBuilder(command);
        processBuilder.redirectErrorStream(false);
        processBuilder.environment().put("PYTHONIOENCODING", "utf-8");
        return processBuilder.start();
    }

    List<RouteAnchorPixelPointDTO> parseAnchorPixels(String stdoutJson, List<String> expectedLabels) {
        try {
            JsonNode root = objectMapper.readTree(stdoutJson);
            JsonNode anchorsNode = root.path("anchors");
            if (!anchorsNode.isArray() || anchorsNode.size() != 4) {
                throw new IllegalStateException("Qwen anchor-pixel response must include anchors as exactly 4 objects.");
            }

            List<RouteAnchorPixelPointDTO> anchors = new ArrayList<>(4);
            for (int index = 0; index < anchorsNode.size(); index++) {
                JsonNode anchorNode = anchorsNode.get(index);
                String expectedLabel = expectedLabels.get(index);
                String label = anchorNode.path("label").asText("").trim();
                if (label.isBlank()) {
                    throw new IllegalStateException("Qwen anchor-pixel response contained a blank anchor label.");
                }
                if (!expectedLabel.equals(label)) {
                    throw new IllegalStateException("Qwen anchor-pixel response must preserve anchor label order.");
                }
                JsonNode xNode = anchorNode.path("x");
                JsonNode yNode = anchorNode.path("y");
                if (!xNode.isIntegralNumber() || !yNode.isIntegralNumber()) {
                    throw new IllegalStateException("Qwen anchor-pixel response must include integer x/y coordinates.");
                }
                anchors.add(new RouteAnchorPixelPointDTO(label, xNode.intValue(), yNode.intValue()));
            }
            return List.copyOf(anchors);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to parse Qwen anchor-pixel JSON.", e);
        }
    }

    private List<String> buildPythonCommand(String imageFilePath, List<String> anchorLabels) {
        List<String> command = new ArrayList<>();
        command.add(venvResolver.resolvePythonCommand("extract_anchor_pixels_qwen.py"));
        command.add(resolvePythonScriptPath());
        command.add("--image");
        command.add(imageFilePath);
        command.add("--model-id");
        command.add(resolveModelId());
        command.add("--device-map");
        command.add(resolveDeviceMap());
        if (cacheDir != null && !cacheDir.isBlank()) {
            command.add("--cache-dir");
            command.add(cacheDir.trim());
        }
        for (String anchorLabel : anchorLabels) {
            command.add("--anchor");
            command.add(anchorLabel);
        }
        return List.copyOf(command);
    }

    private List<String> extractAnchorLabels(RouteParametersDTO routeParameters) {
        if (routeParameters == null) {
            throw new IllegalArgumentException("Route parameters are required.");
        }
        List<String> anchorPoints = routeParameters.anchorPoints();
        if (anchorPoints == null || anchorPoints.size() != 4) {
            throw new IllegalArgumentException("Route parameters must include exactly 4 anchor labels.");
        }
        List<String> normalized = new ArrayList<>(4);
        for (String anchorPoint : anchorPoints) {
            String label = anchorPoint == null ? "" : anchorPoint.trim();
            if (label.isBlank()) {
                throw new IllegalArgumentException("Route parameters contained a blank anchor label.");
            }
            normalized.add(label);
        }
        return List.copyOf(normalized);
    }

    private void validateImageFile(String imageFilePath) {
        if (imageFilePath == null || imageFilePath.isBlank()) {
            throw new IllegalArgumentException("Route image file path is required.");
        }
        Path imagePath = Path.of(imageFilePath);
        if (!Files.isRegularFile(imagePath)) {
            throw new IllegalArgumentException("Route image file does not exist: " + imageFilePath);
        }
    }

    private String saveDataUrlToTempFile(String dataUrl) throws IOException {
        int commaIndex = dataUrl.indexOf(',');
        if (commaIndex == -1) {
            throw new IllegalArgumentException("Invalid data URL format.");
        }
        String base64Data = dataUrl.substring(commaIndex + 1);
        byte[] decodedBytes = Base64.getDecoder().decode(base64Data);

        String extension = ".png";
        if (dataUrl.contains("image/jpeg") || dataUrl.contains("image/jpg")) {
            extension = ".jpg";
        } else if (dataUrl.contains("image/gif")) {
            extension = ".gif";
        } else if (dataUrl.contains("image/webp")) {
            extension = ".webp";
        }

        Path tempFile = Files.createTempFile("hermes-qwen-anchor-", extension);
        Files.write(tempFile, decodedBytes);
        return tempFile.toAbsolutePath().toString();
    }

    private String resolvePythonScriptPath() {
        if (pythonScriptPath != null && !pythonScriptPath.isBlank()) {
            return pythonScriptPath.trim();
        }
        List<Path> candidates = List.of(
                Path.of("src", "main", "resources", "python", "extract_anchor_pixels_qwen.py"),
                Path.of("backend", "src", "main", "resources", "python", "extract_anchor_pixels_qwen.py"),
                Path.of("target", "classes", "python", "extract_anchor_pixels_qwen.py"),
                Path.of("backend", "target", "classes", "python", "extract_anchor_pixels_qwen.py")
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
        return timeoutSeconds <= 0 ? 120 : timeoutSeconds;
    }
}
