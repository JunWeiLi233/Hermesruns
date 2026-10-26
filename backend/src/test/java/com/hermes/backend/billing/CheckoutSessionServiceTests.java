package com.hermes.backend.billing;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.stripe.exception.ApiConnectionException;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.checkout.SessionCreateParams;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CheckoutSessionServiceTests {
    @Test
    void retriesAndRepeatedClicksReusePersistedIdempotencyKeyAndParameters() throws Exception {
        RunnerRepository runners = mock(RunnerRepository.class);
        Runner runner = new Runner();
        runner.setId(7L);
        runner.setEmail("runner@example.com");
        when(runners.findByIdForUpdate(7L)).thenReturn(Optional.of(runner));
        CheckoutAttemptRepository attempts = mock(CheckoutAttemptRepository.class);
        AtomicReference<CheckoutAttempt> stored = new AtomicReference<>();
        when(attempts.findById(7L)).thenAnswer(call -> Optional.ofNullable(stored.get()));
        when(attempts.save(any())).thenAnswer(call -> {
            stored.set(call.getArgument(0));
            return stored.get();
        });
        PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
        when(transactions.getTransaction(any())).thenAnswer(call -> new SimpleTransactionStatus());
        CheckoutSessionService service = new CheckoutSessionService(runners, attempts, transactions,
                "sk_test", "price_1", "https://example.com");
        Session session = new Session();
        session.setId("cs_one");
        session.setUrl("https://checkout.stripe.com/one");
        AtomicReference<String> key = new AtomicReference<>();
        AtomicReference<SessionCreateParams> params = new AtomicReference<>();
        try (var stripe = mockStatic(Session.class)) {
            stripe.when(() -> Session.create(any(SessionCreateParams.class), any(RequestOptions.class)))
                    .thenAnswer(call -> {
                        key.set(((RequestOptions) call.getArgument(1)).getIdempotencyKey());
                        params.set(call.getArgument(0));
                        throw new ApiConnectionException("uncertain network result");
                    });
            assertThatThrownBy(() -> service.createOrReuse(7L, 1)).isInstanceOf(ApiConnectionException.class);
            String originalKey = key.get();
            SessionCreateParams originalParams = params.get();
            runner.setEmail("changed@example.com");
            stripe.when(() -> Session.create(any(SessionCreateParams.class), any(RequestOptions.class)))
                    .thenAnswer(call -> {
                        assertThat(((RequestOptions) call.getArgument(1)).getIdempotencyKey()).isEqualTo(originalKey);
                        assertThat(((SessionCreateParams) call.getArgument(0)).toMap()).isEqualTo(originalParams.toMap());
                        return session;
                    });
            assertThat(service.createOrReuse(7L, 1)).isEqualTo(session.getUrl());
            assertThat(service.createOrReuse(7L, 1)).isEqualTo(session.getUrl());
            assertThatThrownBy(() -> service.createOrReuse(7L, 2))
                    .isInstanceOf(CheckoutSessionService.CheckoutConflictException.class);
            service.markPaid(7L, session);
            assertThat(stored.get().isCompleted()).isTrue();
            assertThatThrownBy(() -> service.createOrReuse(7L, 1))
                    .isInstanceOf(CheckoutSessionService.CheckoutConflictException.class)
                    .hasMessageContaining("already complete");
            stripe.verify(() -> Session.create(any(SessionCreateParams.class), any(RequestOptions.class)), times(2));
        }
    }

    @Test
    void lateRetryOfUncertainSessionKeepsOriginalAttemptWithoutInvalidProviderRequest() {
        RunnerRepository runners = mock(RunnerRepository.class);
        Runner runner = new Runner();
        runner.setId(8L);
        runner.setEmail("runner@example.com");
        when(runners.findByIdForUpdate(8L)).thenReturn(Optional.of(runner));
        CheckoutAttemptRepository attempts = mock(CheckoutAttemptRepository.class);
        CheckoutAttempt attempt = new CheckoutAttempt(8L, 1, runner.getEmail(), "price_1", "https://example.com");
        org.springframework.test.util.ReflectionTestUtils.setField(attempt, "expiresAt", java.time.Instant.now().plusSeconds(1200).getEpochSecond());
        when(attempts.findById(8L)).thenReturn(Optional.of(attempt));
        PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
        when(transactions.getTransaction(any())).thenAnswer(call -> new SimpleTransactionStatus());
        CheckoutSessionService service = new CheckoutSessionService(runners, attempts, transactions,
                "sk_test", "price_1", "https://example.com");
        try (var provider = mockStatic(Session.class)) {
            assertThatThrownBy(() -> service.createOrReuse(8L, 1))
                    .isInstanceOf(CheckoutSessionService.CheckoutConflictException.class)
                    .hasMessageContaining("still being resolved");
            provider.verifyNoInteractions();
            verify(attempts, never()).save(any());
        }
    }
}
