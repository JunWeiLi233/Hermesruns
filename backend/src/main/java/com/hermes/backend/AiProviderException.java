package com.hermes.backend;

public class AiProviderException extends IllegalStateException {
    private final String provider;
    private final String operation;
    private final boolean retryable;

    public AiProviderException(String provider, String operation, String message, boolean retryable) {
        super(message);
        this.provider = provider;
        this.operation = operation;
        this.retryable = retryable;
    }

    public AiProviderException(String provider, String operation, String message, boolean retryable, Throwable cause) {
        super(message, cause);
        this.provider = provider;
        this.operation = operation;
        this.retryable = retryable;
    }

    public String provider() {
        return provider;
    }

    public String operation() {
        return operation;
    }

    public boolean retryable() {
        return retryable;
    }
}
