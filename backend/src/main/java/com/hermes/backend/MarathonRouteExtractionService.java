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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MarathonRouteExtractionService {
    private static final String ROUTE_EXTRACTION_SCRIPT = "extract_route_path.py";
    private static final int MAX_EXTRACTION_CACHE_ENTRIES = 512;
    private static final int MIN_USABLE_POINTS = 12;

    private final QwenRouteParameterClient qwenRouteParameterClient;
    private final ObjectMapper objectMapper;
    private final Map<String, RoutePathExtractionResultDTO> extractionCache = new ConcurrentHashMap<>();

    @Value("${app.route-extraction.python-command:}")
    private String pythonExecutable;

    @Value("${app.route-extraction.python-script:}")
    private String pythonScriptPath;

    @Value("${app.route-extraction.timeout-seconds:120}")
    private long extractionTimeoutSeconds;

    private PythonVenvResolver venvResolver;

    public MarathonRouteExtractionService(
            QwenRouteParameterClient qwenRouteParameterClient,
            ObjectMapper objectMapper
    ) {
        this.qwenRouteParameterClient = qwenRouteParameterClient;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    private void initVenvResolver() {
        this.venvResolver = new PythonVenvResolver(pythonExecutable, pythonScriptPath);
    }

    public RoutePathExtractionResultDTO extractRoutePath(String imageFilePathOrDataUrl) {
        return extractRoutePath(imageFilePathOrDataUrl, null, null, null, null);
    }

    public RoutePathExtractionResultDTO extractRoutePath(
            String imageFilePathOrDataUrl,
            String raceName,
            String city,
            String country,
            Double distanceKm
    ) {
        if (imageFilePathOrDataUrl == null || imageFilePathOrDataUrl.isBlank()) {
            throw new IllegalArgumentException("Route image file path or data URL is required.");
        }

        String cacheKey = buildExtractionCacheKey(imageFilePathOrDataUrl, raceName, city, country, distanceKm);
        RoutePathExtractionResultDTO cached = extractionCache.get(cacheKey);
        if (cached != null) {
            return cached;
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
            RouteExtractionPlan extractionPlan = resolveExtractionPlan(actualFilePath, raceName, city, country, distanceKm);
            RoutePathExtractionResultDTO result = executeExtractionPlan(actualFilePath, extractionPlan, raceName, city, country, distanceKm);

            // When a deterministic hardcoded plan produces too few usable route pixels,
            // fall back to Qwen-based parameter extraction for a second attempt.
            if (result.pointCount() < MIN_USABLE_POINTS && extractionPlan.isDeterministic()) {
                RouteParametersDTO qwenParameters = qwenRouteParameterClient.extractRouteParameters(
                        actualFilePath,
                        raceName,
                        city,
                        country,
                        distanceKm
                );
                if (qwenParameters != null) {
                    RouteExtractionPlan qwenPlan = new RouteExtractionPlan(qwenParameters, true, false);
                    try {
                        RoutePathExtractionResultDTO qwenResult = executeExtractionPlan(actualFilePath, qwenPlan, raceName, city, country, distanceKm);
                        if (qwenResult.pointCount() > result.pointCount()) {
                            cacheExtractionResult(cacheKey, qwenResult);
                            return qwenResult;
                        }
                    } catch (Exception ignored) {
                        // Keep the deterministic result if Qwen fallback fails entirely
                    }
                }
            }

            cacheExtractionResult(cacheKey, result);
            return result;
        } finally {
            if (isTemporaryFile) {
                try {
                    Files.deleteIfExists(Path.of(actualFilePath));
                } catch (IOException ignored) {
                }
            }
        }
    }

    private RoutePathExtractionResultDTO executeExtractionPlan(
            String actualFilePath,
            RouteExtractionPlan extractionPlan,
            String raceName,
            String city,
            String country,
            Double distanceKm
    ) {
        List<String> command = buildPythonCommand(actualFilePath, extractionPlan);

        Process process;
        try {
            process = startPythonProcess(command);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to start Python route extraction.", e);
        }

        try {
            QwenProcessResult output = QwenProcessRunner.collect(
                    process,
                    Duration.ofSeconds(resolveExtractionTimeoutSeconds()),
                    "Python route extraction"
            );

            if (output.exitCode() != 0) {
                throw new IllegalStateException(output.stderr().isBlank()
                        ? "Python route extraction failed with exit code " + output.exitCode() + "."
                        : output.stderr());
            }
            if (output.stdout().isBlank()) {
                throw new IllegalStateException("Python route extraction produced no stdout JSON.");
            }

            return parseExtractionResult(extractionPlan.routeParameters(), output.stdout());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Python route extraction was interrupted.", e);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read Python route extraction output.", e);
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

    private RouteExtractionPlan resolveExtractionPlan(
            String actualFilePath,
            String raceName,
            String city,
            String country,
            Double distanceKm
    ) {
        RouteExtractionPlan deterministicPlan = deterministicFastScanPlan(raceName, city, country);
        if (deterministicPlan != null) {
            return deterministicPlan;
        }

        RouteParametersDTO routeParameters = qwenRouteParameterClient.extractRouteParameters(
                actualFilePath,
                raceName,
                city,
                country,
                distanceKm
        );
        if (routeParameters == null) {
            throw new IllegalStateException("Qwen route-parameter extraction returned no route parameters.");
        }
        return new RouteExtractionPlan(routeParameters, true, false);
    }

    private RouteExtractionPlan deterministicFastScanPlan(String raceName, String city, String country) {
        String text = String.join(" ",
                safeLower(raceName),
                safeLower(city),
                safeLower(country)
        );

        if (text.contains("chicago")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#002068", List.of("Grant Park", "Magnificent Mile", "River North", "Lincoln Park")),
                    false,
                    true,
                    List.of("0.0,0.0,0.36,1.0", "0.78,0.0,1.0,0.18"),
                    true
            );
        }
        if (text.contains("new york")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#071B42", List.of("Start", "Brooklyn", "Queensboro Bridge", "Finish")),
                    true, true
            );
        }
        if (text.contains("osaka")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#2096D5", List.of("Osaka Castle Park", "Osaka City Hall", "Kyocera Dome Osaka", "Nakanoshima Park")),
                    true, true
            );
        }
        if (text.contains("tokyo")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#E50058", List.of("Start", "Asakusa", "Ginza", "Finish")),
                    true, true
            );
        }
        if (text.contains("athens")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#FC5200", List.of("Marathon", "Nea Makri", "Pikermi", "Finish")),
                    true, true
            );
        }
        if (text.contains("los angeles")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#E8545C", List.of("Dodger Stadium", "Hollywood", "Beverly Hills", "Finish")),
                    true, true
            );
        }
        if (text.contains("auckland")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#D61058", List.of("Devonport", "Takapuna", "St Heliers", "Finish")),
                    true, true
            );
        }
        if (text.contains("bangkok")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#C0D828", List.of("MBK Center", "Victory Monument", "Rama VIII Bridge", "Finish")),
                    true, true
            );
        }
        if (text.contains("buenos aires")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#C84A4A", List.of("Largada", "Ciudad Universitaria", "Obelisco", "Boca Juniors")),
                    true, true
            );
        }
        if (text.contains("cape town")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#FFD400", List.of("Beach Rd Start", "Salt River", "Rondebosch Common", "Sea Point")),
                    true, true
            );
        }
        if (text.contains("chengdu")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#B83840", List.of("Jinsha Site Museum", "Tianfu Square", "Sichuan University Museum", "Century City Finish")),
                    true,
                    true,
                    List.of("#B83840", "#185890"),
                    List.of(
                            "0.0,0.0,1.0,0.08",
                            "0.0,0.90,1.0,1.0",
                            "0.0,0.62,0.25,0.92",
                            "0.96,0.0,1.0,1.0",
                            "0.0,0.0,0.03,1.0"
                    )
            );
        }
        if (text.contains("dalian")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#FF0000", List.of("Start", "Xinghai Bay", "Zhongshan Road", "Finish")),
                    false,
                    true,
                    List.of(
                            "0.0,0.0,1.0,0.13",
                            "0.0,0.735,1.0,1.0",
                            "0.0,0.13,0.045,0.735",
                            "0.80,0.13,1.0,0.53",
                            "0.69,0.52,0.95,0.73",
                            "0.36,0.67,0.95,0.735"
                    ),
                    true
            );
        }
        if (text.contains("ho chi minh")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#212121", List.of("Le Duan Nguyen Binh Khiem", "Vo Van Kiet", "Tran Bach Dang", "Road No. 103 TML", "Empire City")),
                    true,
                    true,
                    List.of("#212121", "#000000"),
                    List.of(
                            "0.0,0.0,1.0,0.14",
                            "0.0,0.76,1.0,1.0"
                    )
            );
        }
        if (text.contains("hong kong")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#E0008A", List.of("Nathan Road Tsim Sha Tsui", "Tsing Ma Bridge", "Lai King", "Western Harbour Crossing", "Victoria Park Causeway Bay")),
                    true,
                    true,
                    List.of("#E0008A", "#D0007F", "#EC008C"),
                    List.of("0.64,0.0,1.0,0.18")
            );
        }
        if (text.contains("doha")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#FF0000", List.of("Hotel Park", "Al Bidda Park", "Doha Port", "Sheraton Grand Doha Resort")),
                    true,
                    true,
                    List.of(
                            "0.0,0.0,1.0,0.06",
                            "0.0,0.39,1.0,1.0",
                            "0.0,0.0,0.05,1.0",
                            "0.36,0.0,1.0,1.0"
                    ),
                    true
            );
        }
        if (text.contains("beijing")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#FF0000", List.of("Start", "CCTV Tower", "National Speed Skating Oval", "Finish")),
                    true, true
            );
        }
        if (text.contains("brussels")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#FF0000", List.of("Start", "Atomium", "Cinquantenaire Park", "Finish")),
                    false,
                    true,
                    List.of("0.70,0.02,1.0,0.25", "0.0,0.69,1.0,1.0")
            );
        }
        if (text.contains("boston")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#FDD835", List.of("Hopkinton", "Framingham", "Wellesley", "Finish")),
                    true, true
            );
        }
        if (text.contains("honolulu")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#FF0000", List.of("Ala Moana Beach Park", "Diamond Head", "Hawaii Kai", "Kapiolani Park")),
                    true, true
            );
        }
        if (text.contains("manchester")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#F5325F", List.of("Old Trafford", "Sale", "Altrincham", "Manchester City Centre")),
                    true, true
            );
        }
        if (text.contains("marine corps")) {
            return new RouteExtractionPlan(
                    new RouteParametersDTO("#FF0000", List.of("MCM START", "Georgetown", "National Mall", "MCM FINISH")),
                    true, true
            );
        }
        return null;
    }

    private List<String> buildPythonCommand(String imageFilePath, RouteExtractionPlan extractionPlan) {
        List<String> command = new ArrayList<>();
        command.add(resolveVenvResolver().resolvePythonCommand(ROUTE_EXTRACTION_SCRIPT));
        command.add(resolvePythonScriptPath());
        command.add("--image");
        command.add(imageFilePath);
        if (extractionPlan.includeRouteHexColor()) {
            for (String routeHexColor : extractionPlan.effectiveRouteHexColors()) {
                command.add("--route-hex-color");
                command.add(routeHexColor);
            }
        }
        for (String exclusionRegion : extractionPlan.exclusionRegions()) {
            command.add("--exclude-region");
            command.add(exclusionRegion);
        }
        if (extractionPlan.appendProminentBranch()) {
            command.add("--append-prominent-branch");
        }
        return command;
    }

    private PythonVenvResolver resolveVenvResolver() {
        if (venvResolver == null) {
            venvResolver = new PythonVenvResolver(pythonExecutable, pythonScriptPath);
        }
        return venvResolver;
    }

    private long resolveExtractionTimeoutSeconds() {
        return extractionTimeoutSeconds <= 0 ? 120 : extractionTimeoutSeconds;
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
        String outputRouteHexColor = normalizeRouteHexColor(root.path("routeHexColor").asText(null));
        String routeSource = root.path("routeSource").asText("");
        List<String> candidateErrors = new ArrayList<>();
        JsonNode candidateErrorsNode = root.path("candidateErrors");
        if (candidateErrorsNode.isArray()) {
            for (JsonNode errorNode : candidateErrorsNode) {
                if (errorNode.isTextual() && !errorNode.asText().isBlank()) {
                    candidateErrors.add(errorNode.asText());
                }
            }
        }
        RouteParametersDTO resolvedRouteParameters = outputRouteHexColor == null
                ? routeParameters
                : new RouteParametersDTO(outputRouteHexColor, routeParameters.anchorPoints());

        return new RoutePathExtractionResultDTO(
                resolvedRouteParameters,
                points,
                pointCount,
                maskPixelCount,
                skeletonPixelCount,
                routeSource,
                candidateErrors
        );
    }

    private String buildExtractionCacheKey(
            String imageFilePathOrDataUrl,
            String raceName,
            String city,
            String country,
            Double distanceKm
    ) {
        return String.join("|",
                imageFingerprint(imageFilePathOrDataUrl),
                normalizeCachePart(raceName),
                normalizeCachePart(city),
                normalizeCachePart(country),
                distanceKm == null ? "" : String.valueOf(distanceKm)
        );
    }

    private String imageFingerprint(String imageFilePathOrDataUrl) {
        if (imageFilePathOrDataUrl.startsWith("data:image/")) {
            return "data:" + imageFilePathOrDataUrl.length() + ":" + Integer.toHexString(imageFilePathOrDataUrl.hashCode());
        }
        Path path = Path.of(imageFilePathOrDataUrl);
        if (!Files.exists(path)) {
            return imageFilePathOrDataUrl;
        }
        try {
            return imageFilePathOrDataUrl + ":" + Files.size(path) + ":" + Files.getLastModifiedTime(path).toMillis();
        } catch (IOException ignored) {
            return imageFilePathOrDataUrl;
        }
    }

    private void cacheExtractionResult(String cacheKey, RoutePathExtractionResultDTO result) {
        if (extractionCache.size() >= MAX_EXTRACTION_CACHE_ENTRIES) {
            extractionCache.clear();
        }
        extractionCache.put(cacheKey, result);
    }

    private String normalizeCachePart(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String safeLower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private String normalizeRouteHexColor(String rawValue) {
        if (rawValue == null) {
            return null;
        }
        String value = rawValue.trim();
        if (!value.matches("#[0-9A-Fa-f]{6}")) {
            return null;
        }
        return value.toUpperCase(Locale.ROOT);
    }

    private record RouteExtractionPlan(
            RouteParametersDTO routeParameters,
            boolean includeRouteHexColor,
            boolean isDeterministic,
            List<String> routeHexColors,
            List<String> exclusionRegions,
            boolean appendProminentBranch
    ) {
        private RouteExtractionPlan {
            routeHexColors = routeHexColors == null ? List.of() : List.copyOf(routeHexColors);
            exclusionRegions = exclusionRegions == null ? List.of() : List.copyOf(exclusionRegions);
        }

        private RouteExtractionPlan(RouteParametersDTO routeParameters, boolean includeRouteHexColor, boolean isDeterministic) {
            this(routeParameters, includeRouteHexColor, isDeterministic, List.of(), List.of(), false);
        }

        private RouteExtractionPlan(RouteParametersDTO routeParameters, boolean includeRouteHexColor, boolean isDeterministic, List<String> exclusionRegions) {
            this(routeParameters, includeRouteHexColor, isDeterministic, List.of(), exclusionRegions, false);
        }

        private RouteExtractionPlan(
                RouteParametersDTO routeParameters,
                boolean includeRouteHexColor,
                boolean isDeterministic,
                List<String> exclusionRegions,
                boolean appendProminentBranch
        ) {
            this(routeParameters, includeRouteHexColor, isDeterministic, List.of(), exclusionRegions, appendProminentBranch);
        }

        private RouteExtractionPlan(
                RouteParametersDTO routeParameters,
                boolean includeRouteHexColor,
                boolean isDeterministic,
                List<String> routeHexColors,
                List<String> exclusionRegions
        ) {
            this(routeParameters, includeRouteHexColor, isDeterministic, routeHexColors, exclusionRegions, false);
        }

        private List<String> effectiveRouteHexColors() {
            if (!includeRouteHexColor) {
                return List.of();
            }
            if (!routeHexColors.isEmpty()) {
                return routeHexColors;
            }
            String routeHexColor = routeParameters == null ? null : routeParameters.routeHexColor();
            return routeHexColor == null || routeHexColor.isBlank() ? List.of() : List.of(routeHexColor);
        }
    }
}
