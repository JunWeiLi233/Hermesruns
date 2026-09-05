package com.hermes.backend.auth.mfa;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminMfaManagementServiceTests {

    @Test
    void refusesToRemoveTheFinalPasskey() {
        AdminPasskeyCredentialRepository credentials = mock(AdminPasskeyCredentialRepository.class);
        AdminMfaService service = service(credentials, mock(AdminRecoveryCodeRepository.class));
        Runner admin = passkeyVerifiedAdmin();
        AdminPasskeyCredential credential = credential(admin.getId(), 9L);
        when(credentials.findById(9L)).thenReturn(Optional.of(credential));
        when(credentials.countByRunnerId(admin.getId())).thenReturn(1L);

        assertThatThrownBy(() -> service.revokePasskey(admin, 9L))
                .isInstanceOf(AdminMfaException.class);

        verify(credentials, never()).delete(credential);
    }

    @Test
    void recoveryVerifiedSessionCannotRegenerateRecoveryCodes() {
        AdminPasskeyCredentialRepository credentials = mock(AdminPasskeyCredentialRepository.class);
        AdminRecoveryCodeRepository recoveryCodes = mock(AdminRecoveryCodeRepository.class);
        AdminMfaService service = service(credentials, recoveryCodes);
        Runner admin = passkeyVerifiedAdmin();
        admin.setAdminMfaMethod("RECOVERY_CODE");

        assertThatThrownBy(() -> service.regenerateRecoveryCodes(admin))
                .isInstanceOf(AdminMfaException.class);

        verify(recoveryCodes, never()).deleteByRunnerId(admin.getId());
    }

    private AdminMfaService service(
            AdminPasskeyCredentialRepository credentials,
            AdminRecoveryCodeRepository recoveryCodes
    ) {
        return new AdminMfaService(
                mock(RunnerRepository.class),
                mock(AuthService.class),
                mock(AdminMfaProfileRepository.class),
                credentials,
                recoveryCodes,
                mock(AdminMfaChallengeService.class),
                mock(AdminWebAuthnService.class),
                ""
        );
    }

    private Runner passkeyVerifiedAdmin() {
        Runner runner = new Runner();
        runner.setId(42L);
        runner.setRole("ADMIN");
        runner.setAdminMfaVerifiedAt(LocalDateTime.now());
        runner.setAdminMfaMethod("PASSKEY");
        return runner;
    }

    private AdminPasskeyCredential credential(Long runnerId, Long id) {
        AdminPasskeyCredential credential = new AdminPasskeyCredential();
        credential.setId(id);
        credential.setRunnerId(runnerId);
        return credential;
    }
}
