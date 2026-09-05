package com.hermes.backend.auth;

import com.hermes.backend.infrastructure.mail.MailDeliveryException;
import com.hermes.backend.infrastructure.mail.MailDeliveryReceipt;
import com.hermes.backend.infrastructure.mail.TransactionalMailMessage;
import com.hermes.backend.infrastructure.mail.TransactionalMailSender;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmailVerificationServiceTests {

    @Test
    void mailConfigurationDelegatesToTransactionalSender() {
        AuthService authService = mock(AuthService.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        TransactionalMailSender sender = mock(TransactionalMailSender.class);
        when(sender.isConfigured()).thenReturn(true);

        EmailVerificationService service = new EmailVerificationService(authService, runnerRepository, sender);

        assertThat(service.isMailConfigured()).isTrue();
        verify(sender).isConfigured();
    }

    @Test
    void newRunnerVerificationSendsProviderNeutralTextAndHtmlMessageWithOpaqueIdempotencyKey() {
        AuthService authService = mock(AuthService.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        TransactionalMailSender sender = configuredSender();
        Runner runner = runner(41L, "runner@hermes.test");
        when(authService.hashPlainToken(any())).thenAnswer(invocation -> "hash-" + invocation.getArgument(0));
        AtomicReference<TokenState> savedTokenState = new AtomicReference<>();
        doAnswer(invocation -> {
            Runner savedRunner = invocation.getArgument(0);
            savedTokenState.set(new TokenState(
                    savedRunner.getEmailVerificationTokenHash(), savedRunner.getEmailVerificationExpiresAt()));
            return savedRunner;
        }).when(runnerRepository).save(any(Runner.class));
        EmailVerificationService service = service(authService, runnerRepository, sender);
        LocalDateTime before = LocalDateTime.now();

        service.sendVerificationToNewRunner(runner, true);

        LocalDateTime after = LocalDateTime.now();
        TransactionalMailMessage message = sentMessage(sender);
        String plainToken = tokenFrom(message.text());
        String link = "https://hermesruns.com/api/auth/verify-email?token=" + plainToken;
        assertThat(message.subject()).isEqualTo("Verify your Hermes account");
        assertThat(message.text()).contains(link);
        assertThat(message.html()).contains(link);
        assertThat(message.html()).doesNotContain(runner.getEmail());
        assertThat(message.idempotencyKey()).startsWith("hermes-email-verification-");
        assertThat(message.idempotencyKey()).doesNotContain(runner.getEmail()).doesNotContain(plainToken);
        assertThatCode(() -> UUID.fromString(message.idempotencyKey().substring("hermes-email-verification-".length())))
                .doesNotThrowAnyException();
        verify(authService).hashPlainToken(eq(plainToken));
        TokenState savedState = savedTokenState.get();
        assertThat(savedState).isNotNull();
        assertThat(savedState.hash()).isEqualTo("hash-" + plainToken);
        assertThat(savedState.expiresAt())
                .isBetween(before.plusHours(48).minusSeconds(1), after.plusHours(48).plusSeconds(1));
        InOrder inOrder = inOrder(authService, runnerRepository, sender);
        inOrder.verify(authService).hashPlainToken(eq(plainToken));
        inOrder.verify(runnerRepository).save(runner);
        inOrder.verify(sender).send(any());
    }

    @Test
    void newRunnerDeliveryFailureDeletesPersistedRunnerWhenRollbackIsRequested() {
        AuthService authService = hashingAuthService();
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        TransactionalMailSender sender = configuredSender();
        MailDeliveryException failure = new MailDeliveryException("provider failure", 503, true);
        org.mockito.Mockito.doThrow(failure).when(sender).send(any());
        Runner runner = runner(42L, "new@hermes.test");
        EmailVerificationService service = service(authService, runnerRepository, sender);

        assertThatThrownBy(() -> service.sendVerificationToNewRunner(runner, true)).isSameAs(failure);

        InOrder inOrder = inOrder(runnerRepository, sender);
        inOrder.verify(runnerRepository).save(runner);
        inOrder.verify(sender).send(any());
        inOrder.verify(runnerRepository).deleteById(42L);
    }

    @Test
    void newRunnerNonDeliveryFailureDoesNotDeletePersistedRunner() {
        AuthService authService = hashingAuthService();
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        TransactionalMailSender sender = configuredSender();
        RuntimeException failure = new RuntimeException("unexpected failure");
        org.mockito.Mockito.doThrow(failure).when(sender).send(any());
        Runner runner = runner(45L, "unexpected@hermes.test");
        EmailVerificationService service = service(authService, runnerRepository, sender);

        assertThatThrownBy(() -> service.sendVerificationToNewRunner(runner, true)).isSameAs(failure);

        verify(runnerRepository, never()).deleteById(any());
    }

    @Test
    void newRunnerDeliveryFailureKeepsPersistedRunnerWhenRollbackIsNotRequested() {
        AuthService authService = hashingAuthService();
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        TransactionalMailSender sender = configuredSender();
        org.mockito.Mockito.doThrow(new MailDeliveryException("provider failure", 503, true)).when(sender).send(any());
        Runner runner = runner(43L, "recycled@hermes.test");
        EmailVerificationService service = service(authService, runnerRepository, sender);

        assertThatThrownBy(() -> service.sendVerificationToNewRunner(runner, false))
                .isInstanceOf(MailDeliveryException.class);

        verify(runnerRepository, never()).deleteById(any());
    }

    @Test
    void newRunnerDeliveryFailureWithoutPersistedIdDoesNotAttemptRollbackDelete() {
        AuthService authService = hashingAuthService();
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        TransactionalMailSender sender = configuredSender();
        org.mockito.Mockito.doThrow(new MailDeliveryException("provider failure", 503, true)).when(sender).send(any());
        Runner runner = runner(null, "pending@hermes.test");
        EmailVerificationService service = service(authService, runnerRepository, sender);

        assertThatThrownBy(() -> service.sendVerificationToNewRunner(runner, true))
                .isInstanceOf(MailDeliveryException.class);

        verify(runnerRepository, never()).deleteById(any());
    }

    @Test
    void resendDeliveryFailureNeverDeletesExistingRunner() {
        AuthService authService = hashingAuthService();
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        TransactionalMailSender sender = configuredSender();
        org.mockito.Mockito.doThrow(new MailDeliveryException("provider failure", 503, true)).when(sender).send(any());
        Runner runner = runner(44L, "existing@hermes.test");
        EmailVerificationService service = service(authService, runnerRepository, sender);

        assertThatThrownBy(() -> service.resendVerification(runner)).isInstanceOf(MailDeliveryException.class);

        verify(runnerRepository, never()).deleteById(any());
    }

    private EmailVerificationService service(
            AuthService authService, RunnerRepository runnerRepository, TransactionalMailSender sender) {
        EmailVerificationService service = new EmailVerificationService(authService, runnerRepository, sender);
        ReflectionTestUtils.setField(service, "publicBaseUrl", "https://hermesruns.com/");
        return service;
    }

    private TransactionalMailSender configuredSender() {
        TransactionalMailSender sender = mock(TransactionalMailSender.class);
        when(sender.isConfigured()).thenReturn(true);
        when(sender.send(any())).thenReturn(new MailDeliveryReceipt("provider-message-id"));
        return sender;
    }

    private AuthService hashingAuthService() {
        AuthService authService = mock(AuthService.class);
        when(authService.hashPlainToken(any())).thenAnswer(invocation -> "hash-" + invocation.getArgument(0));
        return authService;
    }

    private TransactionalMailMessage sentMessage(TransactionalMailSender sender) {
        ArgumentCaptor<TransactionalMailMessage> captor = ArgumentCaptor.forClass(TransactionalMailMessage.class);
        verify(sender).send(captor.capture());
        return captor.getValue();
    }

    private String tokenFrom(String text) {
        return text.substring(text.indexOf("token=") + "token=".length()).split("\\s", 2)[0];
    }

    private Runner runner(Long id, String email) {
        Runner runner = new Runner();
        runner.setId(id);
        runner.setEmail(email);
        return runner;
    }

    private record TokenState(String hash, LocalDateTime expiresAt) {
    }
}
