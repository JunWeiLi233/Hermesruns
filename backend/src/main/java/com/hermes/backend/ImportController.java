package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/import")
public class ImportController {
    private final AuthService authService;
    private final ActivityImportService activityImportService;

    private static final long MAX_UPLOAD_BYTES = 20L * 1024L * 1024L; // 20MB
    private static final int MAX_BATCH_FILES = 50;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("gpx", "tcx", "fit", "zip");

    public ImportController(AuthService authService, ActivityImportService activityImportService) {
        this.authService = authService;
        this.activityImportService = activityImportService;
    }

    private static void validateUploadFile(MultipartFile file, String providerName) {
        if (file == null) {
            throw new IllegalArgumentException("Missing file.");
        }
        if (file.isEmpty() || file.getSize() <= 0) {
            throw new IllegalArgumentException("Empty upload file.");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new IllegalArgumentException("File too large (max 20MB).");
        }

        String original = file.getOriginalFilename();
        if (original == null || original.isBlank()) {
            throw new IllegalArgumentException("Upload filename is required.");
        }

        // Extract last path component (defense-in-depth).
        original = original.replace('\\', '/');
        int slash = original.lastIndexOf('/');
        if (slash >= 0) original = original.substring(slash + 1);

        int dot = original.lastIndexOf('.');
        if (dot < 0 || dot == original.length() - 1) {
            throw new IllegalArgumentException("Unsupported upload file type.");
        }
        String ext = original.substring(dot + 1).trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new IllegalArgumentException("Unsupported upload file type.");
        }
    }

    @PostMapping(path = "/files", consumes = "multipart/form-data")
    public ResponseEntity<?> importFile(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam("provider") String providerValue,
            @RequestParam("file") MultipartFile file
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
        }

        try {
            if (providerValue == null || providerValue.isBlank()) {
                return error(HttpStatus.BAD_REQUEST, "provider is required.");
            }
            String normalizedProvider = providerValue.trim();
            if (normalizedProvider.length() > 30) {
                return error(HttpStatus.BAD_REQUEST, "Invalid provider.");
            }
            ImportProvider provider = ImportProvider.valueOf(normalizedProvider.toUpperCase(Locale.ROOT));

            validateUploadFile(file, provider.name());
            ImportResult result = activityImportService.importFile(runnerOptional.get(), provider, file);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException exception) {
            return error(HttpStatus.BAD_REQUEST, exception.getMessage());
        }
    }

    /**
     * Multi-file import: use field names {@code exports} (FIT/GPX batch), {@code coros}, {@code huawei}.
     * Legacy {@code garmins} is still accepted for older clients.
     */
    @PostMapping(path = "/batch", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importBatch(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "exports", required = false) List<MultipartFile> exports,
            @RequestParam(value = "garmins", required = false) List<MultipartFile> garminsLegacy,
            @RequestParam(value = "coros", required = false) List<MultipartFile> coros,
            @RequestParam(value = "huawei", required = false) List<MultipartFile> huawei) {

        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
        }

        Runner runner = runnerOptional.get();
        List<MultipartFile> g = new ArrayList<>();
        if (exports != null) {
            g.addAll(exports);
        }
        if (garminsLegacy != null) {
            g.addAll(garminsLegacy);
        }
        List<MultipartFile> c = coros != null ? coros : List.of();
        List<MultipartFile> h = huawei != null ? huawei : List.of();

        boolean any = g.stream().anyMatch(f -> f != null && !f.isEmpty())
                || c.stream().anyMatch(f -> f != null && !f.isEmpty())
                || h.stream().anyMatch(f -> f != null && !f.isEmpty());
        if (!any) {
            return error(HttpStatus.BAD_REQUEST, "Please choose at least one GPX, TCX, FIT, or ZIP file.");
        }

        long totalFiles = g.stream().filter(f -> f != null && !f.isEmpty()).count()
                + c.stream().filter(f -> f != null && !f.isEmpty()).count()
                + h.stream().filter(f -> f != null && !f.isEmpty()).count();
        if (totalFiles > MAX_BATCH_FILES) {
            return error(HttpStatus.BAD_REQUEST,
                    "Batch limit is " + MAX_BATCH_FILES + " files. Please split your import into smaller batches.");
        }

        ImportResult aggregate = ImportResult.empty("IMPORT", "Batch import completed.");

        for (MultipartFile file : g) {
            if (file == null || file.isEmpty()) continue;
            String filename = safeFilename(file);
            try {
                validateUploadFile(file, "GARMIN");
                aggregate = aggregate.merge(activityImportService.importFile(runner, ImportProvider.GARMIN, file));
            } catch (IllegalArgumentException ex) {
                aggregate = aggregate.withRejection(filename, ex.getMessage());
            } catch (Exception ex) {
                aggregate = aggregate.withRejection(filename, "Import failed.");
            }
        }
        for (MultipartFile file : c) {
            if (file == null || file.isEmpty()) continue;
            String filename = safeFilename(file);
            try {
                validateUploadFile(file, "COROS");
                aggregate = aggregate.merge(activityImportService.importFile(runner, ImportProvider.COROS, file));
            } catch (IllegalArgumentException ex) {
                aggregate = aggregate.withRejection(filename, ex.getMessage());
            } catch (Exception ex) {
                aggregate = aggregate.withRejection(filename, "Import failed.");
            }
        }
        for (MultipartFile file : h) {
            if (file == null || file.isEmpty()) continue;
            String filename = safeFilename(file);
            try {
                validateUploadFile(file, "HUAWEI");
                aggregate = aggregate.merge(activityImportService.importFile(runner, ImportProvider.HUAWEI, file));
            } catch (IllegalArgumentException ex) {
                aggregate = aggregate.withRejection(filename, ex.getMessage());
            } catch (Exception ex) {
                aggregate = aggregate.withRejection(filename, "Import failed.");
            }
        }

        if (aggregate.importedActivities() == 0 && !aggregate.rejectedFiles().isEmpty()) {
            return error(HttpStatus.BAD_REQUEST, aggregate.rejectedFiles().get(0));
        }

        return ResponseEntity.ok(aggregate);
    }

    private static String safeFilename(MultipartFile file) {
        String name = file.getOriginalFilename();
        if (name == null || name.isBlank()) return "unknown";
        name = name.replace('\\', '/');
        int slash = name.lastIndexOf('/');
        return slash >= 0 ? name.substring(slash + 1) : name;
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("error", message);
        return ResponseEntity.status(status).body(response);
    }
}
