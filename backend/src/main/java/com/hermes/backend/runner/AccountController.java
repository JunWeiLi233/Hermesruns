package com.hermes.backend.runner;

import com.hermes.backend.auth.AuthService;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The runner's rights over their own data: download a copy, and delete the account with everything in
 * it. Strava's API Policy requires both, and so does basic data hygiene.
 */
@RestController
@RequestMapping("/api/account")
public class AccountController {

    /** The exact text the runner must type, so a stray click or a script cannot delete an account. */
    static final String DELETE_CONFIRMATION = "DELETE";

    public record DeleteAccountBody(String confirm) {}

    private final AuthService authService;
    private final AccountExportService exports;
    private final AccountDeletionService deletion;

    public AccountController(AuthService authService, AccountExportService exports, AccountDeletionService deletion) {
        this.authService = authService;
        this.exports = exports;
        this.deletion = deletion;
    }

    /**
     * A ZIP of the runner's data. {@code tracks=true} adds one GPX file per run, which can be large.
     *
     * <p>The ZIP is written straight to the servlet response on the request thread. It is not returned as
     * a {@code StreamingResponseBody}: that runs as an async request, which Spring MVC times out after
     * the async timeout (a big export would be cut off mid-file) and which re-runs the security filters
     * on the async dispatch after the response is already committed. {@link AccountExportService#tryBegin}
     * allows one export at a time, so this holds at most one servlet thread.</p>
     */
    @GetMapping("/export")
    public ResponseEntity<?> exportData(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "tracks", defaultValue = "false") boolean tracks,
            HttpServletResponse response) throws IOException {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }
        if (!exports.tryBegin()) {
            return error(HttpStatus.TOO_MANY_REQUESTS, "EXPORT_BUSY", "An export is already running. Try again in a few minutes.");
        }
        try {
            response.setStatus(HttpStatus.OK.value());
            response.setContentType("application/zip");
            response.setHeader(HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=\"" + AccountExportService.filename(LocalDate.now()) + "\"");
            response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
            exports.write(runner.get(), tracks, response.getOutputStream());
            response.flushBuffer();
        } finally {
            exports.end();
        }
        return null;
    }

    /**
     * Deletes the signed-in runner's account and all their data. Administrator accounts are refused here:
     * removing one is an operator decision, not a self-service click.
     */
    @DeleteMapping
    public ResponseEntity<?> deleteAccount(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) DeleteAccountBody body) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }
        if (authService.isAdmin(runner.get())) {
            return error(HttpStatus.FORBIDDEN, "ADMIN_ACCOUNT", "Administrator accounts cannot be deleted here.");
        }
        if (body == null || !DELETE_CONFIRMATION.equals(body.confirm())) {
            return error(HttpStatus.BAD_REQUEST, "CONFIRMATION_REQUIRED", "Type " + DELETE_CONFIRMATION + " to confirm.");
        }
        deletion.deleteAccount(runner.get().getId());
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    private static ResponseEntity<Map<String, String>> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message, "code", code));
    }
}
