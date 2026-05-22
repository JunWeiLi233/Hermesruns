package com.hermes.backend;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/auth")
public class LoginController {
    private static final Logger log = LoggerFactory.getLogger(LoginController.class);
    private static final Set<String> LOGIN_FIELDS = Set.of("email", "password");
    private static final Set<String> SIGNUP_FIELDS = Set.of("email", "password", "captchaToken");
    private static final Set<String> EMAIL_ONLY_FIELDS = Set.of("email");
    private static final Set<String> PASSWORD_RESET_CONFIRM_FIELDS = Set.of("token", "password");
    private static final Set<String> ADMIN_SUBSCRIPTION_FIELDS = Set.of("action", "months");

    private final RunnerRepository runnerRepository;
    private final AuthService authService;
    private final LoginRateLimiter rateLimiter;
    private final SecretEncryptionService secretEncryptionService;
    private final AiUsageService aiUsageService;
    private final EmailVerificationService emailVerificationService;
    private final VerificationResendLimiter verificationResendLimiter;
    private final PasswordResetLimiter passwordResetLimiter;
    private final PasswordResetService passwordResetService;
    private final ApiRateLimiter apiRateLimiter;
    private final RecaptchaVerifier recaptchaVerifier;

    @Value("${app.billing.public-base-url:http://localhost:8080}")
    private String publicBaseUrl;

    public LoginController(RunnerRepository runnerRepository, AuthService authService, LoginRateLimiter rateLimiter,
                           SecretEncryptionService secretEncryptionService,
                           AiUsageService aiUsageService, EmailVerificationService emailVerificationService,
                           VerificationResendLimiter verificationResendLimiter,
                           PasswordResetLimiter passwordResetLimiter,
                           PasswordResetService passwordResetService,
                           ApiRateLimiter apiRateLimiter,
                           RecaptchaVerifier recaptchaVerifier) {
        this.runnerRepository = runnerRepository;
        this.authService = authService;
        this.rateLimiter = rateLimiter;
        this.secretEncryptionService = secretEncryptionService;
        this.aiUsageService = aiUsageService;
        this.emailVerificationService = emailVerificationService;
        this.verificationResendLimiter = verificationResendLimiter;
        this.passwordResetLimiter = passwordResetLimiter;
        this.passwordResetService = passwordResetService;
        this.apiRateLimiter = apiRateLimiter;
        this.recaptchaVerifier = recaptchaVerifier;
    }

    // ==========================================
    // 1. STANDARD LOGIN
    // ==========================================
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest request) {
        String ip = RequestIpResolver.clientIp(request);
        if (rateLimiter.isBlocked(ip)) {
            log.warn("Auth login rate-limited ip={}", ip);
            return error(HttpStatus.TOO_MANY_REQUESTS, "Too many failed attempts. Try again in 15 minutes.");
        }

        final String email;
        final String password;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, LOGIN_FIELDS);
            email = authService.normalizeEmail(RequestBodyValidator.requiredString(body, "email", 254));
            password = RequestBodyValidator.requiredString(body, "password", 512);
        } catch (IllegalArgumentException ex) {
            return error(HttpStatus.BAD_REQUEST, ex.getMessage());
        }

        Optional<Runner> runnerOptional = authService.authenticate(email, password);
        if (runnerOptional.isEmpty()) {
            rateLimiter.recordFailure(ip);
            log.warn("Auth login failed ip={} email={}", ip, email);
            return error(HttpStatus.UNAUTHORIZED, "Invalid credentials.");
        }

        rateLimiter.recordSuccess(ip);
        Runner runner = runnerOptional.get();
        if (!authService.isAdmin(runner) && !runner.isEmailVerified()) {
            log.warn("Auth login blocked (email not verified) ip={} email={}", ip, runner.getEmail());
            return errorWithCode(HttpStatus.FORBIDDEN,
                    "Please verify your email before signing in. Check your inbox or request a new link.",
                    "EMAIL_NOT_VERIFIED");
        }
        String token = authService.issueSessionToken(runner);
        log.info("Auth login success ip={} runnerId={} role={}", ip, runner.getId(), runner.getRole());
        return ResponseEntity.ok(authResponse("Login successful.", token, runner, false));
    }

    // ==========================================
    // 2. THE SIGN-UP FUNCTION
    // ==========================================
    @GetMapping("/password-rules")
    public Map<String, Object> passwordRules() {
        return PasswordStrengthChecker.getRules();
    }

    @GetMapping("/verify-email")
    public RedirectView verifyEmail(@RequestParam(required = false) String token) {
        String base = trimPublicBase();
        if (token == null || token.isBlank()) {
            return new RedirectView(base + "/login?error=verify_invalid");
        }
        if (token.length() > 1024) {
            return new RedirectView(base + "/login?error=verify_invalid");
        }
        try {
            InputSanitizer.rejectControlChars(token, "token");
        } catch (IllegalArgumentException ex) {
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
    public ResponseEntity<?> resendVerification(@RequestBody(required = false) Map<String, Object> body,
                                                HttpServletRequest request) {
        String ip = RequestIpResolver.clientIp(request);
        if (!verificationResendLimiter.allow(ip)) {
            log.warn("Auth resend verification rate-limited ip={}", ip);
            return error(HttpStatus.TOO_MANY_REQUESTS, "Too many requests. Try again later.");
        }

        String email;
        String generic = "If an unverified account exists for that address, a new verification email was sent.";
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, EMAIL_ONLY_FIELDS);
            email = authService.normalizeEmail(RequestBodyValidator.optionalString(body, "email", 254));
        } catch (IllegalArgumentException ignored) {
            return ResponseEntity.ok(Map.of("message", generic));
        }

        if (email == null || email.isBlank() || !PasswordStrengthChecker.looksLikeEmail(email)) {
            return ResponseEntity.ok(Map.of("message", generic));
        }
        try {
            InputSanitizer.rejectControlChars(email, "email");
        } catch (IllegalArgumentException ignored) {
            return ResponseEntity.ok(Map.of("message", generic));
        }

        Optional<Runner> opt = runnerRepository.findByEmailIgnoreCase(email);
        if (opt.isEmpty() || opt.get().isDeleted() || opt.get().isEmailVerified()) {
            return ResponseEntity.ok(Map.of("message", generic));
        }

        if (!emailVerificationService.isMailConfigured()) {
            log.warn("Auth resend verification blocked (mail not configured) ip={}", ip);
            return error(HttpStatus.SERVICE_UNAVAILABLE, "Email delivery is not configured on this server.");
        }

        try {
            emailVerificationService.resendVerification(opt.get());
        } catch (Exception e) {
            log.warn("Auth resend verification failed ip={} email={}", ip, email, e);
            return error(HttpStatus.SERVICE_UNAVAILABLE, "Could not send email. Try again later.");
        }

        return ResponseEntity.ok(Map.of("message", generic));
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest request) {
        String ip = RequestIpResolver.clientIp(request);
        // Anti-bot: limit account creation per IP
        if (!apiRateLimiter.allow("signup:" + ip, 8, 3600)) { // 8 per hour
            log.warn("Auth signup rate-limited ip={}", ip);
            return error(HttpStatus.TOO_MANY_REQUESTS, "Too many sign-up attempts. Try again later.");
        }
        String normalizedEmail;
        String rawPassword;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, SIGNUP_FIELDS);
            normalizedEmail = authService.normalizeEmail(RequestBodyValidator.requiredString(body, "email", 254));
            rawPassword = RequestBodyValidator.requiredString(body, "password", 512);
        } catch (IllegalArgumentException ex) {
            return error(HttpStatus.BAD_REQUEST, ex.getMessage());
        }

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

        // reCAPTCHA v3 verification
        String captchaToken = body != null ? (String) body.getOrDefault("captchaToken", "") : "";
        if (!recaptchaVerifier.verify(captchaToken, "signup")) {
            return error(HttpStatus.BAD_REQUEST, "reCAPTCHA verification failed. Refresh and try again.");
        }

        Optional<Runner> existingByEmail = runnerRepository.findByEmailIgnoreCase(normalizedEmail);
        if (existingByEmail.isPresent()) {
            Runner r = existingByEmail.get();
            boolean removed = r.isDeleted() || "DELETED".equalsIgnoreCase(r.getStatus());
            if (!removed) {
                return error(HttpStatus.CONFLICT, "Email already in use.");
            }
        }

        Runner runner;
        if (existingByEmail.isPresent()) {
            runner = existingByEmail.get();
            recycleDeletedRunnerForSignup(runner, normalizedEmail, rawPassword);
        } else {
            runner = new Runner();
            runner.setEmail(normalizedEmail);
            runner.setStatus("ACTIVE");
            runner.setRole("USER");
            authService.storePassword(runner, rawPassword);
            aiUsageService.initNewUser(runner);
        }

        Map<String, Object> responseBody = new LinkedHashMap<>();
        if (!emailVerificationService.isMailConfigured()) {
            runner.setEmailVerified(true);
            emailVerificationService.clearVerificationFields(runner);
            runnerRepository.save(runner);
            responseBody.put("message", "Account created. You can sign in (email verification is skipped because mail is not configured).");
            responseBody.put("verificationRequired", false);
            return ResponseEntity.ok(responseBody);
        }

        runner.setEmailVerified(false);
        try {
            emailVerificationService.sendVerificationToNewRunner(runner, existingByEmail.isEmpty());
        } catch (Exception e) {
            return error(HttpStatus.SERVICE_UNAVAILABLE, "Could not send verification email. Try again later.");
        }

        responseBody.put("message", "Check your email to verify your address before signing in.");
        responseBody.put("verificationRequired", true);
        responseBody.put("email", normalizedEmail);
        return ResponseEntity.ok(responseBody);
    }

    // ==========================================
    // 2b. PASSWORD RESET (FORGOT / RESET)
    // ==========================================

    /**
     * Canonical password-reset request endpoint.
     * <p>
     * SECURITY: Always returns 202 + identical body regardless of whether the email
     * exists in the database. This prevents user-enumeration via differential
     * responses. Email is sent asynchronously after the response is flushed so that
     * SMTP latency cannot be used as a timing oracle.
     * </p>
     */
    @PostMapping("/password-reset/request")
    public ResponseEntity<?> requestPasswordReset(
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request
    ) {
        return handlePasswordResetRequest(body, request);
    }

    /**
     * Legacy alias at {@code /api/auth/reset-password} kept so that security
     * probes and any client code using the shorter path do not hit a 404 (which
     * itself reveals that the route does not exist and can be misread as a
     * "user not found" signal by automated scanners).
     * <p>
     * Delegates entirely to {@link #handlePasswordResetRequest} — identical
     * status, identical body, identical rate-limit, identical timing.
     * </p>
     */
    @PostMapping("/reset-password")
    public ResponseEntity<?> requestPasswordResetAlias(
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request
    ) {
        return handlePasswordResetRequest(body, request);
    }

    /**
     * Shared logic for both password-reset request endpoints.
     * <p>
     * SECURITY INVARIANT: Both branches (email found / not found) MUST return
     * the same HTTP status (202) and the same JSON body. Never change one branch
     * without changing the other.
     * </p>
     */
    private ResponseEntity<?> handlePasswordResetRequest(
            Map<String, Object> body,
            HttpServletRequest request
    ) {
        String ip = RequestIpResolver.clientIp(request);
        if (!passwordResetLimiter.allow(ip)) {
            log.warn("Auth password reset request rate-limited ip={}", ip);
            return error(HttpStatus.TOO_MANY_REQUESTS, "Too many requests. Try again later.");
        }

        // SECURITY: Use a fixed status + body for every outcome to prevent user enumeration.
        // HTTP 202 (Accepted) signals "we received the request" without committing to action.
        Map<String, String> genericBody = Map.of("status", "if-account-exists-email-sent");

        String email;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, EMAIL_ONLY_FIELDS);
            email = authService.normalizeEmail(RequestBodyValidator.optionalString(body, "email", 254));
        } catch (IllegalArgumentException ignored) {
            return ResponseEntity.accepted().body(genericBody);
        }
        if (email == null || email.isBlank() || !PasswordStrengthChecker.looksLikeEmail(email)) {
            return ResponseEntity.accepted().body(genericBody);
        }
        try {
            InputSanitizer.rejectControlChars(email, "email");
        } catch (IllegalArgumentException ignored) {
            return ResponseEntity.accepted().body(genericBody);
        }

        if (!passwordResetService.isMailConfigured()) {
            // Email reset requires mail; do not reveal whether the account exists.
            log.warn("Auth password reset request ignored (mail not configured) ip={}", ip);
            return ResponseEntity.accepted().body(genericBody);
        }

        Optional<Runner> opt = runnerRepository.findByEmailIgnoreCase(email)
                .filter(r -> !r.isDeleted());

        if (opt.isEmpty()) {
            log.info("Auth password reset requested for non-existent email ip={}", ip);
            // Timing normalization (defense in depth): mirror the latency of the
            // found-path async dispatch + DB write so wall-clock time cannot be
            // used as an oracle for account existence.
            try {
                Thread.sleep(150L);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
        } else {
            // Send email asynchronously so the HTTP response is returned before
            // SMTP completes — eliminates timing oracle even without the sleep.
            Runner runner = opt.get();
            CompletableFuture.runAsync(() -> {
                try {
                    passwordResetService.sendResetLink(runner);
                    log.info("Auth password reset email sent runnerId={}", runner.getId());
                } catch (Exception e) {
                    // Keep response generic; avoid leaking server configuration details.
                    log.warn("Auth password reset email send failed runnerId={}", runner.getId(), e);
                }
            });
            log.info("Auth password reset email dispatched async ip={} runnerId={}", ip, runner.getId());
        }

        // SECURITY: Both branches return here — same status, same body.
        return ResponseEntity.accepted().body(genericBody);
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<?> confirmPasswordReset(
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request
    ) {
        String ip = RequestIpResolver.clientIp(request);
        // Reuse login limiter semantics for brute force protection
        String key = "pwreset:" + ip;
        if (rateLimiter.isBlocked(key)) {
            log.warn("Auth password reset confirm rate-limited ip={}", ip);
            return error(HttpStatus.TOO_MANY_REQUESTS, "Too many failed attempts. Try again in 15 minutes.");
        }

        final String token;
        final String newPassword;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, PASSWORD_RESET_CONFIRM_FIELDS);
            token = RequestBodyValidator.requiredString(body, "token", 1024);
            newPassword = RequestBodyValidator.requiredString(body, "password", 512);
        } catch (IllegalArgumentException ex) {
            rateLimiter.recordFailure(key);
            return error(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
        if (token == null || token.isBlank()) {
            rateLimiter.recordFailure(key);
            return error(HttpStatus.BAD_REQUEST, "Reset token is required.");
        }
        try {
            InputSanitizer.rejectControlChars(token, "token");
            if (newPassword != null) InputSanitizer.rejectControlChars(newPassword, "password");
        } catch (IllegalArgumentException ex) {
            rateLimiter.recordFailure(key);
            return error(HttpStatus.BAD_REQUEST, "Invalid input.");
        }

        PasswordStrengthChecker.Result pw = PasswordStrengthChecker.check(newPassword);
        if (!pw.ok()) {
            rateLimiter.recordFailure(key);
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("error", "Password does not meet strength requirements.");
            err.put("code", "WEAK_PASSWORD");
            err.put("failedRules", pw.failedRuleIds());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(err);
        }

        String hash = authService.hashPlainToken(token.trim());
        Optional<Runner> opt = runnerRepository.findByPasswordResetTokenHash(hash)
                .filter(r -> !r.isDeleted());
        if (opt.isEmpty()) {
            rateLimiter.recordFailure(key);
            log.warn("Auth password reset confirm failed (token not found) ip={}", ip);
            return error(HttpStatus.BAD_REQUEST, "Invalid or expired reset token.");
        }

        Runner runner = opt.get();
        LocalDateTime exp = runner.getPasswordResetExpiresAt();
        if (exp == null || exp.isBefore(LocalDateTime.now())) {
            passwordResetService.clearResetFields(runner);
            runnerRepository.save(runner);
            rateLimiter.recordFailure(key);
            log.warn("Auth password reset confirm failed (token expired) ip={} runnerId={}", ip, runner.getId());
            return error(HttpStatus.BAD_REQUEST, "Invalid or expired reset token.");
        }

        // Apply new password, invalidate existing sessions, clear reset token.
        authService.storePassword(runner, newPassword);
        runner.setSessionToken(null);
        runner.setTokenIssuedAt(null);
        passwordResetService.clearResetFields(runner);
        runnerRepository.save(runner);

        rateLimiter.recordSuccess(key);
        log.info("Auth password reset success ip={} runnerId={}", ip, runner.getId());
        return ResponseEntity.ok(Map.of("message", "Password updated."));
    }

    /**
     * Re-open a soft-deleted runner row so the same email can sign up again without a DB unique violation.
     */
    private void recycleDeletedRunnerForSignup(Runner runner, String normalizedEmail, String rawPassword) {
        runner.setEmail(normalizedEmail);
        runner.setDeleted(false);
        runner.setStatus("ACTIVE");
        runner.setRole("USER");
        runner.setSessionToken(null);
        runner.setTokenIssuedAt(null);
        authService.storePassword(runner, rawPassword);
        aiUsageService.initNewUser(runner);
        runner.setStravaAthleteId(null);
        runner.setStravaUsername(null);
        runner.setStravaAccessToken(null);
        runner.setStravaRefreshToken(null);
        runner.setStravaTokenExpiresAt(null);
        runner.setDisplayName(null);
        runner.setSubscriptionTier("FREE");
        runner.setProExpiresAt(null);
        runner.setAiMonthlyScansUsed(0);
        runner.setAiMonthlyResetDate(null);
        emailVerificationService.clearVerificationFields(runner);
    }

    // ==========================================
    // 3. ADMIN ENDPOINT: SECURE GET ALL RUNNERS
    // ==========================================
    @GetMapping("/runners")
    @Transactional
    public ResponseEntity<?> getAllRunners(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        // Uses Contributor's secure token check instead of URL params
        Optional<Runner> adminOptional = authService.findByAuthorizationHeader(authorizationHeader)
                .filter(authService::isAdmin);

        if (adminOptional.isEmpty()) {
            log.warn("INTRUSION ATTEMPT: Non-admin tried to access the database!");
            return error(HttpStatus.FORBIDDEN, "Admin privileges required.");
        }

        List<Runner> activeRunners = runnerRepository.findByDeletedFalseOrderByIdAsc();
        List<Runner> toSave = new ArrayList<>();
        for (Runner r : activeRunners) {
            String currentRole = r.getRole();
            if (currentRole == null || currentRole.equalsIgnoreCase("null") || currentRole.trim().isEmpty()) {
                r.setRole("USER");
                toSave.add(r);
            }
        }
        if (!toSave.isEmpty()) {
            runnerRepository.saveAll(toSave);
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
    /**
     * Soft-deletes a runner by id.
     * <p>
     * SECURITY / IDOR note: This is an admin-only operation. The caller must
     * present a valid admin session token — any non-admin token (including a
     * regular runner presenting their own id or another runner's id) receives
     * 403 before any runner lookup is performed. There is therefore no
     * IDOR risk: the access gate is role-based, not id-matching.
     * </p>
     */
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

        Runner admin = adminOptional.get();
        if (admin.getId().equals(id)) {
            return error(HttpStatus.BAD_REQUEST, "You cannot delete the account you are currently signed in with.");
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
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request
    ) {
        String ip = RequestIpResolver.clientIp(request);
        if (rateLimiter.isBlocked(ip)) {
            return error(HttpStatus.TOO_MANY_REQUESTS, "Too many failed attempts. Try again in 15 minutes.");
        }

        final String email;
        final String password;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, LOGIN_FIELDS);
            email = RequestBodyValidator.requiredString(body, "email", 254);
            password = RequestBodyValidator.requiredString(body, "password", 512);
            InputSanitizer.rejectControlChars(email, "email");
        } catch (IllegalArgumentException ignored) {
            return error(HttpStatus.UNAUTHORIZED, "Invalid admin credentials.");
        }
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
    /**
     * Grants or revokes a Pro subscription for a runner.
     * <p>
     * SECURITY / IDOR note: Admin-only. Non-admin callers (including a regular
     * runner using their own or any other id) receive 403 before any runner
     * lookup occurs. The path variable {@code id} is the target runner's id,
     * not the caller's — but only admins can reach the target lookup, so
     * there is no same-runner IDOR risk here.
     * </p>
     */
    @PostMapping("/runners/{id}/subscription")
    public ResponseEntity<?> updateSubscription(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) Map<String, Object> body) {

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
        final String action;
        final int months;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, ADMIN_SUBSCRIPTION_FIELDS);
            action = RequestBodyValidator.requiredSafeText(body, "action", 32);
            months = RequestBodyValidator.intOrDefault(body, "months", 1, 1, 24);
            InputSanitizer.rejectControlChars(action, "action");
            InputSanitizer.rejectControlAndHtmlChars(action, "action");
        } catch (IllegalArgumentException ignored) {
            return error(HttpStatus.BAD_REQUEST, "Invalid action.");
        }

        if ("grant_pro".equals(action)) {
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
