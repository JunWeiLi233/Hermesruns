package com.hermes.backend.shoes;

final class ShoeNotFoundException extends RuntimeException {
    ShoeNotFoundException(String message) {
        super(message);
    }
}
