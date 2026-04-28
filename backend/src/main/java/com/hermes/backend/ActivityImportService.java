package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.ArrayList;
import java.util.zip.ZipException;
import java.io.ByteArrayOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
public class ActivityImportService {
    private static final Logger logger = LoggerFactory.getLogger(ActivityImportService.class);
    private final ActivityRepository activityRepository;
    private final List<ActivityFileParser> fileParsers;
    private final ActivityPointRepository activityPointRepository;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final AcclimatizationService acclimatizationService;

    private static final int MAX_ZIP_ENTRIES = 200;
    private static final int MAX_ZIP_ENTRY_BYTES = 10 * 1024 * 1024; // 10MB per entry
    private static final long MAX_ZIP_TOTAL_BYTES = 50L * 1024L * 1024L; // 50MB total extracted

    private static final int POINTS_BATCH_SIZE = 500;
    private static final int MAX_POINTS_PER_ACTIVITY = 100_000;

    public ActivityImportService(
            ActivityRepository activityRepository,
            List<ActivityFileParser> fileParsers,
            ActivityPointRepository activityPointRepository,
            ApplicationEventPublisher applicationEventPublisher,
            AcclimatizationService acclimatizationService
    ) {
        this.activityRepository = activityRepository;
        this.fileParsers = fileParsers;
        this.activityPointRepository = activityPointRepository;
        this.applicationEventPublisher = applicationEventPublisher;
        this.acclimatizationService = acclimatizationService;
    }

    @Transactional
    public ImportResult importFile(Runner runner, ImportProvider provider, MultipartFile file) {
        if (provider != ImportProvider.GARMIN && provider != ImportProvider.COROS && provider != ImportProvider.HUAWEI) {
            throw new IllegalArgumentException("File upload supports FIT/GPX device exports (COROS, Huawei, and compatible sources) only.");
        }

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Please choose a GPX, TCX, FIT, or ZIP workout file to import.");
        }

        try {
            String fileName = file.getOriginalFilename();
            byte[] fileBytes = file.getBytes();
            String extension = fileExtension(fileName);

            if ("ZIP".equalsIgnoreCase(extension)) {
                return importZipArchive(runner, provider, fileName, fileBytes);
            }

            return importWorkoutBytes(runner, provider, fileName, fileBytes);
        } catch (IOException exception) {
            throw new IllegalArgumentException("Unable to read the uploaded workout file.", exception);
        }
    }

    private ImportResult importZipArchive(Runner runner, ImportProvider provider, String fileName, byte[] fileBytes) {
        ImportResult aggregate = ImportResult.empty(provider.name(), "ZIP import completed.");
        int supportedEntries = 0;
        long extractedTotalBytes = 0;

        try (ZipInputStream zipInputStream = new ZipInputStream(new ByteArrayInputStream(fileBytes))) {
            ZipEntry entry;
            while ((entry = zipInputStream.getNextEntry()) != null) {
                if (entry.isDirectory()) {
                    continue;
                }

                String entryName = entry.getName();
                if (entryName.contains("..") || entryName.contains("/..") || entryName.contains("..\\")) {
                    continue;
                }
                String entryExtension = fileExtension(entryName);
                if (!supportsImportExtension(entryExtension)) {
                    continue;
                }

                if (supportedEntries >= MAX_ZIP_ENTRIES) {
                    // Hard stop to avoid pathological ZIPs.
                    break;
                }

                supportedEntries++;

                byte[] entryBytes = readEntryBytesWithLimits(zipInputStream, MAX_ZIP_ENTRY_BYTES);
                extractedTotalBytes += entryBytes.length;
                if (extractedTotalBytes > MAX_ZIP_TOTAL_BYTES) {
                    throw new IllegalArgumentException("ZIP archive is too large to import (extracted data limit).");
                }
                aggregate = aggregate.merge(importWorkoutBytes(runner, provider, entryName, entryBytes));
            }
        } catch (ZipException exception) {
            throw new IllegalArgumentException("Invalid ZIP archive.", exception);
        } catch (IOException exception) {
            throw new IllegalArgumentException("Unable to read the uploaded ZIP archive.", exception);
        }

        if (supportedEntries == 0) {
            throw new IllegalArgumentException("The ZIP archive does not contain any GPX, TCX, or FIT workout files.");
        }

        String message = aggregate.importedActivities() > 0
                ? "ZIP import completed successfully."
                : "ZIP processed, but no new running activities were added.";

        return new ImportResult(
                provider.name(),
                aggregate.importedActivities(),
                aggregate.importedPoints(),
                aggregate.skippedDuplicates(),
                aggregate.skippedNonRuns(),
                message,
                aggregate.rejectedFiles() != null ? aggregate.rejectedFiles() : List.of()
        );
    }

    private ImportResult importWorkoutBytes(Runner runner, ImportProvider provider, String fileName, byte[] fileBytes) {
        String extension = fileExtension(fileName);
        ActivityFileParser parser = fileParsers.stream()
                .filter(candidate -> candidate.supports(extension))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported file type. Please upload GPX, TCX, FIT, or ZIP."));

        String checksum = sha256(fileBytes);
        if (activityRepository.existsByRunnerAndProviderAndSourceChecksum(runner, provider, checksum)) {
            return new ImportResult(provider.name(), 0, 0, 1, 0, "This activity file was already imported.", List.of());
        }

        ParsedActivityData parsedActivity = parser.parse(fileName, fileBytes);
        if (parsedActivity.activityType() == ActivityType.UNKNOWN) {
            throw new IllegalArgumentException(
                    "This file could not be confirmed as a run. Please upload a running GPX, TCX, or FIT export."
            );
        }

        if (parsedActivity.activityType() != ActivityType.RUN) {
            return new ImportResult(
                    provider.name(),
                    0,
                    0,
                    0,
                    1,
                    "Only running activities can be imported into Recent Runs. This file was skipped.",
                    List.of()
            );
        }

        Activity activity = new Activity();
        activity.setRunner(runner);
        activity.setProvider(provider);
        activity.setActivityType(parsedActivity.activityType());
        activity.setName(resolveActivityName(parsedActivity, fileName));
        activity.setStartTime(parsedActivity.startTime());
        activity.setDistanceMeters(parsedActivity.distanceMeters());
        activity.setDurationSeconds(parsedActivity.durationSeconds());
        activity.setDistanceKm(parsedActivity.distanceMeters() == null ? 0d : parsedActivity.distanceMeters() / 1000d);
        activity.setMovingTimeSeconds(parsedActivity.durationSeconds() == null ? 0 : Math.toIntExact(parsedActivity.durationSeconds()));
        activity.setStartDate(parsedActivity.startTime() == null ? null : parsedActivity.startTime().toString());
        activity.setSourceFileName(fileName);
        activity.setSourceChecksum(checksum);
        activity.setCreatedAt(LocalDateTime.now());
        activity.setAverageHeartRate(parsedActivity.averageHeartRate());
        activity.setMaxHeartRate(parsedActivity.maxHeartRate());

        // Weather adjustment
        try {
            Integer penalty = acclimatizationService.calculatePenaltyForActivity(activity);
            activity.setPacePenaltySecPerKm(penalty);
            activity.setWeatherAdjusted(penalty != null && penalty > 0);
        } catch (Exception e) {
            logger.warn("Weather adjustment calculation failed during import: {}", e.getMessage(), e);
        }

        // Persist the Activity first so we can bulk-insert ActivityPoint rows
        // without keeping the entire points list inside the Activity's JPA collection.
        Activity savedActivity = activityRepository.save(activity);
        applicationEventPublisher.publishEvent(new ActivityIngestedEvent(runner.getId(), savedActivity.getId()));

        List<ActivityPoint> batch = new ArrayList<>(POINTS_BATCH_SIZE);
        List<ParsedTrackPoint> allPoints = parsedActivity.points();
        int totalPoints = allPoints != null ? allPoints.size() : 0;
        int stride = totalPoints > MAX_POINTS_PER_ACTIVITY
                ? Math.max(1, (int) Math.ceil(totalPoints / (double) MAX_POINTS_PER_ACTIVITY))
                : 1;

        int sequenceIndex = 0;
        int keptPoints = 0;
        if (allPoints != null && !allPoints.isEmpty()) {
            for (int idx = 0; idx < totalPoints; idx += stride) {
                ParsedTrackPoint point = allPoints.get(idx);
            ActivityPoint activityPoint = new ActivityPoint();
            activityPoint.setActivity(savedActivity);
            activityPoint.setSequenceIndex(sequenceIndex++);
            activityPoint.setLatitude(point.latitude());
            activityPoint.setLongitude(point.longitude());
                activityPoint.setElapsedSeconds(point.elapsedSeconds());
                activityPoint.setDistanceMeters(point.distanceMeters());
                activityPoint.setElevationMeters(point.elevationMeters());
                activityPoint.setElevationRawMeters(point.elevationMeters());
                activityPoint.setHeartRate(point.heartRate());
                activityPoint.setCadence(point.cadence());
            batch.add(activityPoint);
                keptPoints++;

                if (batch.size() >= POINTS_BATCH_SIZE) {
                    activityPointRepository.saveAll(batch);
                    activityPointRepository.flush();
                    batch.clear();
                }
            }
        }
        if (!batch.isEmpty()) {
            activityPointRepository.saveAll(batch);
            activityPointRepository.flush();
        }
        // Help GC earlier on small-RAM servers.
        if (allPoints != null) {
            try { allPoints.clear(); } catch (Exception ignored) { logger.trace("GC helper: allPoints.clear() failed", ignored); }
        }

        return new ImportResult(
                provider.name(),
                1,
                keptPoints,
                0,
                0,
                "Import completed successfully.",
                List.of()
        );
    }

    private String resolveActivityName(ParsedActivityData parsedActivity, String fileName) {
        if (parsedActivity.name() != null && !parsedActivity.name().isBlank()) {
            return parsedActivity.name().trim();
        }

        if (fileName == null || fileName.isBlank()) {
            return "Imported Activity";
        }

        int dotIndex = fileName.lastIndexOf('.');
        return dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
    }

    private String fileExtension(String fileName) {
        if (fileName == null || !fileName.contains(".")) {
            return "";
        }

        return fileName.substring(fileName.lastIndexOf('.') + 1).toUpperCase(Locale.ROOT);
    }

    private boolean supportsImportExtension(String extension) {
        return "GPX".equalsIgnoreCase(extension)
                || "TCX".equalsIgnoreCase(extension)
                || "FIT".equalsIgnoreCase(extension);
    }

    private String sha256(byte[] fileBytes) {
        try {
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(messageDigest.digest(fileBytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available.", exception);
        }
    }

    private static byte[] readEntryBytesWithLimits(ZipInputStream zipInputStream, int maxBytes) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(Math.min(1024 * 1024, maxBytes));
        byte[] buffer = new byte[8 * 1024];
        int read;
        int total = 0;
        while ((read = zipInputStream.read(buffer)) >= 0) {
            total += read;
            if (total > maxBytes) {
                throw new IllegalArgumentException("ZIP entry is too large to import (max " + (maxBytes / (1024 * 1024)) + "MB).");
            }
            out.write(buffer, 0, read);
        }
        return out.toByteArray();
    }
}
