package com.hermes.backend;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class BoundedBodySubscriberTests {

    @Test
    void cancelBeforeOnSubscribeCancelsLateSubscriptionWithoutDemandAndCancelsBodyFuture() {
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(16);
        RecordingSubscription upstream = new RecordingSubscription();

        subscriber.cancel();
        subscriber.onSubscribe(upstream);

        assertThat(upstream.cancelCount()).isEqualTo(1);
        assertThat(upstream.requestCount()).isZero();
        assertThat(subscriber.getBody().toCompletableFuture()).isCancelled();
    }

    @Test
    void cancelAfterOnSubscribeCancelsUpstreamAndBodyFuture() {
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(16);
        RecordingSubscription upstream = new RecordingSubscription();

        subscriber.onSubscribe(upstream);
        subscriber.cancel();

        assertThat(upstream.requestCount()).isEqualTo(1);
        assertThat(upstream.cancelCount()).isEqualTo(1);
        assertThat(subscriber.getBody().toCompletableFuture()).isCancelled();
    }

    @Test
    void duplicateOnSubscribeCancelsOnlyTheDuplicateWithoutDuplicateDemand() {
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(16);
        RecordingSubscription first = new RecordingSubscription();
        RecordingSubscription duplicate = new RecordingSubscription();

        subscriber.onSubscribe(first);
        subscriber.onSubscribe(duplicate);

        assertThat(first.requestCount()).isEqualTo(1);
        assertThat(first.cancelCount()).isZero();
        assertThat(duplicate.requestCount()).isZero();
        assertThat(duplicate.cancelCount()).isEqualTo(1);
        subscriber.cancel();
        assertThat(first.cancelCount()).isEqualTo(1);
    }

    @Test
    void cancelRacingWithOnSubscribeNeverRequestsAfterCancellationAndAlwaysTerminates() throws Exception {
        for (int iteration = 0; iteration < 200; iteration++) {
            BoundedBodySubscriber subscriber = new BoundedBodySubscriber(16);
            RecordingSubscription upstream = new RecordingSubscription();
            CountDownLatch start = new CountDownLatch(1);
            AtomicReference<Throwable> failure = new AtomicReference<>();
            Thread cancelThread = new Thread(() -> runAfter(start, subscriber::cancel, failure));
            Thread subscribeThread = new Thread(() -> runAfter(start, () -> subscriber.onSubscribe(upstream), failure));

            cancelThread.start();
            subscribeThread.start();
            start.countDown();
            cancelThread.join(2_000);
            subscribeThread.join(2_000);

            assertThat(cancelThread.isAlive()).isFalse();
            assertThat(subscribeThread.isAlive()).isFalse();
            assertThat(failure.get()).isNull();
            assertThat(upstream.requestedAfterCancel()).isFalse();
            assertThat(subscriber.getBody().toCompletableFuture().isDone()).isTrue();
        }
    }

    @Test
    void terminalCompletionOrErrorCannotBeOverwrittenByLaterCancellation() {
        BoundedBodySubscriber completed = new BoundedBodySubscriber(16);
        RecordingSubscription completedUpstream = new RecordingSubscription();
        completed.onSubscribe(completedUpstream);
        completed.onComplete();
        completed.cancel();

        assertThat(completed.getBody().toCompletableFuture()).isDone().isNotCancelled().isNotCompletedExceptionally();
        assertThat(completedUpstream.cancelCount()).isZero();

        BoundedBodySubscriber failed = new BoundedBodySubscriber(16);
        RecordingSubscription failedUpstream = new RecordingSubscription();
        failed.onSubscribe(failedUpstream);
        failed.onError(new IllegalStateException("test"));
        failed.cancel();

        assertThat(failed.getBody().toCompletableFuture()).isDone().isNotCancelled().isCompletedExceptionally();
        assertThat(failedUpstream.cancelCount()).isZero();
    }

    @Test
    void overflowCancelsUpstreamAndReturnsOverflowSentinel() {
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(4);
        RecordingSubscription upstream = new RecordingSubscription();
        subscriber.onSubscribe(upstream);

        subscriber.onNext(List.of(ByteBuffer.wrap(new byte[] {1, 2, 3, 4, 5})));

        assertThat(upstream.cancelCount()).isEqualTo(1);
        BoundedBodySubscriber.Body body = subscriber.getBody().toCompletableFuture().join();
        assertThat(body.overflow()).isTrue();
        assertThat(body.bytes()).isEmpty();
    }

    @Test
    void terminalCallbacksRacingWithCancellationLeaveOneDoneFutureAndNoPostCancellationDemand() throws Exception {
        for (int iteration = 0; iteration < 200; iteration++) {
            BoundedBodySubscriber subscriber = new BoundedBodySubscriber(16);
            RecordingSubscription upstream = new RecordingSubscription();
            subscriber.onSubscribe(upstream);
            CountDownLatch start = new CountDownLatch(1);
            AtomicReference<Throwable> failure = new AtomicReference<>();
            Thread cancelThread = new Thread(() -> runAfter(start, subscriber::cancel, failure));
            Thread nextThread = new Thread(() -> runAfter(
                    start, () -> subscriber.onNext(List.of(ByteBuffer.wrap(new byte[] {1}))), failure));
            Thread completeThread = new Thread(() -> runAfter(start, subscriber::onComplete, failure));
            Thread errorThread = new Thread(() -> runAfter(start,
                    () -> subscriber.onError(new IllegalStateException("test")), failure));

            cancelThread.start();
            nextThread.start();
            completeThread.start();
            errorThread.start();
            start.countDown();
            cancelThread.join(2_000);
            nextThread.join(2_000);
            completeThread.join(2_000);
            errorThread.join(2_000);

            assertThat(cancelThread.isAlive()).isFalse();
            assertThat(nextThread.isAlive()).isFalse();
            assertThat(completeThread.isAlive()).isFalse();
            assertThat(errorThread.isAlive()).isFalse();
            assertThat(failure.get()).isNull();
            assertThat(subscriber.getBody().toCompletableFuture().isDone()).isTrue();
            assertThat(upstream.requestCount()).isLessThanOrEqualTo(2);
            assertThat(upstream.requestedAfterCancel()).isFalse();
        }
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
        private final AtomicInteger requestCount = new AtomicInteger();
        private final AtomicBoolean cancelled = new AtomicBoolean();
        private final AtomicBoolean requestedAfterCancel = new AtomicBoolean();

        @Override
        public void request(long amount) {
            if (cancelled.get()) {
                requestedAfterCancel.set(true);
            }
            requestCount.incrementAndGet();
        }

        @Override
        public void cancel() {
            cancelCount.incrementAndGet();
            cancelled.set(true);
        }

        int cancelCount() {
            return cancelCount.get();
        }

        int requestCount() {
            return requestCount.get();
        }

        boolean requestedAfterCancel() {
            return requestedAfterCancel.get();
        }
    }
}
