package com.hermes.backend.auth.mfa;

import com.hermes.backend.runner.Runner;
import com.yubico.webauthn.AssertionRequest;
import com.yubico.webauthn.AssertionResult;
import com.yubico.webauthn.FinishAssertionOptions;
import com.yubico.webauthn.FinishRegistrationOptions;
import com.yubico.webauthn.RegistrationResult;
import com.yubico.webauthn.RelyingParty;
import com.yubico.webauthn.StartAssertionOptions;
import com.yubico.webauthn.StartRegistrationOptions;
import com.yubico.webauthn.data.AuthenticatorSelectionCriteria;
import com.yubico.webauthn.data.PublicKeyCredential;
import com.yubico.webauthn.data.PublicKeyCredentialCreationOptions;
import com.yubico.webauthn.data.RelyingPartyIdentity;
import com.yubico.webauthn.data.ResidentKeyRequirement;
import com.yubico.webauthn.data.UserIdentity;
import com.yubico.webauthn.data.UserVerificationRequirement;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AdminWebAuthnService {
    private final RelyingParty relyingParty;
    private final Set<String> allowedOrigins;

    public AdminWebAuthnService(
            AdminMfaCredentialRepositoryAdapter credentialRepository,
            @Value("${app.security.admin-mfa.rp-id:localhost}") String rpId,
            @Value("${app.security.admin-mfa.rp-name:Hermes Admin}") String rpName,
            @Value("${app.security.admin-mfa.allowed-origins:http://localhost:8080}") String origins
    ) {
        this.allowedOrigins = Arrays.stream(origins.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .collect(Collectors.toUnmodifiableSet());
        this.relyingParty = RelyingParty.builder()
                .identity(RelyingPartyIdentity.builder().id(rpId.trim()).name(rpName.trim()).build())
                .credentialRepository(credentialRepository)
                .origins(allowedOrigins)
                .allowOriginPort(false)
                .allowOriginSubdomain(false)
                .validateSignatureCounter(true)
                .build();
    }

    public PublicKeyCredentialCreationOptions startRegistration(Runner runner, AdminMfaProfile profile) {
        UserIdentity user = UserIdentity.builder()
                .name(runner.getEmail())
                .displayName(displayName(runner))
                .id(decode(profile.getUserHandleB64()))
                .build();
        AuthenticatorSelectionCriteria selection = AuthenticatorSelectionCriteria.builder()
                .residentKey(ResidentKeyRequirement.PREFERRED)
                .userVerification(UserVerificationRequirement.REQUIRED)
                .build();
        return relyingParty.startRegistration(StartRegistrationOptions.builder()
                .user(user)
                .authenticatorSelection(selection)
                .timeout(300_000L)
                .build());
    }

    public RegistrationResult finishRegistration(String requestJson, String responseJson) {
        try {
            PublicKeyCredentialCreationOptions request = PublicKeyCredentialCreationOptions.fromJson(requestJson);
            RegistrationResult result = relyingParty.finishRegistration(FinishRegistrationOptions.builder()
                    .request(request)
                    .response(PublicKeyCredential.parseRegistrationResponseJson(responseJson))
                    .build());
            if (!result.isUserVerified()) {
                throw new AdminMfaException("Admin authentication failed.");
            }
            return result;
        } catch (AdminMfaException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new AdminMfaException("Admin authentication failed.", ex);
        }
    }

    public AssertionRequest startAuthentication(Runner runner) {
        return relyingParty.startAssertion(StartAssertionOptions.builder()
                .username(runner.getEmail())
                .userVerification(UserVerificationRequirement.REQUIRED)
                .timeout(300_000L)
                .build());
    }

    public AssertionResult finishAuthentication(String requestJson, String responseJson) {
        try {
            AssertionRequest request = AssertionRequest.fromJson(requestJson);
            AssertionResult result = relyingParty.finishAssertion(FinishAssertionOptions.builder()
                    .request(request)
                    .response(PublicKeyCredential.parseAssertionResponseJson(responseJson))
                    .build());
            if (!result.isSuccess() || !result.isUserVerified()) {
                throw new AdminMfaException("Admin authentication failed.");
            }
            return result;
        } catch (AdminMfaException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new AdminMfaException("Admin authentication failed.", ex);
        }
    }

    public boolean isAllowedRequestOrigin(String origin) {
        return origin != null && allowedOrigins.contains(origin.trim());
    }

    private String displayName(Runner runner) {
        if (runner.getDisplayName() != null && !runner.getDisplayName().isBlank()) {
            return runner.getDisplayName().trim();
        }
        return "Hermes administrator " + runner.getEmail().toLowerCase(Locale.ROOT);
    }

    private com.yubico.webauthn.data.ByteArray decode(String value) {
        try {
            return com.yubico.webauthn.data.ByteArray.fromBase64Url(value);
        } catch (Exception ex) {
            throw new AdminMfaException("Admin authentication failed.", ex);
        }
    }
}
