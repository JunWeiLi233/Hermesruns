package com.hermes.backend;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class LoginController {

    private final RunnerRepository runnerRepository;
    private final AuthService authService;
    private final LoginRateLimiter rateLimiter;

    public LoginController(RunnerRepository runnerRepository, AuthService authService, LoginRateLimiter rateLimiter) {
        this.runnerRepository = runnerRepository;
        this.authService = authService;
        this.rateLimiter = rateLimiter;
    }

    // ==========================================
    // 1. STANDARD LOGIN
    // ==========================================
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Runner loginRequest, HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        if (rateLimiter.isBlocked(ip)) {
            return error(HttpStatus.TOO_MANY_REQUESTS, "Too many failed attempts. Try again in 15 minutes.");
        }

        Optional<Runner> runnerOptional = authService.authenticate(loginRequest.getEmail(), loginRequest.getPassword());
        if (runnerOptional.isEmpty()) {
            rateLimiter.recordFailure(ip);
            return error(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
        }

        rateLimiter.recordSuccess(ip);
        Runner runner = runnerOptional.get();
        String token = authService.issueSessionToken(runner);
        return ResponseEntity.ok(authResponse("Login successful.", token, runner));
    }

    // ==========================================
    // 2. THE SIGN-UP FUNCTION
    // ==========================================
    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody Runner signupRequest) {
        String normalizedEmail = authService.normalizeEmail(signupRequest.getEmail());
        String rawPassword = signupRequest.getPassword();

        if (normalizedEmail == null || normalizedEmail.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "Email is required.");
        }

        if (rawPassword == null || rawPassword.length() < 8) {
            return error(HttpStatus.BAD_REQUEST, "Password must be at least 8 characters.");
        }

        if (runnerRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            return error(HttpStatus.CONFLICT, "Email already in use.");
        }

        Runner runner = new Runner();
        runner.setEmail(normalizedEmail);
        runner.setStatus("ACTIVE");
        runner.setRole("USER");

        authService.storePassword(runner, rawPassword);
        runnerRepository.save(runner);

        return ResponseEntity.ok(messageResponse("User registered successfully."));
    }

    // ==========================================
    // 3. ADMIN ENDPOINT: SECURE GET ALL RUNNERS
    // ==========================================
    @GetMapping("/runners")
    public ResponseEntity<?> getAllRunners(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        // Uses Contributor's secure token check instead of URL params
        Optional<Runner> adminOptional = authService.findByAuthorizationHeader(authorizationHeader)
                .filter(authService::isAdmin);

        if (adminOptional.isEmpty()) {
            System.out.println("🚨 INTRUSION ATTEMPT: Non-admin tried to access the database!");
            return error(HttpStatus.FORBIDDEN, "Admin privileges required.");
        }

        List<Runner> activeRunners = runnerRepository.findByDeletedFalseOrderByIdAsc();
        for (Runner r : activeRunners) {
            String currentRole = r.getRole();
            if (currentRole == null || currentRole.equalsIgnoreCase("null") || currentRole.trim().isEmpty()) {
                r.setRole("USER");
                runnerRepository.save(r);
            }
        }

        // Convert to summary list for clean API response
        List<RunnerSummary> runners = activeRunners.stream()
                .map(runner -> new RunnerSummary(runner.getId(), runner.getEmail(), runner.getRole(), runner.getStatus()))
                .toList();

        return ResponseEntity.ok(runners);
    }

    // ==========================================
    // 4. ADMIN ENDPOINT: SECURE SOFT DELETE
    // ==========================================
    @DeleteMapping("/runners/{id}")
    public ResponseEntity<?> deleteRunner(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> adminOptional = authService.findByAuthorizationHeader(authorizationHeader)
                .filter(authService::isAdmin);

        if (adminOptional.isEmpty()) {
            return error(HttpStatus.FORBIDDEN, "Admin privileges required.");
        }

        Optional<Runner> runnerOptional = runnerRepository.findById(id);
        if (runnerOptional.isEmpty()) {
            return error(HttpStatus.NOT_FOUND, "Runner not found.");
        }

        Runner runner = runnerOptional.get();
        runner.setDeleted(true);
        runner.setStatus("DELETED");
        runner.setSessionToken(null);
        runnerRepository.save(runner);

        return ResponseEntity.ok(messageResponse("Runner successfully removed."));
    }

    // ==========================================
    // 5. MASTER KEY: SECURE ADMIN LOGIN
    // ==========================================
    @PostMapping("/admin-login")
    public ResponseEntity<?> adminLogin(
            @RequestBody Map<String, String> body,
            HttpServletRequest request
    ) {
        String ip = request.getRemoteAddr();
        if (rateLimiter.isBlocked(ip)) {
            return error(HttpStatus.TOO_MANY_REQUESTS, "Too many failed attempts. Try again in 15 minutes.");
        }

        String email = body.getOrDefault("email", "");
        String password = body.getOrDefault("password", "");
        Optional<Runner> runnerOptional = authService.authenticate(email, password)
                .filter(authService::isAdmin);

        if (runnerOptional.isEmpty()) {
            rateLimiter.recordFailure(ip);
            return error(HttpStatus.UNAUTHORIZED, "Invalid admin credentials.");
        }

        rateLimiter.recordSuccess(ip);

        Runner runner = runnerOptional.get();
        String token = authService.issueSessionToken(runner);

        return ResponseEntity.ok(authResponse("Admin login successful.", token, runner));
    }

    // --- Helper Methods ---

    private Map<String, String> authResponse(String message, String token, Runner runner) {
        Map<String, String> response = new HashMap<>();
        response.put("message", message);
        response.put("token", token);
        response.put("email", runner.getEmail());
        response.put("role", runner.getRole());
        return response;
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("error", message);
        return ResponseEntity.status(status).body(response);
    }

    private Map<String, String> messageResponse(String message) {
        Map<String, String> response = new HashMap<>();
        response.put("message", message);
        return response;
    }

    private record RunnerSummary(Long id, String email, String role, String status) {
    }
}
