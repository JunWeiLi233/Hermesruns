package com.hermes.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class QwenRouteParameterClient {
    private static final int MIN_ANCHOR_POINTS = 4;
    private static final int MAX_ANCHOR_POINTS = 10;

    private final ObjectMapper objectMapper;
    private final QwenPersistentWorkerClient persistentWorkerClient;

    @Value("${app.route-extraction.python-command:}")
    private String pythonExecutable;

    @Value("${app.route-extraction.qwen.parameters-script:}")
    private String pythonScriptPath;

    @Value("${app.route-extraction.qwen.model-id:Qwen/Qwen2.5-VL-7B-Instruct}")
    private String modelId;

    @Value("${app.route-extraction.qwen.device-map:auto}")
    private String deviceMap;

    @Value("${app.route-extraction.qwen.cache-dir:}")
    private String cacheDir;

    @Value("${app.route-extraction.qwen.timeout-seconds:120}")
    private long timeoutSeconds;

    @Value("${app.route-extraction.qwen.persistent-worker.enabled:true}")
    private boolean persistentWorkerEnabled;

    private PythonVenvResolver venvResolver;

    public QwenRouteParameterClient(ObjectMapper objectMapper) {
        this(objectMapper, null);
    }

    @Autowired
    public QwenRouteParameterClient(ObjectMapper objectMapper, QwenPersistentWorkerClient persistentWorkerClient) {
        this.objectMapper = objectMapper;
        this.persistentWorkerClient = persistentWorkerClient;
    }

    @PostConstruct
    private void initVenvResolver() {
        this.venvResolver = new PythonVenvResolver(pythonExecutable, pythonScriptPath);
    }

    public RouteParametersDTO extractRouteParameters(String imageFilePath) {
        return extractRouteParameters(imageFilePath, null, null, null, null);
    }

    public RouteParametersDTO extractRouteParameters(
            String imageFilePath,
            String raceName,
            String city,
            String country,
            Double distanceKm
    ) {
        validateImageFile(imageFilePath);
        if (shouldUsePersistentWorker()) {
            try {
                String stdout = persistentWorkerClient.invokeJson(
                        QwenPersistentWorkerClient.WorkerRequest.routeParameters(
                                imageFilePath,
                                raceName,
                                city,
                                country,
                                distanceKm,
                                resolveModelId(),
                                resolveDeviceMap(),
                                cacheDir
                        ),
                        Duration.ofSeconds(resolveTimeoutSeconds())
                );
                return parseRouteParameters(stdout);
            } catch (QwenPersistentWorkerClient.WorkerUnavailableException ignored) {
                // Fall back to the previous one-shot script path when the warm worker cannot start.
            }
        }
        List<String> command = buildPythonCommand(imageFilePath, raceName, city, country, distanceKm);
        Process process;
        try {
            process = startPythonProcess(command);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to start Qwen route-parameter extraction.", e);
        }

        try {
            QwenProcessResult output = QwenProcessRunner.collect(
                    process,
                    Duration.ofSeconds(resolveTimeoutSeconds()),
                    "Qwen route-parameter extraction"
            );
            if (output.exitCode() != 0) {
                throw new IllegalStateException(output.stderr().isBlank()
                        ? "Qwen route-parameter extraction failed with exit code " + output.exitCode() + "."
                        : output.stderr());
            }
            if (output.stdout().isBlank()) {
                throw new IllegalStateException("Qwen route-parameter extraction produced no stdout JSON.");
            }
            return parseRouteParameters(output.stdout());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Qwen route-parameter extraction was interrupted.", e);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read Qwen route-parameter extraction output.", e);
        }
    }

    protected Process startPythonProcess(List<String> command) throws IOException {
        ProcessBuilder processBuilder = new ProcessBuilder(command);
        processBuilder.redirectErrorStream(false);
        processBuilder.environment().put("PYTHONIOENCODING", "utf-8");
        return processBuilder.start();
    }

    RouteParametersDTO parseRouteParameters(String stdoutJson) {
        try {
            JsonNode root = objectMapper.readTree(stdoutJson);
            String routeHexColor = normalizeRouteHexColor(root.path("routeHexColor").asText(null));
            if (routeHexColor == null) {
                throw new IllegalStateException("Qwen route-parameter response must include routeHexColor in #RRGGBB form.");
            }

            JsonNode anchorPointsNode = root.path("anchorPoints");
            List<String> anchorPoints = new ArrayList<>(MAX_ANCHOR_POINTS);
            Set<String> seenAnchorKeys = new LinkedHashSet<>();
            if (anchorPointsNode.isArray()) {
                for (JsonNode anchorPointNode : anchorPointsNode) {
                    if (!anchorPointNode.isTextual()) {
                        continue;
                    }
                    String anchorPoint = anchorPointNode.asText().trim();
                    String anchorKey = anchorPoint.toLowerCase(Locale.ROOT);
                    if (!anchorPoint.isBlank() && seenAnchorKeys.add(anchorKey)) {
                        anchorPoints.add(anchorPoint);
                    }
                    if (anchorPoints.size() == MAX_ANCHOR_POINTS) {
                        break;
                    }
                }
            }
            if (anchorPoints.size() < MIN_ANCHOR_POINTS) {
                throw new IllegalStateException("Qwen route-parameter response must include at least 4 anchorPoints.");
            }
            return new RouteParametersDTO(routeHexColor, anchorPoints);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to parse Qwen route-parameter JSON.", e);
        }
    }

    private List<String> buildPythonCommand(
            String imageFilePath,
            String raceName,
            String city,
            String country,
            Double distanceKm
    ) {
        List<String> command = new ArrayList<>();
        command.add(resolveVenvResolver().resolvePythonCommand("extract_route_parameters_qwen.py"));
        command.add(resolvePythonScriptPath());
        command.add("--image");
        command.add(imageFilePath);
        addOptionalArgument(command, "--race-name", raceName);
        addOptionalArgument(command, "--city", city);
        addOptionalArgument(command, "--country", country);
        if (distanceKm != null) {
            command.add("--distance-km");
            command.add(formatDistanceKm(distanceKm));
        }
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

    private void addOptionalArgument(List<String> command, String flag, String value) {
        if (value != null && !value.isBlank()) {
            command.add(flag);
            command.add(value.trim());
        }
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

    private String resolvePythonScriptPath() {
        if (pythonScriptPath != null && !pythonScriptPath.isBlank()) {
            return pythonScriptPath.trim();
        }
        List<Path> candidates = List.of(
                Path.of("src", "main", "resources", "python", "extract_route_parameters_qwen.py"),
                Path.of("backend", "src", "main", "resources", "python", "extract_route_parameters_qwen.py"),
                Path.of("target", "classes", "python", "extract_route_parameters_qwen.py"),
                Path.of("backend", "target", "classes", "python", "extract_route_parameters_qwen.py")
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

    private PythonVenvResolver resolveVenvResolver() {
        if (venvResolver == null) {
            venvResolver = new PythonVenvResolver(pythonExecutable, pythonScriptPath);
        }
        return venvResolver;
    }

    private boolean shouldUsePersistentWorker() {
        return persistentWorkerEnabled && persistentWorkerClient != null;
    }

    private String normalizeRouteHexColor(String rawValue) {
        if (rawValue == null) {
            return null;
        }
        String trimmed = rawValue.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.startsWith("#")) {
            trimmed = trimmed.substring(1);
        }
        if (!trimmed.matches("[0-9a-fA-F]{6}")) {
            return null;
        }
        return "#" + trimmed.toUpperCase(Locale.ROOT);
    }

    private String formatDistanceKm(Double distanceKm) {
        return String.format(Locale.ROOT, "%.3f", distanceKm);
    }
}
