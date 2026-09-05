package com.hermes.backend.runner;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.billing.QuotaService;
import com.hermes.backend.infrastructure.web.InputSanitizer;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class ProfileController {
    private static final int MAX_SETTINGS_MANTRA_LENGTH = 180;
    private static final long MAX_PROFILE_AVATAR_UPLOAD_BYTES = 3L * 1024 * 1024;
    private static final Set<String> PROFILE_AVATAR_CONTENT_TYPES = Set.of("image/jpeg", "image/jpg", "image/png");

    private final AuthService authService;
    private final ProfileApplicationService profileService;
    private final ProfileHeatmapService heatmapService;
    private final ProfileAvatarService avatarService;
    private final PersonalRecordService personalRecordService;
    private final QuotaService quotaService;

    public ProfileController(
            AuthService authService,
            ProfileApplicationService profileService,
            ProfileHeatmapService heatmapService,
            ProfileAvatarService avatarService,
            PersonalRecordService personalRecordService,
            QuotaService quotaService
    ) {
        this.authService = authService;
        this.profileService = profileService;
        this.heatmapService = heatmapService;
        this.avatarService = avatarService;
        this.personalRecordService = personalRecordService;
        this.quotaService = quotaService;
    }

    @GetMapping("/profile/me")
    public ResponseEntity<?> me(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        return ResponseEntity.ok(profileService.profile(runnerOptional.get()));
    }

    @GetMapping("/profile/quota")
    public ResponseEntity<?> getQuota(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }
        return ResponseEntity.ok(quotaService.getQuotaStatus(runnerOptional.get()));
    }

    @PatchMapping("/profile/me/name")
    public ResponseEntity<?> updateDisplayName(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody UpdateDisplayNameRequest request
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        String displayName = request == null ? null : request.displayName();
        String normalizedDisplayName = displayName == null ? "" : displayName.trim();
        if (normalizedDisplayName.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "Display name is required.");
        }

        if (normalizedDisplayName.length() > 60) {
            return error(HttpStatus.BAD_REQUEST, "Display name must be 60 characters or fewer.");
        }

        try {
            InputSanitizer.rejectControlAndHtmlChars(normalizedDisplayName, "displayName");
        } catch (IllegalArgumentException ex) {
            return error(HttpStatus.BAD_REQUEST, "Display name contains invalid characters.");
        }

        Runner runner = runnerOptional.get();
        return ResponseEntity.ok(profileService.updateDisplayName(runner, normalizedDisplayName));
    }

    @PutMapping(value = "/profile/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> updateAvatar(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "image", required = false) MultipartFile image
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        final byte[] normalizedImage;
        try {
            normalizedImage = avatarService.normalizeAvatarImage(avatarSourceBytes(image));
        } catch (IllegalArgumentException ex) {
            return error(HttpStatus.BAD_REQUEST, ex.getMessage());
        } catch (IOException ex) {
            return error(HttpStatus.INTERNAL_SERVER_ERROR, "Could not process profile image. Please try again.");
        }

        Runner runner = runnerOptional.get();
        avatarService.storeAvatar(runner, normalizedImage);
        return ResponseEntity.ok(profileService.profile(runner));
    }

    @DeleteMapping("/profile/me/avatar")
    public ResponseEntity<?> deleteAvatar(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        Runner runner = runnerOptional.get();
        avatarService.deleteAvatar(runner);
        return ResponseEntity.ok(profileService.profile(runner));
    }

    @GetMapping("/profile/preferences")
    public ResponseEntity<?> getPreferences(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        return ResponseEntity.ok(profileService.preferences(runnerOptional.get()));
    }

    @PutMapping("/profile/preferences")
    public ResponseEntity<?> updatePreferences(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody ProfilePreferencesRequest request
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        String mantra = request == null || request.mantra() == null ? "" : request.mantra().trim();
        if (mantra.length() > MAX_SETTINGS_MANTRA_LENGTH) {
            return error(HttpStatus.BAD_REQUEST, "Training mantra must be 180 characters or fewer.");
        }
        if (!mantra.isBlank()) {
            try {
                InputSanitizer.rejectControlAndHtmlChars(mantra, "mantra");
            } catch (IllegalArgumentException ex) {
                return error(HttpStatus.BAD_REQUEST, "Training mantra contains invalid characters.");
            }
        }

        Runner runner = runnerOptional.get();
        return ResponseEntity.ok(profileService.updatePreferences(
                runner, mantra, request != null && Boolean.TRUE.equals(request.weeklyDigestEnabled())));
    }

    @GetMapping("/profile/dashboard")
    public ResponseEntity<?> profileDashboard(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        Runner runner = runnerOptional.get();
        return ResponseEntity.ok(profileService.profileDashboard(runner));
    }

    @GetMapping("/today/dashboard")
    public ResponseEntity<?> todayDashboard(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        Runner runner = runnerOptional.get();
        return ResponseEntity.ok(profileService.todayDashboard(runner));
    }
    public ResponseEntity<?> heatmap(String authorizationHeader) {
        return heatmap(authorizationHeader, null, null, null, null);
    }

    public ResponseEntity<?> heatmap(String authorizationHeader, Long offset, Integer limit) {
        return heatmap(authorizationHeader, offset, limit, null, null);
    }

    @GetMapping("/profile/heatmap")
    public ResponseEntity<?> heatmap(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "offset", required = false) Long offset,
            @RequestParam(value = "limit", required = false) Integer limit,
            @RequestParam(value = "coverage", required = false) Boolean coverage,
            @RequestParam(value = "sample", required = false) Boolean sample
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        Runner runner = runnerOptional.get();
        return ResponseEntity.ok(heatmapService.heatmap(runner, offset, limit, coverage, sample));
    }
    @GetMapping("/profile/personal-records")
    public ResponseEntity<?> personalRecords(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }
        return ResponseEntity.ok(personalRecordService.buildForRunner(runnerOptional.get()));
    }

    private byte[] avatarSourceBytes(MultipartFile image) throws IOException {
        if (image == null || image.isEmpty() || image.getSize() <= 0) {
            throw new IllegalArgumentException("Profile image is required.");
        }
        if (image.getSize() > MAX_PROFILE_AVATAR_UPLOAD_BYTES) {
            throw new IllegalArgumentException("Profile image must be 3 MB or smaller.");
        }
        String contentType = image.getContentType();
        if (contentType == null || !PROFILE_AVATAR_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("Upload a PNG or JPEG profile image.");
        }

        return image.getBytes();
    }

    private ResponseEntity<Map<String, String>> unauthorized() {
        return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("error", message);
        return ResponseEntity.status(status).body(response);
    }

    public record UpdateDisplayNameRequest(String displayName) {
    }

    public record ProfilePreferencesRequest(String mantra, Boolean weeklyDigestEnabled) {
    }
}
