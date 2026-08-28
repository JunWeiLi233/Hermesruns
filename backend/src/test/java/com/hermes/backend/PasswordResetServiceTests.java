package com.hermes.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.test.util.ReflectionTestUtils;

class PasswordResetServiceTests {

    @Test
    void mailConfigurationDelegatesToTransactionalSender() {
        AuthService authService = mock(AuthService.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        TransactionalMailSender sender = mock(TransactionalMailSender.class);
        when(sender.isConfigured()).thenReturn(false);

        PasswordResetService service = new PasswordResetService(authService, runnerRepository, sender);

        assertThat(service.isMailConfigured()).isFalse();
        verify(sender).isConfigured();
    }

    @Test
    void resetSendsProviderNeutralTextAndHtmlMessageWithOpaqueIdempotencyKeyAndHashedToken() {
        AuthService authService = mock(AuthService.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        TransactionalMailSender sender = configuredSender();
        Runner runner = runner("runner@hermes.test");
        when(authService.hashPlainToken(any())).thenAnswer(invocation -> "hash-" + invocation.getArgument(0));
        AtomicReference<TokenState> savedTokenState = new AtomicReference<>();
        doAnswer(invocation -> {
            Runner savedRunner = invocation.getArgument(0);
            savedTokenState.set(new TokenState(
                    savedRunner.getPasswordResetTokenHash(), savedRunner.getPasswordResetExpiresAt()));
            return savedRunner;
        }).when(runnerRepository).save(any(Runner.class));
        PasswordResetService service = service(authService, runnerRepository, sender);
        LocalDateTime before = LocalDateTime.now();

        service.sendResetLink(runner);

        LocalDateTime after = LocalDateTime.now();
        TransactionalMailMessage message = sentMessage(sender);
        String plainToken = tokenFrom(message.text());
        String link = "https://hermesruns.com/reset-password?token=" + plainToken;
        assertThat(message.subject()).isEqualTo("Reset your Hermes password");
        assertThat(message.text()).contains(link);
        assertThat(message.html()).contains(link);
        assertThat(message.html()).doesNotContain(runner.getEmail());
        assertThat(message.idempotencyKey()).startsWith("hermes-password-reset-");
        assertThat(message.idempotencyKey()).doesNotContain(runner.getEmail()).doesNotContain(plainToken);
        assertThatCode(() -> UUID.fromString(message.idempotencyKey().substring("hermes-password-reset-".length())))
                .doesNotThrowAnyException();
        verify(authService).hashPlainToken(eq(plainToken));
        TokenState savedState = savedTokenState.get();
        assertThat(savedState).isNotNull();
        assertThat(savedState.hash()).isEqualTo("hash-" + plainToken);
        assertThat(savedState.expiresAt())
                .isBetween(before.plusMinutes(60).minusSeconds(1), after.plusMinutes(60).plusSeconds(1));
        InOrder inOrder = inOrder(authService, runnerRepository, sender);
        inOrder.verify(authService).hashPlainToken(eq(plainToken));
        inOrder.verify(runnerRepository).save(runner);
        inOrder.verify(sender).send(any());
    }

    @Test
    void resetDeliveryFailureRethrowsProviderExceptionWithoutChangingTokenStorageContract() {
        AuthService authService = mock(AuthService.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        TransactionalMailSender sender = configuredSender();
        MailDeliveryException failure = new MailDeliveryException("provider failure", 503, true);
        org.mockito.Mockito.doThrow(failure).when(sender).send(any());
        Runner runner = runner("runner@hermes.test");
        when(authService.hashPlainToken(any())).thenAnswer(invocation -> "hash-" + invocation.getArgument(0));
        PasswordResetService service = service(authService, runnerRepository, sender);

        assertThatThrownBy(() -> service.sendResetLink(runner)).isSameAs(failure);

        verify(runnerRepository).save(runner);
        assertThat(runner.getPasswordResetTokenHash()).startsWith("hash-");
    }

    private PasswordResetService service(
            AuthService authService, RunnerRepository runnerRepository, TransactionalMailSender sender) {
        PasswordResetService service = new PasswordResetService(authService, runnerRepository, sender);
        ReflectionTestUtils.setField(service, "publicBaseUrl", "https://hermesruns.com/");
        return service;
    }

    private TransactionalMailSender configuredSender() {
        TransactionalMailSender sender = mock(TransactionalMailSender.class);
        when(sender.isConfigured()).thenReturn(true);
        when(sender.send(any())).thenReturn(new MailDeliveryReceipt("provider-message-id"));
        return sender;
    }

    private TransactionalMailMessage sentMessage(TransactionalMailSender sender) {
        ArgumentCaptor<TransactionalMailMessage> captor = ArgumentCaptor.forClass(TransactionalMailMessage.class);
        verify(sender).send(captor.capture());
        return captor.getValue();
    }

    private String tokenFrom(String text) {
        return text.substring(text.indexOf("token=") + "token=".length()).split("\\s", 2)[0];
    }

    private Runner runner(String email) {
        Runner runner = new Runner();
        runner.setEmail(email);
        return runner;
    }

    private record TokenState(String hash, LocalDateTime expiresAt) {
    }
}
