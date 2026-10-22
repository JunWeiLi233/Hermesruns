package com.hermes.backend.coaching;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.TrainingZonesService;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The effort score and heart-rate zones of one of the signed-in runner's runs. */
@RestController
@RequestMapping("/api/activities")
public class TrainingMetricsController {

    private final AuthService authService;
    private final TrainingMetricsService service;
    private final TrainingZonesService zonesService;
    private final TrainingMetricsBlockService blocks;

    public TrainingMetricsController(AuthService authService, TrainingMetricsService service, TrainingZonesService zonesService,
                                     TrainingMetricsBlockService blocks) {
        this.authService = authService;
        this.service = service;
        this.zonesService = zonesService;
        this.blocks = blocks;
    }

    @GetMapping("/training-metrics/block")
    public ResponseEntity<?> block(@RequestHeader(value="Authorization",required=false) String authorizationHeader,
                                   @RequestParam(value="days",defaultValue="28") int days) {
        Optional<Runner> runner=authService.findByAuthorizationHeader(authorizationHeader);
        if(runner.isEmpty())return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error","Invalid or expired session token.","code","UNAUTHORIZED"));
        if(days!=7&&days!=28)return ResponseEntity.badRequest()
                .body(Map.of("error","Select a 7 or 28 calendar-day window.","code","INVALID_WINDOW"));
        return ResponseEntity.ok(blocks.read(runner.get(),days));
    }

    @GetMapping("/{id}/training-metrics")
    public ResponseEntity<?> trainingMetrics(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @PathVariable("id") Long id) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or expired session token.", "code", "UNAUTHORIZED"));
        }
        // freshMetrics only finds a run that belongs to this runner, so another runner's id looks like no run at all.
        Optional<TrainingMetricsService.RunMetrics> found = service.freshMetrics(runner.get(), id);
        if (found.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Run not found.", "code", "NOT_FOUND"));
        }
        TrainingMetricsService.RunMetrics run = found.get();
        return ResponseEntity.ok(TrainingMetricsResponse.of(run.activity(), run.metrics(), zonesService.resolve(runner.get())));
    }
}
