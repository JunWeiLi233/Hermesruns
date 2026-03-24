package com.hermes.backend;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class LoginController {

    private final RunnerRepository runnerRepository;
    private final AuthService authService;
    private final LoginRateLimiter rateLimiter;
    private final SecretEncryptionService secretEncryptionService;
    private final GarminOAuthSettings garminOAuthSettings;
    private final AiUsageService aiUsageService;
    private final EmailVerificationService emailVerificationService;
    private final VerificationResendLimiter verificationResendLimiter;

    @Value("${app.billing.public-base-url:http://localhost:8080}")
    private String publicBaseUrl;

    public LoginController(RunnerRepository runnerRepository, AuthService authService, LoginRateLimiter rateLimiter,
                           SecretEncryptionService secretEncryptionService, GarminOAuthSettings garminOAuthSettings,
                           AiUsageService aiUsageService, EmailVerificationService emailVerificationService,
                           VerificationResendLimiter verificationResendLimiter) {
        this.runnerRepository = runnerRepository;
        this.authService = authService;
        this.rateLimiter = rateLimiter;
        this.secretEncryptionService = secretEncryptionService;
        this.garminOAuthSettings = garminOAuthSettings;
        this.aiUsageService = aiUsageService;
        this.emailVerificationService = emailVerificationService;
        this.verificationResendLimiter = verificationResendLimiter;
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
        if (!authService.isAdmin(runner) && !runner.isEmailVerified()) {
            return errorWithCode(HttpStatus.FORBIDDEN,
                    "Please verify your email before signing in. Check your inbox or request a new link.",
                    "EMAIL_NOT_VERIFIED");
        }
        String token = authService.issueSessionToken(runner);
        return ResponseEntity.ok(authResponse("Login successful.", token, runner, false));
    }

    // ==========================================
    // 2. THE SIGN-UP FUNCTION
    // ==========================================
    @GetMapping("/password-rules")
    public Map<String, Object> passwordRules() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("minLength", PasswordStrengthChecker.MIN_LENGTH);
        m.put("requireUppercase", true);
        m.put("requireLowercase", true);
        m.put("requireDigit", true);
        m.put("requireSpecial", true);
        m.put("specialCharsHint", "!@#$%^&*()_+-=[]{}|;:,.<>?/~`\"'");
        m.put("ruleIds", List.of("MIN_LENGTH", "UPPERCASE", "LOWERCASE", "DIGIT", "SPECIAL", "NOT_COMMON"));
        return m;
    }

    @GetMapping("/verify-email")
    public RedirectView verifyEmail(@RequestParam(required = false) String token) {
        String base = trimPublicBase();
        if (token == null || token.isBlank()) {
            return new RedirectView(base + "/login?error=verify_invalid");
        }
        String hash = authService.hashPlainToken(token.trim());
        Optional<Runner> opt = runnerRepository.findByEmailVerificationTokenHash(hash);
        if (opt.isEmpty() || opt.get().isDeleted()) {
            return new RedirectView(base + "/login?error=verify_invalid");
        }
        Runner runner = opt.get();
        LocalDateTime exp = runner.getEmailVerificationExpiresAt();
        if (exp == null || exp.isBefore(LocalDateTime.now())) {
            return new RedirectView(base + "/login?error=verify_expired");
        }
        runner.setEmailVerified(true);
        emailVerificationService.clearVerificationFields(runner);
        runnerRepository.save(runner);
        return new RedirectView(base + "/login?verified=1");
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<?> resendVerification(@RequestBody(required = false) Map<String, String> body,
                                                HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        if (!verificationResendLimiter.allow(ip)) {
            return error(HttpStatus.TOO_MANY_REQUESTS, "Too many requests. Try again later.");
        }

        String email = body == null ? null : authService.normalizeEmail(body.get("email"));
        String generic = "If an unverified account exists for that address, a new verification email was sent.";

        if (email == null || email.isBlank() || !PasswordStrengthChecker.looksLikeEmail(email)) {
            return ResponseEntity.ok(Map.of("message", generic));
        }

        Optional<Runner> opt = runnerRepository.findByEmailIgnoreCase(email);
        if (opt.isEmpty() || opt.get().isDeleted() || opt.get().isEmailVerified()) {
            return ResponseEntity.ok(Map.of("message", generic));
        }

        if (!emailVerificationService.isMailConfigured()) {
            return error(HttpStatus.SERVICE_UNAVAILABLE, "Email delivery is not configured on this server.");
        }

        try {
            emailVerificationService.resendVerification(opt.get());
        } catch (Exception e) {
            return error(HttpStatus.SERVICE_UNAVAILABLE, "Could not send email. Try again later.");
        }

        return ResponseEntity.ok(Map.of("message", generic));
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody Runner signupRequest) {
        String normalizedEmail = authService.normalizeEmail(signupRequest.getEmail());
        String rawPassword = signupRequest.getPassword();

        if (normalizedEmail == null || normalizedEmail.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "Email is required.");
        }

        if (!PasswordStrengthChecker.looksLikeEmail(normalizedEmail)) {
            return error(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
        }

        PasswordStrengthChecker.Result pw = PasswordStrengthChecker.check(rawPassword);
        if (!pw.ok()) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("error", "Password does not meet strength requirements.");
            err.put("code", "WEAK_PASSWORD");
            err.put("failedRules", pw.failedRuleIds());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(err);
        }

        if (runnerRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            return error(HttpStatus.CONFLICT, "Email already in use.");
        }

        Runner runner = new Runner();
        runner.setEmail(normalizedEmail);
        runner.setStatus("ACTIVE");
        runner.setRole("USER");
        authService.storePassword(runner, rawPassword);

        Map<String, Object> body = new LinkedHashMap<>();
        if (!emailVerificationService.isMailConfigured()) {
            runner.setEmailVerified(true);
            emailVerificationService.clearVerificationFields(runner);
            runnerRepository.save(runner);
            body.put("message", "Account created. You can sign in (email verification is skipped because mail is not configured).");
            body.put("verificationRequired", false);
            return ResponseEntity.ok(body);
        }

        runner.setEmailVerified(false);
        try {
            emailVerificationService.sendVerificationToNewRunner(runner);
        } catch (Exception e) {
            return error(HttpStatus.SERVICE_UNAVAILABLE, "Could not send verification email. Try again later.");
        }

        body.put("message", "Check your email to verify your address before signing in.");
        body.put("verificationRequired", true);
        body.put("email", normalizedEmail);
        return ResponseEntity.ok(body);
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
                .map(runner -> new RunnerSummary(runner.getId(), runner.getEmail(), runner.getRole(), runner.getStatus(), runner.getSubscriptionTier()))
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

        return ResponseEntity.ok(authResponse("Admin login successful.", token, runner, true));
    }

    // ==========================================
    // 6. ADMIN: GRANT / REVOKE PRO SUBSCRIPTION
    // ==========================================
    @PostMapping("/runners/{id}/subscription")
    public ResponseEntity<?> updateSubscription(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody Map<String, Object> body) {

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
        String action = (String) body.getOrDefault("action", "");

        if ("grant_pro".equals(action)) {
            int months = body.containsKey("months") ? ((Number) body.get("months")).intValue() : 1;
            aiUsageService.grantPro(runner, months);
            return ResponseEntity.ok(messageResponse("Pro granted for " + months + " month(s)."));
        } else if ("revoke_pro".equals(action)) {
            aiUsageService.revokePro(runner);
            return ResponseEntity.ok(messageResponse("Pro revoked."));
        }

        return error(HttpStatus.BAD_REQUEST, "Invalid action. Use 'grant_pro' or 'revoke_pro'.");
    }

    // --- Helper Methods ---

    private Map<String, String> authResponse(String message, String token, Runner runner, boolean adminLogin) {
        Map<String, String> response = new HashMap<>();
        response.put("message", message);
        response.put("token", token);
        response.put("email", runner.getEmail());
        response.put("role", runner.getRole());
        if (!adminLogin) {
            boolean garminReady = garminOAuthSettings.canConnectGarmin(secretEncryptionService, runner);
            boolean usesServerKeys = secretEncryptionService.isConfigured() && garminOAuthSettings.usesServerKeysFor(runner);
            response.put("garminConnectAvailable", Boolean.toString(garminReady));
            response.put("garminUsesServerGarminKeys", Boolean.toString(usesServerKeys));
        }
        return response;
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("error", message);
        return ResponseEntity.status(status).body(response);
    }

    private ResponseEntity<Map<String, String>> errorWithCode(HttpStatus status, String message, String code) {
        Map<String, String> response = new HashMap<>();
        response.put("error", message);
        response.put("code", code);
        return ResponseEntity.status(status).body(response);
    }

    private String trimPublicBase() {
        String u = publicBaseUrl == null ? "http://localhost:8080" : publicBaseUrl.trim();
        while (u.endsWith("/")) {
            u = u.substring(0, u.length() - 1);
        }
        return u.isEmpty() ? "http://localhost:8080" : u;
    }

    private Map<String, String> messageResponse(String message) {
        Map<String, String> response = new HashMap<>();
        response.put("message", message);
        return response;
    }

    private record RunnerSummary(Long id, String email, String role, String status, String subscriptionTier) {
    }
}
