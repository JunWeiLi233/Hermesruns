package com.hermes.backend.billing;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CheckoutSessionService {
    private final RunnerRepository runners;
    private final CheckoutAttemptRepository attempts;
    private final TransactionTemplate transactions;
    private final String apiKey;
    private final String priceId;
    private final String baseUrl;
    @PersistenceContext
    private EntityManager entityManager;

    public CheckoutSessionService(RunnerRepository runners, CheckoutAttemptRepository attempts,
            PlatformTransactionManager transactionManager,
            @Value("${app.billing.stripe.secret-key:}") String apiKey,
            @Value("${app.billing.stripe.price-pro-monthly:}") String priceId,
            @Value("${app.billing.public-base-url:http://localhost:8080}") String baseUrl) {
        this.runners = runners;
        this.attempts = attempts;
        this.transactions = new TransactionTemplate(transactionManager);
        this.transactions.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.apiKey = apiKey.trim();
        this.priceId = priceId.trim();
        this.baseUrl = baseUrl.trim().replaceAll("/+$", "");
    }

    public String createOrReuse(Long runnerId, int months) throws StripeException {
        // Commit before contacting Stripe: a timeout or process restart must reuse this exact request.
        CheckoutAttempt attempt = transactions.execute(status -> {
            Runner runner = runners.findByIdForUpdate(runnerId)
                    .filter(r -> !r.isDeleted()).orElseThrow(() -> new CheckoutConflictException("Account is unavailable."));
            if (entityManager != null) entityManager.refresh(runner, LockModeType.PESSIMISTIC_WRITE);
            CheckoutAttempt current = attempts.findById(runnerId).orElse(null);
            if (current != null && entityManager != null) entityManager.refresh(current);
            if (current != null && current.getExpiresAt() > Instant.now().getEpochSecond()) {
                if (current.isCompleted()) {
                    throw new CheckoutConflictException("This purchase is already complete. Refresh your billing status before starting another purchase.");
                }
                if (current.getMonths() != months) {
                    throw new CheckoutConflictException("A checkout is already active. Complete it or wait for it to expire before changing the purchase.");
                }
                return current;
            }
            return attempts.save(new CheckoutAttempt(runnerId, months, runner.getEmail(), priceId, baseUrl));
        });
        if (attempt.getSessionUrl() != null) {
            return attempt.getSessionUrl();
        }
        // Stripe requires expires_at >= 30 minutes for a new Session. If an uncertain request never
        // reached Stripe, replaying later cannot meet that rule. Keep the attempt until its original
        // expiry rather than changing parameters or issuing a second potentially payable session.
        if (attempt.getExpiresAt() - Instant.now().getEpochSecond() < 1800) {
            throw new CheckoutConflictException("A payment request is still being resolved. Wait for its checkout window to expire before retrying.");
        }
        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setCustomerEmail(attempt.getEmail())
                .setClientReferenceId(String.valueOf(runnerId))
                .putMetadata("runnerId", String.valueOf(runnerId))
                .putMetadata("months", String.valueOf(attempt.getMonths()))
                .putMetadata("checkoutAttempt", attempt.getIdempotencyKey())
                .setExpiresAt(attempt.getExpiresAt())
                .setSuccessUrl(attempt.getBaseUrl() + "/profile?checkout=success&session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(attempt.getBaseUrl() + "/profile?checkout=cancel")
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setPrice(attempt.getPriceId()).setQuantity((long) attempt.getMonths()).build())
                .build();
        Session session = Session.create(params, RequestOptions.builder()
                .setApiKey(apiKey).setIdempotencyKey(attempt.getIdempotencyKey()).build());
        if (session.getUrl() == null || session.getUrl().isBlank()) {
            throw new CheckoutConflictException("The payment session is unavailable. Retry shortly.");
        }
        transactions.executeWithoutResult(status -> {
            runners.findByIdForUpdate(runnerId).orElseThrow();
            CheckoutAttempt current = attempts.findById(runnerId).orElseThrow();
            if (entityManager != null) entityManager.refresh(current);
            if (current.getIdempotencyKey().equals(attempt.getIdempotencyKey())) {
                current.setSession(session.getId(), session.getUrl());
                attempts.save(current);
            }
        });
        return session.getUrl();
    }

    @Transactional
    public void markPaid(Long runnerId, Session session) {
        // Called by fulfillment while it holds the runner lock in the same transaction.
        CheckoutAttempt current = attempts.findById(runnerId).orElse(null);
        if (current == null) return;
        if (entityManager != null) entityManager.refresh(current);
        String attemptKey = session.getMetadata() == null ? null : session.getMetadata().get("checkoutAttempt");
        if (session.getId().equals(current.getSessionId()) || current.getIdempotencyKey().equals(attemptKey)) {
            current.markCompleted();
            attempts.save(current);
        }
    }

    public static class CheckoutConflictException extends IllegalStateException {
        public CheckoutConflictException(String message) { super(message); }
    }
}
