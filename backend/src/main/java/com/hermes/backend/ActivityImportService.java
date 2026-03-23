package com.hermes.backend;

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
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
public class ActivityImportService {
    private final ActivityRepository activityRepository;
    private final List<ActivityFileParser> fileParsers;

    public ActivityImportService(ActivityRepository activityRepository, List<ActivityFileParser> fileParsers) {
        this.activityRepository = activityRepository;
        this.fileParsers = fileParsers;
    }

    @Transactional
    public ImportResult importFile(Runner runner, ImportProvider provider, MultipartFile file) {
        if (provider != ImportProvider.GARMIN && provider != ImportProvider.COROS) {
            throw new IllegalArgumentException("File upload currently supports Garmin and COROS only.");
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

                supportedEntries++;
                byte[] entryBytes = zipInputStream.readAllBytes();
                aggregate = aggregate.merge(importWorkoutBytes(runner, provider, entryName, entryBytes));
            }
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
                message
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
            return new ImportResult(provider.name(), 0, 0, 1, 0, "This activity file was already imported.");
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
                    "Only running activities can be imported into Recent Runs. This file was skipped."
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

        int sequenceIndex = 0;
        for (ParsedTrackPoint point : parsedActivity.points()) {
            ActivityPoint activityPoint = new ActivityPoint();
            activityPoint.setSequenceIndex(sequenceIndex++);
            activityPoint.setLatitude(point.latitude());
            activityPoint.setLongitude(point.longitude());
            activity.addPoint(activityPoint);
        }

        activityRepository.save(activity);

        return new ImportResult(
                provider.name(),
                1,
                parsedActivity.points().size(),
                0,
                0,
                "Import completed successfully."
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
}
