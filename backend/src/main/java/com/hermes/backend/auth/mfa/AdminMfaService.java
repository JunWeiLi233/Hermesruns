package com.hermes.backend.auth.mfa;

import com.hermes.backend.AuthService;
import com.hermes.backend.Runner;
import com.hermes.backend.RunnerRepository;
import com.yubico.webauthn.AssertionRequest;
import com.yubico.webauthn.AssertionResult;
import com.yubico.webauthn.RegistrationResult;
import com.yubico.webauthn.data.PublicKeyCredentialCreationOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Service
public class AdminMfaService {
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RunnerRepository runnerRepository;
    private final AuthService authService;
    private final AdminMfaProfileRepository profileRepository;
    private final AdminPasskeyCredentialRepository credentialRepository;
    private final AdminRecoveryCodeRepository recoveryCodeRepository;
    private final AdminMfaChallengeService challengeService;
    private final AdminWebAuthnService webAuthnService;
    private final String bootstrapToken;

    public AdminMfaService(
            RunnerRepository runnerRepository,
            AuthService authService,
            AdminMfaProfileRepository profileRepository,
            AdminPasskeyCredentialRepository credentialRepository,
            AdminRecoveryCodeRepository recoveryCodeRepository,
            AdminMfaChallengeService challengeService,
            AdminWebAuthnService webAuthnService,
            @Value("${app.security.admin-mfa.bootstrap-token:}") String bootstrapToken
    ) {
        this.runnerRepository = runnerRepository;
        this.authService = authService;
        this.profileRepository = profileRepository;
        this.credentialRepository = credentialRepository;
        this.recoveryCodeRepository = recoveryCodeRepository;
        this.challengeService = challengeService;
        this.webAuthnService = webAuthnService;
        this.bootstrapToken = bootstrapToken == null ? "" : bootstrapToken;
    }

    @Transactional
    public BeginResult beginPrimaryAuthenticatedFlow(Runner runner, String primaryMethod) {
        requireAdmin(runner);
        authService.invalidateSession(runner);
        AdminMfaProfile profile = profileFor(runner);
        boolean hasCredential = credentialRepository.existsByRunnerId(runner.getId());
        boolean setupRequired = !hasCredential && profile.getBootstrapCompletedAt() == null;
        AdminMfaPurpose purpose = setupRequired ? AdminMfaPurpose.REGISTRATION : AdminMfaPurpose.AUTHENTICATION;
        AdminMfaChallengeService.CreatedChallenge created =
                challengeService.create(runner.getId(), purpose, primaryMethod);
        if (purpose == AdminMfaPurpose.AUTHENTICATION && hasCredential) {
            AssertionRequest request = webAuthnService.startAuthentication(runner);
            challengeService.storeRequest(created.selector(), purpose, toJson(request));
        }
        return new BeginResult(
                setupRequired ? "ADMIN_MFA_SETUP_REQUIRED" : "ADMIN_MFA_REQUIRED",
                created.selector()
        );
    }

    @Transactional
    public String registrationOptions(String selector, String suppliedBootstrapToken) {
        AdminMfaChallenge challenge = challengeService.requireActive(selector, AdminMfaPurpose.REGISTRATION);
        Runner runner = runner(challenge);
        AdminMfaProfile profile = profileRepository.findByRunnerId(runner.getId())
                .orElseThrow(() -> new AdminMfaException("Admin authentication failed."));
        if (profile.getBootstrapCompletedAt() != null || credentialRepository.existsByRunnerId(runner.getId())) {
            throw new AdminMfaException("Admin authentication failed.");
        }
        verifyBootstrapToken(suppliedBootstrapToken);
        PublicKeyCredentialCreationOptions request = webAuthnService.startRegistration(runner, profile);
        challengeService.storeRequest(selector, AdminMfaPurpose.REGISTRATION, toJson(request));
        challengeService.markBootstrapVerified(selector);
        try {
            return request.toCredentialsCreateJson();
        } catch (Exception ex) {
            throw new AdminMfaException("Admin authentication failed.", ex);
        }
    }

    @Transactional
    public CompletionResult finishRegistration(String selector, String credentialJson) {
        AdminMfaChallenge challenge = challengeService.requireActive(selector, AdminMfaPurpose.REGISTRATION);
        Runner runner = runner(challenge);
        AdminMfaProfile profile = profileRepository.findByRunnerId(runner.getId())
                .orElseThrow(() -> new AdminMfaException("Admin authentication failed."));
        if (challenge.getBootstrapVerifiedAt() == null
                || challenge.getRequestJson() == null
                || profile.getBootstrapCompletedAt() != null
                || credentialRepository.existsByRunnerId(runner.getId())) {
            challengeService.recordFailure(challenge);
            throw new AdminMfaException("Admin authentication failed.");
        }
        try {
            RegistrationResult result = webAuthnService.finishRegistration(challenge.getRequestJson(), credentialJson);
            storeCredential(runner, profile, result, "Primary passkey");

            LocalDateTime now = LocalDateTime.now();
            profile.setBootstrapCompletedAt(now);
            profile.setRecoveryCodesIssuedAt(now);
            profile.setUpdatedAt(now);
            profileRepository.save(profile);
            List<String> recoveryCodes = replaceRecoveryCodes(runner.getId());
            challengeService.consume(challenge);
            return complete(runner, "PASSKEY", recoveryCodes);
        } catch (AdminMfaException ex) {
            challengeService.recordFailure(challenge);
            throw ex;
        } catch (RuntimeException ex) {
            challengeService.recordFailure(challenge);
            throw new AdminMfaException("Admin authentication failed.", ex);
        }
    }

    @Transactional
    public RegistrationBeginResult beginAdditionalPasskeyRegistration(Runner runner) {
        requireFreshPasskeySession(runner);
        AdminMfaProfile profile = profileRepository.findByRunnerId(runner.getId())
                .filter(value -> value.getBootstrapCompletedAt() != null)
                .orElseThrow(() -> new AdminMfaException("Admin authentication failed."));
        AdminMfaChallengeService.CreatedChallenge created =
                challengeService.create(runner.getId(), AdminMfaPurpose.REGISTRATION, "PASSKEY_ADD");
        PublicKeyCredentialCreationOptions request = webAuthnService.startRegistration(runner, profile);
        challengeService.storeRequest(created.selector(), AdminMfaPurpose.REGISTRATION, toJson(request));
        return new RegistrationBeginResult(created.selector(), toCredentialsCreateJson(request));
    }

    @Transactional
    public PasskeyView finishAdditionalPasskeyRegistration(
            Runner runner,
            String selector,
            String credentialJson,
            String label
    ) {
        requireFreshPasskeySession(runner);
        AdminMfaChallenge challenge = challengeService.requireActive(selector, AdminMfaPurpose.REGISTRATION);
        if (!runner.getId().equals(challenge.getRunnerId())
                || !"PASSKEY_ADD".equals(challenge.getPrimaryMethod())
                || challenge.getRequestJson() == null
                || challenge.getRequestJson().isBlank()) {
            challengeService.recordFailure(challenge);
            throw new AdminMfaException("Admin authentication failed.");
        }
        AdminMfaProfile profile = profileRepository.findByRunnerId(runner.getId())
                .filter(value -> value.getBootstrapCompletedAt() != null)
                .orElseThrow(() -> new AdminMfaException("Admin authentication failed."));
        try {
            RegistrationResult result = webAuthnService.finishRegistration(challenge.getRequestJson(), credentialJson);
            String credentialId = result.getKeyId().getId().getBase64Url();
            if (credentialRepository.findByCredentialIdB64(credentialId).isPresent()) {
                throw new AdminMfaException("Admin authentication failed.");
            }
            AdminPasskeyCredential credential = storeCredential(
                    runner,
                    profile,
                    result,
                    normalizePasskeyLabel(label, "Additional passkey")
            );
            challengeService.consume(challenge);
            return passkeyView(credential);
        } catch (AdminMfaException ex) {
            challengeService.recordFailure(challenge);
            throw ex;
        } catch (RuntimeException ex) {
            challengeService.recordFailure(challenge);
            throw new AdminMfaException("Admin authentication failed.", ex);
        }
    }

    @Transactional
    public String authenticationOptions(String selector) {
        AdminMfaChallenge challenge = challengeService.requireActive(selector, AdminMfaPurpose.AUTHENTICATION);
        if (challenge.getRequestJson() == null || challenge.getRequestJson().isBlank()) {
            throw new AdminMfaException("Admin authentication failed.");
        }
        try {
            return AssertionRequest.fromJson(challenge.getRequestJson()).toCredentialsGetJson();
        } catch (Exception ex) {
            throw new AdminMfaException("Admin authentication failed.", ex);
        }
    }

    @Transactional
    public CompletionResult finishAuthentication(String selector, String credentialJson) {
        AdminMfaChallenge challenge = challengeService.requireActive(selector, AdminMfaPurpose.AUTHENTICATION);
        Runner runner = runner(challenge);
        if (challenge.getRequestJson() == null || challenge.getRequestJson().isBlank()) {
            challengeService.recordFailure(challenge);
            throw new AdminMfaException("Admin authentication failed.");
        }
        try {
            AssertionResult result = webAuthnService.finishAuthentication(challenge.getRequestJson(), credentialJson);
            if (!runner.getEmail().equalsIgnoreCase(result.getUsername())) {
                throw new AdminMfaException("Admin authentication failed.");
            }
            AdminPasskeyCredential credential = credentialRepository
                    .findByCredentialIdB64(result.getCredential().getCredentialId().getBase64Url())
                    .filter(stored -> stored.getRunnerId().equals(runner.getId()))
                    .orElseThrow(() -> new AdminMfaException("Admin authentication failed."));
            credential.setSignatureCount(result.getSignatureCount());
            credential.setBackupEligible(result.isBackupEligible());
            credential.setBackedUp(result.isBackedUp());
            credential.setLastUsedAt(LocalDateTime.now());
            credentialRepository.save(credential);
            challengeService.consume(challenge);
            return complete(runner, "PASSKEY", List.of());
        } catch (AdminMfaException ex) {
            challengeService.recordFailure(challenge);
            throw ex;
        } catch (RuntimeException ex) {
            challengeService.recordFailure(challenge);
            throw new AdminMfaException("Admin authentication failed.", ex);
        }
    }

    @Transactional
    public CompletionResult finishRecovery(String selector, String recoveryCode) {
        AdminMfaChallenge challenge = challengeService.requireActive(selector, AdminMfaPurpose.AUTHENTICATION);
        Runner runner = runner(challenge);
        String normalized = recoveryCode == null ? "" : recoveryCode.trim();
        if (normalized.length() < 16 || normalized.length() > 128) {
            challengeService.recordFailure(challenge);
            throw new AdminMfaException("Admin authentication failed.");
        }
        AdminRecoveryCode stored = recoveryCodeRepository
                .findByRunnerIdAndCodeHashAndUsedAtIsNull(runner.getId(), AdminMfaChallengeService.hash(normalized))
                .orElseThrow(() -> {
                    challengeService.recordFailure(challenge);
                    return new AdminMfaException("Admin authentication failed.");
                });
        stored.setUsedAt(LocalDateTime.now());
        recoveryCodeRepository.save(stored);
        challengeService.consume(challenge);
        return complete(runner, "RECOVERY_CODE", List.of());
    }

    @Transactional(readOnly = true)
    public List<PasskeyView> listPasskeys(Runner runner) {
        requireFreshAdminSession(runner);
        return credentialRepository.findAllByRunnerIdOrderByCreatedAtAsc(runner.getId()).stream()
                .map(credential -> new PasskeyView(
                        credential.getId(),
                        safeLabel(credential.getLabel()),
                        Boolean.TRUE.equals(credential.getBackupEligible()),
                        Boolean.TRUE.equals(credential.getBackedUp()),
                        credential.getCreatedAt(),
                        credential.getLastUsedAt()
                ))
                .toList();
    }

    @Transactional
    public PasskeyView renamePasskey(Runner runner, Long credentialId, String label) {
        requireFreshAdminSession(runner);
        String normalized = label == null ? "" : label.trim();
        if (normalized.isBlank() || normalized.length() > 100) {
            throw new AdminMfaException("Invalid passkey label.");
        }
        AdminPasskeyCredential credential = ownedCredential(runner, credentialId);
        credential.setLabel(normalized);
        credentialRepository.save(credential);
        return new PasskeyView(
                credential.getId(),
                credential.getLabel(),
                Boolean.TRUE.equals(credential.getBackupEligible()),
                Boolean.TRUE.equals(credential.getBackedUp()),
                credential.getCreatedAt(),
                credential.getLastUsedAt()
        );
    }

    @Transactional
    public void revokePasskey(Runner runner, Long credentialId) {
        requireFreshPasskeySession(runner);
        AdminPasskeyCredential credential = ownedCredential(runner, credentialId);
        if (credentialRepository.countByRunnerId(runner.getId()) <= 1) {
            throw new AdminMfaException("The final passkey cannot be removed.");
        }
        credentialRepository.delete(credential);
    }

    @Transactional
    public List<String> regenerateRecoveryCodes(Runner runner) {
        requireFreshPasskeySession(runner);
        List<String> codes = replaceRecoveryCodes(runner.getId());
        profileRepository.findByRunnerId(runner.getId()).ifPresent(profile -> {
            LocalDateTime now = LocalDateTime.now();
            profile.setRecoveryCodesIssuedAt(now);
            profile.setUpdatedAt(now);
            profileRepository.save(profile);
        });
        return codes;
    }

    @Transactional
    public void cancel(String selector) {
        if (selector == null || selector.isBlank()) return;
        try {
            AdminMfaChallenge challenge = challengeService.requireActive(selector, AdminMfaPurpose.AUTHENTICATION);
            challengeService.consume(challenge);
        } catch (AdminMfaException ignored) {
            try {
                AdminMfaChallenge challenge = challengeService.requireActive(selector, AdminMfaPurpose.REGISTRATION);
                challengeService.consume(challenge);
            } catch (AdminMfaException ignoredAgain) {
                // Cancellation is intentionally idempotent.
            }
        }
    }

    public boolean isAllowedRequestOrigin(String origin) {
        return webAuthnService.isAllowedRequestOrigin(origin);
    }

    private CompletionResult complete(Runner runner, String method, List<String> recoveryCodes) {
        String token = authService.issueMfaVerifiedAdminSessionToken(runner, method);
        return new CompletionResult(token, runner, recoveryCodes);
    }

    private Runner runner(AdminMfaChallenge challenge) {
        return runnerRepository.findById(challenge.getRunnerId())
                .filter(runner -> !runner.isDeleted())
                .filter(authService::isAdmin)
                .orElseThrow(() -> new AdminMfaException("Admin authentication failed."));
    }

    private AdminMfaProfile profileFor(Runner runner) {
        return profileRepository.findByRunnerId(runner.getId()).orElseGet(() -> {
            byte[] handle = new byte[32];
            RANDOM.nextBytes(handle);
            LocalDateTime now = LocalDateTime.now();
            AdminMfaProfile profile = new AdminMfaProfile();
            profile.setRunnerId(runner.getId());
            profile.setUserHandleB64(Base64.getUrlEncoder().withoutPadding().encodeToString(handle));
            profile.setCreatedAt(now);
            profile.setUpdatedAt(now);
            return profileRepository.save(profile);
        });
    }

    private List<String> replaceRecoveryCodes(Long runnerId) {
        recoveryCodeRepository.deleteByRunnerId(runnerId);
        List<String> plaintext = new ArrayList<>();
        for (int index = 0; index < 10; index++) {
            byte[] bytes = new byte[16];
            RANDOM.nextBytes(bytes);
            String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            AdminRecoveryCode stored = new AdminRecoveryCode();
            stored.setRunnerId(runnerId);
            stored.setCodeHash(AdminMfaChallengeService.hash(code));
            stored.setCreatedAt(LocalDateTime.now());
            recoveryCodeRepository.save(stored);
            plaintext.add(code);
        }
        return List.copyOf(plaintext);
    }

    private AdminPasskeyCredential storeCredential(
            Runner runner,
            AdminMfaProfile profile,
            RegistrationResult result,
            String label
    ) {
        AdminPasskeyCredential credential = new AdminPasskeyCredential();
        credential.setRunnerId(runner.getId());
        credential.setCredentialIdB64(result.getKeyId().getId().getBase64Url());
        credential.setUserHandleB64(profile.getUserHandleB64());
        credential.setPublicKeyCose(result.getPublicKeyCose().getBytes());
        credential.setSignatureCount(result.getSignatureCount());
        credential.setBackupEligible(result.isBackupEligible());
        credential.setBackedUp(result.isBackedUp());
        credential.setLabel(normalizePasskeyLabel(label, "Passkey"));
        credential.setCreatedAt(LocalDateTime.now());
        return credentialRepository.save(credential);
    }

    private void verifyBootstrapToken(String supplied) {
        if (bootstrapToken.length() < 32 || supplied == null) {
            throw new AdminMfaException("Admin MFA setup is unavailable.");
        }
        boolean matches = MessageDigest.isEqual(
                bootstrapToken.getBytes(StandardCharsets.UTF_8),
                supplied.getBytes(StandardCharsets.UTF_8)
        );
        if (!matches) {
            throw new AdminMfaException("Admin authentication failed.");
        }
    }

    private String toJson(AssertionRequest request) {
        try { return request.toJson(); }
        catch (Exception ex) { throw new AdminMfaException("Admin authentication failed.", ex); }
    }

    private String toJson(PublicKeyCredentialCreationOptions request) {
        try { return request.toJson(); }
        catch (Exception ex) { throw new AdminMfaException("Admin authentication failed.", ex); }
    }

    private String toCredentialsCreateJson(PublicKeyCredentialCreationOptions request) {
        try { return request.toCredentialsCreateJson(); }
        catch (Exception ex) { throw new AdminMfaException("Admin authentication failed.", ex); }
    }

    private void requireAdmin(Runner runner) {
        if (runner == null || runner.getId() == null || runner.isDeleted() || !authService.isAdmin(runner)) {
            throw new AdminMfaException("Admin authentication failed.");
        }
    }

    private void requireFreshAdminSession(Runner runner) {
        requireAdmin(runner);
        LocalDateTime verifiedAt = runner.getAdminMfaVerifiedAt();
        if (verifiedAt == null
                || runner.getAdminMfaMethod() == null
                || verifiedAt.isBefore(LocalDateTime.now().minusHours(8))
                || verifiedAt.isAfter(LocalDateTime.now().plusMinutes(5))) {
            throw new AdminMfaException("Admin authentication failed.");
        }
    }

    private void requireFreshPasskeySession(Runner runner) {
        requireFreshAdminSession(runner);
        if (!"PASSKEY".equalsIgnoreCase(runner.getAdminMfaMethod())) {
            throw new AdminMfaException("A recent passkey verification is required.");
        }
    }

    private AdminPasskeyCredential ownedCredential(Runner runner, Long credentialId) {
        if (credentialId == null) {
            throw new AdminMfaException("Passkey not found.");
        }
        return credentialRepository.findById(credentialId)
                .filter(credential -> runner.getId().equals(credential.getRunnerId()))
                .orElseThrow(() -> new AdminMfaException("Passkey not found."));
    }

    private String safeLabel(String label) {
        return label == null || label.isBlank() ? "Passkey" : label;
    }

    private String normalizePasskeyLabel(String label, String fallback) {
        String normalized = label == null ? "" : label.trim();
        if (normalized.isBlank()) {
            return fallback;
        }
        if (normalized.length() > 100) {
            throw new AdminMfaException("Invalid passkey label.");
        }
        return normalized;
    }

    private PasskeyView passkeyView(AdminPasskeyCredential credential) {
        return new PasskeyView(
                credential.getId(),
                safeLabel(credential.getLabel()),
                Boolean.TRUE.equals(credential.getBackupEligible()),
                Boolean.TRUE.equals(credential.getBackedUp()),
                credential.getCreatedAt(),
                credential.getLastUsedAt()
        );
    }

    public record BeginResult(String code, String selector) {}
    public record CompletionResult(String token, Runner runner, List<String> recoveryCodes) {}
    public record RegistrationBeginResult(String selector, String creationOptionsJson) {}
    public record PasskeyView(
            Long id,
            String label,
            boolean backupEligible,
            boolean backedUp,
            LocalDateTime createdAt,
            LocalDateTime lastUsedAt
    ) {}
}
