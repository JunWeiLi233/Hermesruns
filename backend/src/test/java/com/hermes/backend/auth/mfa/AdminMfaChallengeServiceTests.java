package com.hermes.backend.auth.mfa;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminMfaChallengeServiceTests {

    @Test
    void persistsOnlyHashOfOpaqueChallengeSelector() {
        AdminMfaChallengeRepository repository = mock(AdminMfaChallengeRepository.class);
        when(repository.save(any(AdminMfaChallenge.class))).thenAnswer(invocation -> invocation.getArgument(0));
        AdminMfaChallengeService service = new AdminMfaChallengeService(repository);

        AdminMfaChallengeService.CreatedChallenge created =
                service.create(42L, AdminMfaPurpose.AUTHENTICATION, "PASSWORD");

        ArgumentCaptor<AdminMfaChallenge> captor = ArgumentCaptor.forClass(AdminMfaChallenge.class);
        verify(repository).save(captor.capture());
        AdminMfaChallenge stored = captor.getValue();
        assertThat(created.selector()).isNotBlank();
        assertThat(stored.getSelectorHash()).isNotEqualTo(created.selector());
        assertThat(stored.getSelectorHash()).hasSize(64);
        assertThat(stored.getExpiresAt()).isAfter(LocalDateTime.now().plusMinutes(4));
        assertThat(stored.getAttempts()).isZero();
    }
}
