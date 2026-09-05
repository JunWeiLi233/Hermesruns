package com.hermes.backend.infrastructure.mail;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
public class TransactionalMailConfiguration {

    @Bean
    @ConditionalOnMissingBean(TransactionalMailSender.class)
    @ConditionalOnProperty(name = "app.mail.provider", havingValue = "disabled", matchIfMissing = true)
    public TransactionalMailSender transactionalMailSender() {
        return new DisabledTransactionalMailSender();
    }
}
