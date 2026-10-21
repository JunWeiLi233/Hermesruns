package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The pace analysis of one of the signed-in runner's runs: splits, a smoothed pace line and grade-adjusted pace.
 * It has a controller of its own because {@link ActivityController} is held to a method-count ceiling.
 *
 * <p>Only the points that say when they were recorded are used. The other analytics give the rest a time spread
 * evenly along the distance, which would draw an even pace the runner never ran, and for a track with no times at all
 * (a GPX file of a route) an even pace for the whole run. A run where fewer than half of the points carry a time has
 * no pace profile.</p>
 *
 * <p>The answer is worked out from the run's stored stream on every request (one run's points, a few
 * milliseconds), so there is nothing to keep in step when the elevation of a run is recalibrated. It does not fetch a
 * missing Strava stream: the points, analytics and telemetry requests the run page makes already do, and the page asks
 * for the pace profile once they have.</p>
 */
@RestController
@RequestMapping("/api/activities")
public class ActivityPaceProfileController {

    private final AuthService authService;
    private final ActivityDataAccess activityDataAccess;

    public ActivityPaceProfileController(AuthService authService, ActivityDataAccess activityDataAccess) {
        this.authService = authService;
        this.activityDataAccess = activityDataAccess;
    }

    /** 404 for a run that is not the caller's, without saying whether it exists. */
    @GetMapping("/{id}/pace-profile")
    public ResponseEntity<?> paceProfile(
            @PathVariable("id") Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }
        Optional<Activity> found = activityDataAccess.findActivityForRunner(id, runner.get());
        if (found.isEmpty()) {
            return error(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
        }
        Activity activity = found.get();
        List<Object[]> rows = activityDataAccess.findAnalyticsSamplesByActivityId(activity.getId());
        List<Object[]> timed = rows.stream().filter(row -> row != null && row.length > 2 && row[2] != null).toList();
        if (timed.size() < Math.max(2, rows.size() / 2)) {
            return ResponseEntity.ok(PaceProfileResponse.noStream());
        }
        List<ActivityAnalyticsHelper.SamplePoint> points = ActivityTelemetryResponseBuilder.buildAnalyticsSamplePoints(timed, activity);
        return ResponseEntity.ok(PaceProfileCalculator.compute(points));
    }

    private static ResponseEntity<Map<String, String>> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message, "code", code));
    }
}
