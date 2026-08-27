package com.hermes.backend.auth.mfa;

public class AdminMfaException extends RuntimeException {
    public AdminMfaException(String message) {
        super(message);
    }

    public AdminMfaException(String message, Throwable cause) {
        super(message, cause);
    }
}
