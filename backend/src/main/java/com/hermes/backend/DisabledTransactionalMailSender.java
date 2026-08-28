package com.hermes.backend;

public class DisabledTransactionalMailSender implements TransactionalMailSender {

    @Override
    public boolean isConfigured() {
        return false;
    }

    @Override
    public MailDeliveryReceipt send(TransactionalMailMessage message) {
        throw new MailDeliveryException("Transactional mail is not configured", null, false);
    }
}
