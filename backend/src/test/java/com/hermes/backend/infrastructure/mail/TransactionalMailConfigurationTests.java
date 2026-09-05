package com.hermes.backend.infrastructure.mail;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TransactionalMailConfigurationTests {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(TransactionalMailConfiguration.class));

    @Test
    void registersDisabledSenderWhenNoProviderIsConfigured() {
        contextRunner.run(context -> {
            assertThat(context.getBeansOfType(TransactionalMailSender.class)).hasSize(1);

            TransactionalMailSender sender = context.getBean(TransactionalMailSender.class);
            assertThat(sender.isConfigured()).isFalse();
            assertThatThrownBy(() -> sender.send(new TransactionalMailMessage(
                    "runner@example.com",
                    "Subject",
                    "Text",
                    "<p>HTML</p>",
                    "idempotency-key")))
                    .isExactlyInstanceOf(MailDeliveryException.class)
                    .hasMessage("Transactional mail is not configured")
                    .satisfies(error -> {
                        MailDeliveryException exception = (MailDeliveryException) error;
                        assertThat(exception.getStatusCode()).isNull();
                        assertThat(exception.isRetryable()).isFalse();
                    });
        });
    }

    @Test
    void providerWinsWhenFallbackConfigurationIsRegisteredFirst() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(TransactionalMailConfiguration.class))
                .withUserConfiguration(ProviderConfiguration.class)
                .withPropertyValues("app.mail.provider=resend")
                .run(context -> {
                    assertThat(context.getBeansOfType(TransactionalMailSender.class)).hasSize(1);
                    assertThat(context.getBean(TransactionalMailSender.class))
                            .isExactlyInstanceOf(ProviderTransactionalMailSender.class);
                });
    }

    @Test
    void providerWinsWhenFallbackConfigurationIsRegisteredFirstWithDefaultProvider() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(TransactionalMailConfiguration.class))
                .withUserConfiguration(ProviderConfiguration.class)
                .run(context -> {
                    assertThat(context.getBeansOfType(TransactionalMailSender.class)).hasSize(1);
                    assertThat(context.getBean(TransactionalMailSender.class))
                            .isExactlyInstanceOf(ProviderTransactionalMailSender.class);
                });
    }

    @Test
    void keepsTwoLegitimateProvidersWhenProviderConfigurationIsAmbiguous() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(TransactionalMailConfiguration.class))
                .withUserConfiguration(AmbiguousProviderConfiguration.class)
                .run(context -> assertThat(context.getBeansOfType(TransactionalMailSender.class)).hasSize(2));
    }

    @Configuration(proxyBeanMethods = false)
    static class ProviderConfiguration {

        @Bean
        TransactionalMailSender providerSender() {
            return new ProviderTransactionalMailSender();
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class AmbiguousProviderConfiguration {

        @Bean(name = "transactionalMailSender")
        TransactionalMailSender primaryProviderSender() {
            return new ProviderTransactionalMailSender();
        }

        @Bean
        TransactionalMailSender secondaryProviderSender() {
            return new ProviderTransactionalMailSender();
        }
    }

    static class ProviderTransactionalMailSender implements TransactionalMailSender {

        @Override
        public boolean isConfigured() {
            return true;
        }

        @Override
        public MailDeliveryReceipt send(TransactionalMailMessage message) {
            return new MailDeliveryReceipt("provider-message-id");
        }
    }
}
