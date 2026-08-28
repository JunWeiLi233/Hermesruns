package com.hermes.backend;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class ResendAttemptStateTests {

    @Test
    void cancelBeforeSuccessfulPublicationCancelsSubscriberWhenItIsPublished() {
        ResendAttemptState state = new ResendAttemptState();
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(16);

        assertThat(state.cancelSuccessfulBody()).isNull();
        state.publishSuccessfulResponse(200, subscriber);

        assertThat(subscriber.getBody().toCompletableFuture()).isCancelled();
        assertThat(state.successfulResponse()).contains(new ResendAttemptState.SuccessfulResponse(200, subscriber));
    }

    @Test
    void publishThenCancelReturnsAndCancelsTheAtomicSuccessfulResponse() {
        ResendAttemptState state = new ResendAttemptState();
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(16);

        state.publishSuccessfulResponse(200, subscriber);

        assertThat(state.cancelSuccessfulBody())
                .isEqualTo(new ResendAttemptState.SuccessfulResponse(200, subscriber));
        assertThat(subscriber.getBody().toCompletableFuture()).isCancelled();
    }

    @Test
    void cancelRacingWithPublicationNeverMissesTheTerminalSubscriber() throws Exception {
        for (int iteration = 0; iteration < 200; iteration++) {
            ResendAttemptState state = new ResendAttemptState();
            BoundedBodySubscriber subscriber = new BoundedBodySubscriber(16);
            CountDownLatch start = new CountDownLatch(1);
            AtomicReference<Throwable> failure = new AtomicReference<>();
            Thread cancelThread = new Thread(() -> runAfter(start, state::cancelSuccessfulBody, failure));
            Thread publishThread = new Thread(() -> runAfter(
                    start, () -> state.publishSuccessfulResponse(200, subscriber), failure));

            cancelThread.start();
            publishThread.start();
            start.countDown();
            cancelThread.join(2_000);
            publishThread.join(2_000);

            assertThat(cancelThread.isAlive()).isFalse();
            assertThat(publishThread.isAlive()).isFalse();
            assertThat(failure.get()).isNull();
            assertThat(state.successfulResponse())
                    .contains(new ResendAttemptState.SuccessfulResponse(200, subscriber));
            assertThat(subscriber.getBody().toCompletableFuture()).isCancelled();
        }
    }

    @Test
    void statusAndSubscriberAreObservedOnlyAsOneSuccessfulResponse() {
        ResendAttemptState state = new ResendAttemptState();
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(16);

        assertThat(state.successfulResponse()).isEmpty();
        state.publishSuccessfulResponse(202, subscriber);

        ResendAttemptState.SuccessfulResponse response = state.successfulResponse().orElseThrow();
        assertThat(response.statusCode()).isEqualTo(202);
        assertThat(response.subscriber()).isSameAs(subscriber);
    }

    @Test
    void repeatedCancellationIsIdempotent() {
        ResendAttemptState state = new ResendAttemptState();
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(16);
        RecordingSubscription upstream = new RecordingSubscription();
        subscriber.onSubscribe(upstream);
        state.publishSuccessfulResponse(200, subscriber);

        state.cancelSuccessfulBody();
        state.cancelSuccessfulBody();

        assertThat(subscriber.getBody().toCompletableFuture()).isCancelled();
        assertThat(upstream.cancelCount()).isEqualTo(1);
    }

    private static void runAfter(CountDownLatch start, Runnable action, AtomicReference<Throwable> failure) {
        try {
            assertThat(start.await(2, TimeUnit.SECONDS)).isTrue();
            action.run();
        } catch (Throwable throwable) {
            failure.compareAndSet(null, throwable);
        }
    }

    private static final class RecordingSubscription implements Flow.Subscription {

        private final AtomicInteger cancelCount = new AtomicInteger();

        @Override
        public void request(long amount) {
        }

        @Override
        public void cancel() {
            cancelCount.incrementAndGet();
        }

        int cancelCount() {
            return cancelCount.get();
        }
    }
}
