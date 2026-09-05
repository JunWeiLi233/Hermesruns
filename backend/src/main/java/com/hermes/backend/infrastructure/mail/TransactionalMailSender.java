package com.hermes.backend.infrastructure.mail;

public interface TransactionalMailSender {
    boolean isConfigured();

    MailDeliveryReceipt send(TransactionalMailMessage message);
}
