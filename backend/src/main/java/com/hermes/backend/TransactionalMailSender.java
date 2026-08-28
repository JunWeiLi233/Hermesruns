package com.hermes.backend;

public interface TransactionalMailSender {
    boolean isConfigured();

    MailDeliveryReceipt send(TransactionalMailMessage message);
}
