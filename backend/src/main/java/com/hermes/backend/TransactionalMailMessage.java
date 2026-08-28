package com.hermes.backend;

public record TransactionalMailMessage(
        String to,
        String subject,
        String text,
        String html,
        String idempotencyKey) {
}
