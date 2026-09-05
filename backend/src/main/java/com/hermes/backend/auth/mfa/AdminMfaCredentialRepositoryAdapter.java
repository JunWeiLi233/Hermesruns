package com.hermes.backend.auth.mfa;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.yubico.webauthn.CredentialRepository;
import com.yubico.webauthn.RegisteredCredential;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.PublicKeyCredentialDescriptor;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class AdminMfaCredentialRepositoryAdapter implements CredentialRepository {
    private final RunnerRepository runnerRepository;
    private final AdminMfaProfileRepository profileRepository;
    private final AdminPasskeyCredentialRepository credentialRepository;

    public AdminMfaCredentialRepositoryAdapter(
            RunnerRepository runnerRepository,
            AdminMfaProfileRepository profileRepository,
            AdminPasskeyCredentialRepository credentialRepository
    ) {
        this.runnerRepository = runnerRepository;
        this.profileRepository = profileRepository;
        this.credentialRepository = credentialRepository;
    }

    @Override
    public Set<PublicKeyCredentialDescriptor> getCredentialIdsForUsername(String username) {
        return runnerRepository.findByEmailIgnoreCase(username)
                .map(Runner::getId)
                .map(credentialRepository::findAllByRunnerIdOrderByCreatedAtAsc)
                .orElseGet(java.util.List::of)
                .stream()
                .map(credential -> PublicKeyCredentialDescriptor.builder()
                        .id(decode(credential.getCredentialIdB64()))
                        .build())
                .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    public Optional<ByteArray> getUserHandleForUsername(String username) {
        return runnerRepository.findByEmailIgnoreCase(username)
                .flatMap(runner -> profileRepository.findByRunnerId(runner.getId()))
                .map(profile -> decode(profile.getUserHandleB64()));
    }

    @Override
    public Optional<String> getUsernameForUserHandle(ByteArray userHandle) {
        return profileRepository.findByUserHandleB64(userHandle.getBase64Url())
                .flatMap(profile -> runnerRepository.findById(profile.getRunnerId()))
                .map(Runner::getEmail);
    }

    @Override
    public Optional<RegisteredCredential> lookup(ByteArray credentialId, ByteArray userHandle) {
        return credentialRepository.findByCredentialIdB64(credentialId.getBase64Url())
                .filter(credential -> credential.getUserHandleB64().equals(userHandle.getBase64Url()))
                .map(this::registeredCredential);
    }

    @Override
    public Set<RegisteredCredential> lookupAll(ByteArray credentialId) {
        return credentialRepository.findByCredentialIdB64(credentialId.getBase64Url())
                .map(this::registeredCredential)
                .map(Set::of)
                .orElseGet(Set::of);
    }

    private RegisteredCredential registeredCredential(AdminPasskeyCredential credential) {
        return RegisteredCredential.builder()
                .credentialId(decode(credential.getCredentialIdB64()))
                .userHandle(decode(credential.getUserHandleB64()))
                .publicKeyCose(new ByteArray(credential.getPublicKeyCose()))
                .signatureCount(credential.getSignatureCount())
                .backupEligible(credential.getBackupEligible())
                .backupState(credential.getBackedUp())
                .build();
    }

    private ByteArray decode(String value) {
        try {
            return ByteArray.fromBase64Url(value);
        } catch (Exception ex) {
            throw new IllegalStateException("Stored WebAuthn data is invalid.", ex);
        }
    }
}
