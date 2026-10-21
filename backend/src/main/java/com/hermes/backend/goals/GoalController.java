package com.hermes.backend.goals;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.function.Supplier;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The signed-in runner's goals. Own data only: the runner comes from the session, never from the request, and a goal that
 * is not theirs is answered like one that does not exist. Every change answers with the whole list as it is afterwards.
 */
@RestController
@RequestMapping("/api/goals")
public class GoalController {

    private final AuthService authService;
    private final GoalService service;

    public GoalController(AuthService authService, GoalService service) {
        this.authService = authService;
        this.service = service;
    }

    /** @param runId a run of the caller's: each goal then says what that run adds to it */
    @GetMapping
    public ResponseEntity<?> list(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "runId", required = false) Long runId) {
        return signedIn(authorizationHeader, runner -> ResponseEntity.ok(service.list(runner, runId)));
    }

    /** Goals worth setting, from the runner's own recent running, each with what it was worked out from. */
    @GetMapping("/suggestions")
    public ResponseEntity<?> suggestions(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        return signedIn(authorizationHeader, runner -> ResponseEntity.ok(service.suggest(runner)));
    }

    /** Body: {@code period} (WEEK, MONTH or YEAR), {@code metric} (DISTANCE, TIME, COUNT or ELEVATION), {@code target} (km, seconds, runs or metres). */
    @PostMapping
    public ResponseEntity<?> create(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) Map<String, Object> body) {
        return signedIn(authorizationHeader, runner -> {
            Map<String, Object> given = body == null ? Map.of() : body;
            return guarded(() -> ResponseEntity.status(HttpStatus.CREATED)
                    .body(service.create(runner, text(given.get("period")), text(given.get("metric")), given.get("target"))));
        });
    }

    /** Body: {@code target}. The period and the metric of a goal do not change: delete it and set another. */
    @PutMapping("/{id}")
    public ResponseEntity<?> change(
            @PathVariable("id") Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) Map<String, Object> body) {
        return signedIn(authorizationHeader, runner -> {
            Map<String, Object> given = body == null ? Map.of() : body;
            return guarded(() -> ResponseEntity.ok(service.changeTarget(runner, id, given.get("target"))));
        });
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @PathVariable("id") Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        return signedIn(authorizationHeader, runner -> guarded(() -> ResponseEntity.ok(service.delete(runner, id))));
    }

    private ResponseEntity<?> signedIn(String authorizationHeader, Function<Runner, ResponseEntity<?>> action) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }
        return action.apply(runner.get());
    }

    private static ResponseEntity<?> guarded(Supplier<ResponseEntity<?>> action) {
        try {
            return action.get();
        } catch (IllegalArgumentException refused) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_GOAL", refused.getMessage());
        } catch (GoalService.GoalConflictException conflict) {
            return error(HttpStatus.CONFLICT, "DUPLICATE_GOAL", conflict.getMessage());
        } catch (GoalService.GoalNotFoundException missing) {
            return error(HttpStatus.NOT_FOUND, "NOT_FOUND", missing.getMessage());
        }
    }

    private static String text(Object value) {
        return value instanceof String string ? string : null;
    }

    private static ResponseEntity<Map<String, String>> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message, "code", code));
    }
}
