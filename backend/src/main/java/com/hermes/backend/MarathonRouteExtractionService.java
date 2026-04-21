package com.hermes.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

@Service
public class MarathonRouteExtractionService {
    private final GeminiRouteParameterClient geminiRouteParameterClient;
    private final ObjectMapper objectMapper;

    @Value("${app.route-extraction.python-command:python}")
    private String pythonExecutable;

    @Value("${app.route-extraction.python-script:}")
    private String pythonScriptPath;

    public MarathonRouteExtractionService(
            GeminiRouteParameterClient geminiRouteParameterClient,
            ObjectMapper objectMapper
    ) {
        this.geminiRouteParameterClient = geminiRouteParameterClient;
        this.objectMapper = objectMapper;
    }

    public RoutePathExtractionResultDTO extractRoutePath(String imageFilePathOrDataUrl) {
        if (imageFilePathOrDataUrl == null || imageFilePathOrDataUrl.isBlank()) {
            throw new IllegalArgumentException("Route image file path or data URL is required.");
        }

        String actualFilePath = imageFilePathOrDataUrl;
        boolean isTemporaryFile = false;

        if (imageFilePathOrDataUrl.startsWith("data:image/")) {
            try {
                actualFilePath = saveDataUrlToTempFile(imageFilePathOrDataUrl);
                isTemporaryFile = true;
            } catch (IOException e) {
                throw new IllegalStateException("Failed to save route image data URL to temporary file.", e);
            }
        }

        try {
            RouteParametersDTO routeParameters = geminiRouteParameterClient.extractRouteParameters(actualFilePath);
            List<String> command = buildPythonCommand(actualFilePath, routeParameters);

            Process process;
            try {
                process = startPythonProcess(command);
            } catch (IOException e) {
                throw new IllegalStateException("Failed to start Python route extraction.", e);
            }

            try {
                String stdout = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
                String stderr = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8).trim();
                int exitCode = process.waitFor();

                if (exitCode != 0) {
                    throw new IllegalStateException(stderr.isBlank()
                            ? "Python route extraction failed with exit code " + exitCode + "."
                            : stderr);
                }
                if (stdout.isBlank()) {
                    throw new IllegalStateException("Python route extraction produced no stdout JSON.");
                }

                return parseExtractionResult(routeParameters, stdout);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Python route extraction was interrupted.", e);
            } catch (IOException e) {
                throw new IllegalStateException("Failed to read Python route extraction output.", e);
            }
        } finally {
            if (isTemporaryFile) {
                try {
                    Files.deleteIfExists(Path.of(actualFilePath));
                } catch (IOException ignored) {
                }
            }
        }
    }

    private String saveDataUrlToTempFile(String dataUrl) throws IOException {
        int commaIndex = dataUrl.indexOf(',');
        if (commaIndex == -1) {
            throw new IllegalArgumentException("Invalid data URL format.");
        }
        String base64Data = dataUrl.substring(commaIndex + 1);
        byte[] decodedBytes = java.util.Base64.getDecoder().decode(base64Data);

        String extension = ".png";
        if (dataUrl.contains("image/jpeg") || dataUrl.contains("image/jpg")) extension = ".jpg";
        else if (dataUrl.contains("image/gif")) extension = ".gif";

        Path tempFile = Files.createTempFile("hermes-route-", extension);
        Files.write(tempFile, decodedBytes);
        return tempFile.toAbsolutePath().toString();
    }

    protected Process startPythonProcess(List<String> command) throws IOException {
        ProcessBuilder processBuilder = new ProcessBuilder(command);
        processBuilder.redirectErrorStream(false);
        processBuilder.environment().put("PYTHONIOENCODING", "utf-8");
        return processBuilder.start();
    }

    private List<String> buildPythonCommand(String imageFilePath, RouteParametersDTO routeParameters) {
        List<String> command = new ArrayList<>();
        command.add(resolvePythonExecutable());
        command.add(resolvePythonScriptPath());
        command.add("--image");
        command.add(imageFilePath);
        command.add("--route-hex-color");
        command.add(routeParameters.routeHexColor());
        return command;
    }

    private String resolvePythonExecutable() {
        if (pythonExecutable != null && !pythonExecutable.isBlank()) {
            return pythonExecutable.trim();
        }

        List<Path> candidates = List.of(
                Path.of(".venv", "Scripts", "python.exe"),
                Path.of(".venv", "bin", "python"),
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
                Path.of("src", "main", "resources", "python", "extract_route_path.py"),
                Path.of("backend", "src", "main", "resources", "python", "extract_route_path.py"),
                Path.of("target", "classes", "python", "extract_route_path.py"),
                Path.of("backend", "target", "classes", "python", "extract_route_path.py")
        );
        for (Path candidate : candidates) {
            if (Files.exists(candidate)) {
                return candidate.toAbsolutePath().toString();
            }
        }
        return candidates.get(0).toString();
    }

    private RoutePathExtractionResultDTO parseExtractionResult(RouteParametersDTO routeParameters, String stdoutJson) throws IOException {
        JsonNode root = objectMapper.readTree(stdoutJson);
        JsonNode pointsNode = root.path("points");
        if (!pointsNode.isArray()) {
            throw new IllegalStateException("Python route extraction JSON is missing points.");
        }

        List<RoutePixelPointDTO> points = new ArrayList<>();
        for (JsonNode pointNode : pointsNode) {
            if (!pointNode.isArray() || pointNode.size() != 2 || !pointNode.get(0).canConvertToInt() || !pointNode.get(1).canConvertToInt()) {
                throw new IllegalStateException("Python route extraction JSON contained an invalid point.");
            }
            points.add(new RoutePixelPointDTO(pointNode.get(0).intValue(), pointNode.get(1).intValue()));
        }

        int pointCount = root.path("pointCount").canConvertToInt() ? root.path("pointCount").intValue() : points.size();
        int maskPixelCount = root.path("maskPixelCount").canConvertToInt() ? root.path("maskPixelCount").intValue() : 0;
        int skeletonPixelCount = root.path("skeletonPixelCount").canConvertToInt() ? root.path("skeletonPixelCount").intValue() : 0;

        return new RoutePathExtractionResultDTO(
                routeParameters,
                points,
                pointCount,
                maskPixelCount,
                skeletonPixelCount
        );
    }
}
