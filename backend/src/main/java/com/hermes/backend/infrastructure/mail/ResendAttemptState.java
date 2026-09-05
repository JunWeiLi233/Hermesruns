package com.hermes.backend.infrastructure.mail;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

final class ResendAttemptState {

    private final AtomicReference<SuccessfulResponse> successfulResponse = new AtomicReference<>();
    private final AtomicBoolean cancellationRequested = new AtomicBoolean();

    void publishSuccessfulResponse(int statusCode, BoundedBodySubscriber subscriber) {
        SuccessfulResponse response = new SuccessfulResponse(statusCode, subscriber);
        if (!successfulResponse.compareAndSet(null, response)) {
            return;
        }
        if (cancellationRequested.get()) {
            subscriber.cancel();
        }
    }

    Optional<SuccessfulResponse> successfulResponse() {
        return Optional.ofNullable(successfulResponse.get());
    }

    SuccessfulResponse cancelSuccessfulBody() {
        cancellationRequested.set(true);
        SuccessfulResponse response = successfulResponse.get();
        if (response != null) {
            response.subscriber().cancel();
        }
        return response;
    }

    record SuccessfulResponse(int statusCode, BoundedBodySubscriber subscriber) {
    }
}
