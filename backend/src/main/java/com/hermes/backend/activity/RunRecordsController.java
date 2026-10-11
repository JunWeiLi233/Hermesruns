package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The records of the signed-in runner: the best efforts of one run and of the whole history, and the other runs over the
 * same route. It has a controller of its own because {@link ActivityController} is held to a method-count ceiling.
 *
 * <p>Every route answers 404 for a run that is not the caller's, without saying whether it exists. Reading records first
 * makes sure the runs they depend on have been analysed, for a short while at most, and says in {@code complete} whether
 * some are still waiting (ranks and matches can still change while they are).</p>
 */
@RestController
@RequestMapping("/api")
public class RunRecordsController {

    private static final Logger log = LoggerFactory.getLogger(RunRecordsController.class);

    /** How long one request may spend analysing runs that have not been, and how many. */
    private static final Duration ANALYSIS_BUDGET = Duration.ofMillis(1500);
    private static final int ANALYSIS_LIMIT = 100;

    private final AuthService authService;
    private final BestEffortService bestEfforts;
    private final RouteMatchService routes;
    private final RunRecordsCoordinator coordinator;

    public RunRecordsController(AuthService authService, BestEffortService bestEfforts, RouteMatchService routes,
                                RunRecordsCoordinator coordinator) {
        this.authService = authService;
        this.bestEfforts = bestEfforts;
        this.routes = routes;
        this.coordinator = coordinator;
    }

    /** The best efforts on one run, each with its rank among all the runner's efforts at that distance. */
    @GetMapping("/activities/{id}/best-efforts")
    public ResponseEntity<?> runEfforts(
            @PathVariable("id") Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }
        long waiting = analyseWaiting(runner.get(), id);
        return bestEfforts.effortsOf(runner.get(), id)
                .<ResponseEntity<?>>map(efforts -> ResponseEntity.ok(new BestEffortService.RunEfforts(waiting == 0, efforts)))
                .orElseGet(() -> error(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found."));
    }

    /**
     * Types a chip time for one effort ({@code elapsedSeconds}, or null to take it back) and hides or shows it
     * ({@code hidden}). A field that cannot be changed is refused instead of ignored, so a typo does not look like a save.
     */
    @PatchMapping("/activities/{id}/best-efforts/{distanceKey}")
    public ResponseEntity<?> changeEffort(
            @PathVariable("id") Long id,
            @PathVariable("distanceKey") String distanceKey,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }
        if (body == null || body.isEmpty()) {
            return error(HttpStatus.BAD_REQUEST, "NOTHING_TO_CHANGE", "Say what to change.");
        }
        for (String field : body.keySet()) {
            if (!Set.of("elapsedSeconds", "hidden").contains(field)) {
                return error(HttpStatus.BAD_REQUEST, "UNSUPPORTED_FIELD", "This field cannot be changed: " + field);
            }
        }
        Integer typed = null;
        boolean clear = false;
        if (body.containsKey("elapsedSeconds")) {
            Object raw = body.get("elapsedSeconds");
            if (raw == null) {
                clear = true;
            } else if (raw instanceof Number number && number.doubleValue() == Math.rint(number.doubleValue())
                    && number.doubleValue() >= 1 && number.doubleValue() <= Integer.MAX_VALUE) {
                typed = number.intValue();
            } else {
                return error(HttpStatus.BAD_REQUEST, "INVALID_ELAPSED_SECONDS",
                        "The time must be a whole number of seconds, or null to take a typed time back.");
            }
        }
        Boolean hidden = null;
        if (body.containsKey("hidden")) {
            if (!(body.get("hidden") instanceof Boolean flag)) {
                return error(HttpStatus.BAD_REQUEST, "INVALID_HIDDEN", "hidden must be true or false.");
            }
            hidden = flag;
        }
        try {
            return bestEfforts.change(runner.get(), id, distanceKey, new BestEffortService.Change(typed, clear, hidden))
                    .<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> error(HttpStatus.NOT_FOUND, "NOT_FOUND", "Best effort not found."));
        } catch (BestEffortService.InvalidChange refused) {
            return error(HttpStatus.BAD_REQUEST, "IMPLAUSIBLE_TIME", refused.getMessage());
        }
    }

    /** The other runs over the route this run took, with its pace against theirs. */
    @GetMapping("/activities/{id}/matches")
    public ResponseEntity<?> matches(
            @PathVariable("id") Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }
        long waiting = analyseWaiting(runner.get(), id);
        return routes.matchesOf(runner.get(), id)
                .<ResponseEntity<?>>map(matches -> ResponseEntity.ok(new MatchesResponse(waiting == 0, matches.groupId(), matches.count(),
                        matches.loop(), matches.distanceMeters(), matches.runs())))
                .orElseGet(() -> error(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found."));
    }

    /** @param complete false while some of the runner's runs have not been analysed, so more runs may join the route */
    public record MatchesResponse(boolean complete, Long groupId, int count, boolean loop, double distanceMeters,
                                  List<RouteMatchService.MatchRun> runs) {
    }

    /**
     * The runner's best efforts at one distance: the three best ever, the ten best of a year and the best of every year,
     * and what distances they have efforts for.
     *
     * @param distance a distance key such as {@code 5km}; the runner's 5 km (or their first distance) when left out
     * @param year     the year for the annual list; the latest year with an effort when left out
     */
    @GetMapping("/training/best-efforts")
    public ResponseEntity<?> analysis(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "distance", required = false) String distance,
            @RequestParam(value = "year", required = false) Integer year) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }
        if (distance != null && BestEffortDistances.byKey(distance).isEmpty()) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_PARAM", "Unknown distance: " + distance);
        }
        long waiting = analyseWaiting(runner.get(), null);
        return ResponseEntity.ok(bestEfforts.analysis(runner.get(), distance, year, waiting == 0));
    }

    /**
     * Makes sure the runs an answer depends on have been analysed, for a short while at most: the run asked about first,
     * then the others, newest first.
     *
     * @param activityId the run asked about, or null when the answer is about all of them
     * @return how many runs are still waiting; {@code Long.MAX_VALUE} when that could not be told because the analysis
     *         failed, so the screen says places may still change. The answer is still given from what has been worked
     *         out: the records are derived and the next read tries again.
     */
    private long analyseWaiting(Runner runner, Long activityId) {
        try {
            if (activityId != null) {
                coordinator.ensureAnalysed(runner, activityId);
            }
            return coordinator.ensurePending(runner, ANALYSIS_BUDGET, ANALYSIS_LIMIT);
        } catch (RuntimeException failure) {
            log.warn("Records could not be worked out before they were read ({})", failure.getClass().getSimpleName());
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
