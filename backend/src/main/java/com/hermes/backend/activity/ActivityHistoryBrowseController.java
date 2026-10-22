package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Calendar-aware browsing is additive to the legacy beforeId page API. */
@RestController
public class ActivityHistoryBrowseController {
    private final AuthService auth;
    private final RunHistoryBrowseService history;
    public ActivityHistoryBrowseController(AuthService auth, RunHistoryBrowseService history) {
        this.auth = auth; this.history = history;
    }

    @GetMapping(value = "/api/activities/page", params = "sort")
    public ResponseEntity<?> page(@RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(defaultValue = "60") int limit, @RequestParam(required = false) String cursor,
            @RequestParam String sort, @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month, @RequestParam(required = false) String day,
            @RequestParam(required = false) String search, @RequestParam(required = false) String defaultName) {
        var runner = auth.findByAuthorizationHeader(authorization);
        if (runner.isEmpty()) return ResponseEntity.status(401).body(Map.of("code", "UNAUTHORIZED", "error", "Sign in required."));
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(history.browse(runner.get(), limit, cursor,
                sort, year, month, day, search, defaultName));
    }
}
