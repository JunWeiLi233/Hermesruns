package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The signed-in runner's pace curve and critical speed. Own data only: the runner comes from the session, never from the
 * request. Like the other records, it first makes sure the runs it depends on have been analysed, for a short while at
 * most, and says in {@code complete} whether some are still waiting.
 */
@RestController
@RequestMapping("/api/training")
public class PaceCurveController {

    private static final Logger log = LoggerFactory.getLogger(PaceCurveController.class);

    /** The same budget {@link RunRecordsController} gives a read of the records. */
    private static final Duration ANALYSIS_BUDGET = Duration.ofMillis(1500);
    private static final int ANALYSIS_LIMIT = 100;

    private final AuthService authService;
    private final PaceCurveService service;
    private final RunRecordsCoordinator coordinator;

    public PaceCurveController(AuthService authService, PaceCurveService service, RunRecordsCoordinator coordinator) {
        this.authService = authService;
        this.service = service;
        this.coordinator = coordinator;
    }

    /**
     * @param days how many days up to today the curve reaches back (1 to 3660), or {@code all}; 180 when left out
     */
    @GetMapping("/pace-curve")
    public ResponseEntity<?> paceCurve(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "days", required = false) String days) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }
        Integer window = PaceCurveService.DEFAULT_DAYS;
        if (days != null && !days.isBlank()) {
            if ("all".equalsIgnoreCase(days.trim())) {
                window = null;
            } else {
                try {
                    window = Integer.valueOf(days.trim());
                } catch (NumberFormatException notANumber) {
                    return error(HttpStatus.BAD_REQUEST, "INVALID_RANGE", "'days' must be a whole number of days, or 'all'.");
                }
            }
        }
        long waiting = analyseWaiting(runner.get());
        try {
            return ResponseEntity.ok(service.paceCurve(runner.get(), window, waiting == 0));
        } catch (IllegalArgumentException refused) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_RANGE", refused.getMessage());
        }
    }

    /** How many of the runner's runs are still waiting to be analysed; the answer is given from what has been worked out. */
    private long analyseWaiting(Runner runner) {
        try {
            return coordinator.ensurePending(runner, ANALYSIS_BUDGET, ANALYSIS_LIMIT);
        } catch (RuntimeException failure) {
            log.warn("Records could not be worked out before the pace curve was read ({})", failure.getClass().getSimpleName());
            return Long.MAX_VALUE;
        }
    }

    private static ResponseEntity<Map<String, String>> error(HttpStatus status, String code, String message) {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("error", message);
        body.put("code", code);
        return ResponseEntity.status(status).body(body);
    }
}
