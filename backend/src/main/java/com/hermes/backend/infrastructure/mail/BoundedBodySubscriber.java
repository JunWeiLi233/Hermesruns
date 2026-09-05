package com.hermes.backend.infrastructure.mail;

import java.io.ByteArrayOutputStream;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Flow;

final class BoundedBodySubscriber implements HttpResponse.BodySubscriber<BoundedBodySubscriber.Body> {

    private final int maximumBytes;
    private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    private final CompletableFuture<Body> body = new CompletableFuture<>();
    private Flow.Subscription subscription;
    private boolean terminal;

    BoundedBodySubscriber(int maximumBytes) {
        this.maximumBytes = maximumBytes;
    }

    @Override
    public CompletionStage<Body> getBody() {
        return body;
    }

    @Override
    public synchronized void onSubscribe(Flow.Subscription incomingSubscription) {
        if (terminal || subscription != null) {
            incomingSubscription.cancel();
            return;
        }
        subscription = incomingSubscription;
        incomingSubscription.request(1);
    }

    @Override
    public synchronized void onNext(List<ByteBuffer> buffers) {
        if (terminal) {
            return;
        }
        for (ByteBuffer buffer : buffers) {
            int remaining = buffer.remaining();
            if (remaining > maximumBytes - bytes.size()) {
                terminal = true;
                body.complete(Body.OVERFLOW);
                if (subscription != null) {
                    subscription.cancel();
                }
                return;
            }
            byte[] chunk = new byte[remaining];
            buffer.get(chunk);
            bytes.writeBytes(chunk);
        }
        if (subscription != null) {
            subscription.request(1);
        }
    }

    @Override
    public synchronized void onError(Throwable throwable) {
        if (terminal) {
            return;
        }
        terminal = true;
        body.completeExceptionally(throwable);
    }

    @Override
    public synchronized void onComplete() {
        if (terminal) {
            return;
        }
        terminal = true;
        body.complete(new Body(bytes.toByteArray(), false));
    }

    synchronized void cancel() {
        if (terminal) {
            return;
        }
        terminal = true;
        body.cancel(false);
        if (subscription != null) {
            subscription.cancel();
        }
    }

    record Body(byte[] bytes, boolean overflow) {

        static final Body DISCARDED = new Body(new byte[0], false);
        static final Body OVERFLOW = new Body(new byte[0], true);
    }
}
