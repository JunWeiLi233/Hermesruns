package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;

@Component
@ConditionalOnProperty(name = "app.course-map.bulk-scan.enabled", havingValue = "true")
public class CourseMapBulkScanCommand implements CommandLineRunner {
    private static final Logger logger = LoggerFactory.getLogger(CourseMapBulkScanCommand.class);
    private static final int MAX_PRINTED_SCAN_STEPS = 18;

    private static final Set<String> NON_STANDARD_CITY_ROAD_MARATHON_IDS = Set.of(
            "big-sur-marathon",
            "queenstown-marathon"
    );

    private final RaceCourseMapService raceCourseMapService;
    private final RaceCourseMapImageService imageService;
    private final CourseMapScanWatcher scanWatcher;
    private final ObjectMapper objectMapper;
    private final ConfigurableApplicationContext applicationContext;

    @Value("${app.course-map.bulk-scan.catalog-file:../frontend/src/data/worldRaceCatalog.json}")
    private String catalogFile;

    @Value("${app.course-map.bulk-scan.local-only:true}")
    private boolean localOnly;

    @Value("${app.course-map.bulk-scan.only-missing:true}")
    private boolean onlyMissing;

    @Value("${app.course-map.bulk-scan.max-races:0}")
    private int maxRaces;

    @Value("${app.course-map.bulk-scan.actor-email:local-course-map-bulk-scan@hermes.local}")
    private String actorEmail;

    @Value("${app.course-map.bulk-scan.exit-when-complete:true}")
    private boolean exitWhenComplete;

    public CourseMapBulkScanCommand(
            RaceCourseMapService raceCourseMapService,
            RaceCourseMapImageService imageService,
            CourseMapScanWatcher scanWatcher,
            ObjectMapper objectMapper,
            ConfigurableApplicationContext applicationContext
    ) {
        this.raceCourseMapService = raceCourseMapService;
        this.imageService = imageService;
        this.scanWatcher = scanWatcher;
        this.objectMapper = objectMapper;
        this.applicationContext = applicationContext;
    }

    @Override
    public void run(String... args) throws Exception {
        List<CatalogRace> races = readStandardRoadMarathons();
        int queued = 0;
        int published = 0;
        int skipped = 0;
        int failed = 0;
        int missingLocal = 0;

        for (CatalogRace race : races) {
            if (maxRaces > 0 && queued >= maxRaces) {
                break;
            }
            if (localOnly && imageService.resolveLocalCourseMapAssets(race.id()).isEmpty()) {
                missingLocal++;
                continue;
            }

            queued++;
            RaceCourseMapService.CourseMapAcquisitionResult result;
            List<CourseMapScanStep> scanSteps = List.of();
            try (CourseMapScanWatcher.ScanScope ignored = scanWatcher.watch(race.id(), "bulk-scan", liveStepPrinter(race.id()))) {
                try {
                    result = raceCourseMapService.acquireAndPublishCourseMap(
                            new RaceCourseMapService.CourseMapAcquisitionRequest(
                                    race.id(),
                                    race.name(),
                                    race.city(),
                                    race.country(),
                                    race.officialWebsite(),
                                    race.latitude(),
                                    race.longitude(),
                                    race.distanceKm()
                            ),
                            actorEmail,
                            onlyMissing
                    );
                } catch (RuntimeException ex) {
                    result = new RaceCourseMapService.CourseMapAcquisitionResult(
                            race.id(),
                            race.name(),
                            "failed",
                            false,
                            0,
                            0,
                            safeMessage(ex)
                    );
                } finally {
                    scanSteps = scanWatcher.currentSteps();
                }
            }

            if (result.published()) {
                published++;
            } else if (result.status() != null && result.status().startsWith("skipped")) {
                skipped++;
            } else {
                failed++;
            }

            logger.info("course-map-bulk-scan raceId={} status={} published={} candidates={} confidence={} summary={}",
                    result.raceId(), result.status(), result.published(), result.candidatesTried(), result.confidence(), oneLine(result.summary()));
            logger.info("course-map-bulk-scan-steps raceId={} steps={}",
                    result.raceId(), compactSteps(scanSteps));
        }

        logger.info("course-map-bulk-scan-summary catalogStandard={} queued={} published={} skipped={} failed={} missingLocal={} localOnly={} onlyMissing={}",
                races.size(), queued, published, skipped, failed, missingLocal, localOnly, onlyMissing);
        if (exitWhenComplete) {
            SpringApplication.exit(applicationContext, () -> 0);
        }
    }

    private List<CatalogRace> readStandardRoadMarathons() throws Exception {
        Path catalogPath = Path.of(catalogFile).toAbsolutePath().normalize();
        if (!Files.isRegularFile(catalogPath)) {
            throw new IllegalStateException("Race catalog file not found: " + catalogPath);
        }

        JsonNode root = objectMapper.readTree(catalogPath.toFile());
        if (!root.isArray()) {
            throw new IllegalStateException("Race catalog must be a JSON array: " + catalogPath);
        }

        List<CatalogRace> races = new ArrayList<>();
        for (JsonNode node : root) {
            CatalogRace race = new CatalogRace(
                    text(node, "id"),
                    text(node, "name"),
                    text(node, "city"),
                    text(node, "country"),
                    text(node, "officialWebsite"),
                    decimal(node, "lat"),
                    decimal(node, "lng"),
                    decimal(node, "distanceKm")
            );
            if (isStandardCityRoadMarathon(race)) {
                races.add(race);
            }
        }
        return races;
    }

    private boolean isStandardCityRoadMarathon(CatalogRace race) {
        if (race == null) return false;
        if (race.id() == null || race.id().isBlank()) return false;
        if (NON_STANDARD_CITY_ROAD_MARATHON_IDS.contains(normalize(race.id()))) return false;
        if (race.distanceKm() == null || race.distanceKm() < 40.0 || race.distanceKm() > 45.0) return false;
        if (race.city() == null || race.city().isBlank()) return false;
        String combined = String.join(" ", normalize(race.name()), normalize(race.city()), normalize(race.country()));
        if (!combined.contains("marathon")) return false;
        return !combined.contains("trail")
                && !combined.contains("ultra")
                && !combined.contains("mountain")
                && !combined.contains("fell")
                && !combined.contains("cross country")
                && !combined.contains("xc ")
                && !combined.contains("relay")
                && !combined.contains("obstacle");
    }

    private String text(JsonNode node, String fieldName) {
        JsonNode value = node == null ? null : node.get(fieldName);
        return value == null || value.isNull() ? "" : value.asText("");
    }

    private Double decimal(JsonNode node, String fieldName) {
        JsonNode value = node == null ? null : node.get(fieldName);
        return value == null || value.isNull() || !value.isNumber() ? null : value.asDouble();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String oneLine(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }

    private String compactSteps(List<CourseMapScanStep> steps) {
        if (steps == null || steps.isEmpty()) {
            return "";
        }
        int start = Math.max(0, steps.size() - MAX_PRINTED_SCAN_STEPS);
        List<String> parts = new ArrayList<>();
        if (start > 0) {
            parts.add("...+" + start + " earlier");
        }
        for (int i = start; i < steps.size(); i++) {
            parts.add(compactStep(steps.get(i)));
        }
        return oneLine(String.join(" | ", parts));
    }

    private Consumer<List<CourseMapScanStep>> liveStepPrinter(String raceId) {
        int[] emitted = {0};
        return steps -> {
            if (steps == null || emitted[0] >= steps.size()) {
                return;
            }
            for (int i = emitted[0]; i < steps.size(); i++) {
                logger.info("course-map-bulk-scan-step raceId={} index={} step={}",
                        oneLine(raceId), (i + 1), compactStep(steps.get(i)));
            }
            emitted[0] = steps.size();
        };
    }

    private String compactStep(CourseMapScanStep step) {
        if (step == null) {
            return "";
        }
        StringBuilder builder = new StringBuilder()
                .append(oneLine(step.stage()))
                .append(":")
                .append(oneLine(step.status()));
        String message = oneLine(step.message());
        if (!message.isBlank()) {
            builder.append(":").append(truncate(message, 180));
        }
        String details = compactDetails(step.details());
        if (!details.isBlank()) {
            builder.append(" {").append(details).append("}");
        }
        return builder.toString();
    }

    private String compactDetails(Map<String, Object> details) {
        if (details == null || details.isEmpty()) {
            return "";
        }
        List<String> parts = new ArrayList<>();
        details.forEach((key, value) -> {
            String safeKey = oneLine(key);
            if (safeKey.isBlank()) {
                return;
            }
            parts.add(safeKey + "=" + truncate(oneLine(String.valueOf(value)), 120));
        });
        return String.join(",", parts);
    }

    private String truncate(String value, int maxLength) {
        String safeValue = value == null ? "" : value;
        if (safeValue.length() <= maxLength) {
            return safeValue;
        }
        return safeValue.substring(0, Math.max(0, maxLength - 1)) + "...";
    }

    private String safeMessage(RuntimeException ex) {
        String message = ex == null ? "" : ex.getMessage();
        return message == null || message.isBlank() ? "Course-map bulk scan failed." : oneLine(message);
    }

    private record CatalogRace(
            String id,
            String name,
            String city,
            String country,
            String officialWebsite,
            Double latitude,
            Double longitude,
            Double distanceKm
    ) {}
}
