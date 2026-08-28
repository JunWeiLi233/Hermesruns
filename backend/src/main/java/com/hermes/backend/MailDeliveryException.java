package com.hermes.backend;

public class MailDeliveryException extends RuntimeException {

    private final Integer statusCode;
    private final boolean retryable;

    public MailDeliveryException(String message, Integer statusCode, boolean retryable) {
        this(message, statusCode, retryable, null);
    }

    public MailDeliveryException(String message, Integer statusCode, boolean retryable, Throwable cause) {
        super(message, cause);
        this.statusCode = statusCode;
        this.retryable = retryable;
    }

    public Integer getStatusCode() {
        return statusCode;
    }

    public boolean isRetryable() {
        return retryable;
    }
}
