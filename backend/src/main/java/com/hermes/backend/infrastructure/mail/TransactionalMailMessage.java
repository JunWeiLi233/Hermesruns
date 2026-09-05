package com.hermes.backend.infrastructure.mail;

public record TransactionalMailMessage(
        String to,
        String subject,
        String text,
        String html,
        String idempotencyKey) {
}
