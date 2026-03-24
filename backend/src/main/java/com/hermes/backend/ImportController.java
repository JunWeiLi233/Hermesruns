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

@RestController
@RequestMapping("/api/import")
public class ImportController {
    private final AuthService authService;
    private final ActivityImportService activityImportService;

    public ImportController(AuthService authService, ActivityImportService activityImportService) {
        this.authService = authService;
        this.activityImportService = activityImportService;
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
            ImportProvider provider = ImportProvider.valueOf(providerValue.trim().toUpperCase(Locale.ROOT));
            ImportResult result = activityImportService.importFile(runnerOptional.get(), provider, file);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException exception) {
            return error(HttpStatus.BAD_REQUEST, exception.getMessage());
        }
    }

    /**
     * Multi-file import: use field names {@code garmins}, {@code coros}, {@code huawei} (repeat per file).
     */
    @PostMapping(path = "/batch", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importBatch(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "garmins", required = false) List<MultipartFile> garmins,
            @RequestParam(value = "coros", required = false) List<MultipartFile> coros,
            @RequestParam(value = "huawei", required = false) List<MultipartFile> huawei) {

        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
        }

        Runner runner = runnerOptional.get();
        List<MultipartFile> g = garmins != null ? garmins : List.of();
        List<MultipartFile> c = coros != null ? coros : List.of();
        List<MultipartFile> h = huawei != null ? huawei : List.of();

        boolean any = g.stream().anyMatch(f -> f != null && !f.isEmpty())
                || c.stream().anyMatch(f -> f != null && !f.isEmpty())
                || h.stream().anyMatch(f -> f != null && !f.isEmpty());
        if (!any) {
            return error(HttpStatus.BAD_REQUEST, "Please choose at least one GPX, TCX, FIT, or ZIP file.");
        }

        ImportResult aggregate = ImportResult.empty("IMPORT", "Batch import completed.");
        List<String> errors = new ArrayList<>();

        for (MultipartFile file : g) {
            if (file == null || file.isEmpty()) continue;
            try {
                aggregate = aggregate.merge(activityImportService.importFile(runner, ImportProvider.GARMIN, file));
            } catch (IllegalArgumentException ex) {
                errors.add(ex.getMessage());
            }
        }
        for (MultipartFile file : c) {
            if (file == null || file.isEmpty()) continue;
            try {
                aggregate = aggregate.merge(activityImportService.importFile(runner, ImportProvider.COROS, file));
            } catch (IllegalArgumentException ex) {
                errors.add(ex.getMessage());
            }
        }
        for (MultipartFile file : h) {
            if (file == null || file.isEmpty()) continue;
            try {
                aggregate = aggregate.merge(activityImportService.importFile(runner, ImportProvider.HUAWEI, file));
            } catch (IllegalArgumentException ex) {
                errors.add(ex.getMessage());
            }
        }

        if (aggregate.importedActivities() == 0 && !errors.isEmpty()) {
            return error(HttpStatus.BAD_REQUEST, errors.get(0));
        }

        return ResponseEntity.ok(aggregate);
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("error", message);
        return ResponseEntity.status(status).body(response);
    }
}