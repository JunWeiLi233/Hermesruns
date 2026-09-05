package com.hermes.backend.infrastructure.mail;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;

@AutoConfiguration(before = TransactionalMailConfiguration.class)
@ConditionalOnProperty(name = "app.mail.provider", havingValue = "resend")
public class ResendTransactionalMailConfiguration {

    private static final URI RESEND_ENDPOINT = URI.create("https://api.resend.com/emails");

    @Bean
    @ConditionalOnMissingBean(TransactionalMailSender.class)
    public ResendTransactionalMailSender resendTransactionalMailSender(
            @Value("${app.mail.resend.api-key:}") String apiKey,
            @Value("${app.mail.from:}") String from,
            @Value("${app.mail.reply-to:}") String replyTo) {
        return new ResendTransactionalMailSender(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build(),
                new ObjectMapper(),
                RESEND_ENDPOINT,
                apiKey,
                from,
                replyTo);
    }
}
