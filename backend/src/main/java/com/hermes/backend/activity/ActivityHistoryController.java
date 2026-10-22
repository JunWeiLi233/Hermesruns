package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Additive history API; the existing array feed and analysis contracts stay compatible. */
@RestController
public class ActivityHistoryController {
    private static final int MAX_PAGE_SIZE = 500;
    private final AuthService authService;
    private final ActivityDataAccess activities;

    public ActivityHistoryController(AuthService authService, ActivityDataAccess activities) {
        this.authService = authService;
        this.activities = activities;
    }

    @GetMapping("/api/activities/page")
    public ResponseEntity<?> page(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(defaultValue = "100") int limit,
            @RequestParam(required = false) Long beforeId) {
        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);
        if (activeUser.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("code", "UNAUTHORIZED", "error", "Invalid or expired session token."));
        }
        if (beforeId != null && beforeId <= 0) {
            return ResponseEntity.badRequest()
                    .body(Map.of("code", "INVALID_PARAM", "error", "beforeId must be positive."));
        }
        int size = Math.max(1, Math.min(limit, MAX_PAGE_SIZE));
        Runner runner = activeUser.get();
        // One look-ahead row establishes continuation without a full-history COUNT.
        List<Activity> rows = activities.findRunsBeforeIdForRunner(runner, beforeId, size + 1);
        boolean hasMore = rows.size() > size;
        List<Activity> selected = rows.subList(0, Math.min(size, rows.size()));
        List<Map<String, Object>> items = selected.stream()
                .map(activity -> ActivityRoutePreviewHelper.toRunFeedItem(activity, runner)).toList();
        Long nextBeforeId = hasMore ? selected.get(selected.size() - 1).getId() : null;
        return ResponseEntity.ok(new HistoryPage(items, nextBeforeId, hasMore));
    }

    public record HistoryPage(List<Map<String, Object>> items, Long nextBeforeId, boolean hasMore) {}
}
