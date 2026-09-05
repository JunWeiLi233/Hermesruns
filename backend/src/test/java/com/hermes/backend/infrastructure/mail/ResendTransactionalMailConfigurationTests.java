package com.hermes.backend.infrastructure.mail;

import java.net.URI;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.context.annotation.ImportCandidates;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

class ResendTransactionalMailConfigurationTests {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(
                    ResendTransactionalMailConfiguration.class,
                    TransactionalMailConfiguration.class));

    @Test
    void registersOnlyConfiguredResendSenderWhenResendProviderIsSelected() {
        contextRunner.withPropertyValues(
                "app.mail.provider=resend",
                "app.mail.resend.api-key=test-key",
                "app.mail.from=Hermes <mailer@example.test>",
                "app.mail.reply-to=support@example.test")
                .run(context -> {
                    assertThat(context.getBeansOfType(TransactionalMailSender.class)).hasSize(1);
                    assertThat(context.getBeansOfType(ResendTransactionalMailSender.class)).hasSize(1);
                    assertThat(context.getBeansOfType(DisabledTransactionalMailSender.class)).isEmpty();
                    assertThat(context.getBean(ResendTransactionalMailSender.class).isConfigured()).isTrue();
                });
    }

    @Test
    void ignoresEndpointOverrideAndUsesOnlyTheOfficialResendEndpoint() {
        contextRunner.withPropertyValues(
                "app.mail.provider=resend",
                "app.mail.resend.endpoint=http://127.0.0.1:1/credential-capture",
                "app.mail.resend.api-key=test-key",
                "app.mail.from=Hermes <mailer@example.test>",
                "app.mail.reply-to=support@example.test")
                .run(context -> assertThat(ReflectionTestUtils.getField(
                        context.getBean(ResendTransactionalMailSender.class), "endpoint"))
                        .isEqualTo(URI.create("https://api.resend.com/emails")));
    }

    @Test
    void backsOffWhenApplicationProvidesItsOwnTransactionalSender() {
        contextRunner.withUserConfiguration(CustomSenderConfiguration.class)
                .withPropertyValues("app.mail.provider=resend")
                .run(context -> {
                    assertThat(context.getBeansOfType(TransactionalMailSender.class)).hasSize(1);
                    assertThat(context.getBean(TransactionalMailSender.class))
                            .isExactlyInstanceOf(CustomTransactionalMailSender.class);
                    assertThat(context.getBeansOfType(ResendTransactionalMailSender.class)).isEmpty();
                });
    }

    @Test
    void registersOnlyDisabledSenderWhenProviderIsNotSelected() {
        contextRunner.run(context -> {
            assertThat(context.getBeansOfType(TransactionalMailSender.class)).hasSize(1);
            assertThat(context.getBeansOfType(ResendTransactionalMailSender.class)).isEmpty();
            assertThat(context.getBeansOfType(DisabledTransactionalMailSender.class)).hasSize(1);
        });
    }

    @Test
    void exposesUnconfiguredResendSenderForBlankCredentials() {
        contextRunner.withPropertyValues(
                "app.mail.provider=resend",
                "app.mail.resend.api-key= ",
                "app.mail.from= ",
                "app.mail.reply-to= ")
                .run(context -> {
                    assertThat(context.getBeansOfType(TransactionalMailSender.class)).hasSize(1);
                    assertThat(context.getBeansOfType(ResendTransactionalMailSender.class)).hasSize(1);
                    assertThat(context.getBeansOfType(DisabledTransactionalMailSender.class)).isEmpty();
                    assertThat(context.getBean(ResendTransactionalMailSender.class).isConfigured()).isFalse();
                });
    }

    @Test
    void registersResendBeforeFallbackThroughAutoConfigurationDiscovery() {
        var candidates = ImportCandidates.load(AutoConfiguration.class,
                        ResendTransactionalMailConfiguration.class.getClassLoader())
                .getCandidates();
        assertThat(candidates).contains(
                ResendTransactionalMailConfiguration.class.getName(),
                TransactionalMailConfiguration.class.getName());
        assertThat(candidates.indexOf(ResendTransactionalMailConfiguration.class.getName()))
                .isLessThan(candidates.indexOf(TransactionalMailConfiguration.class.getName()));
    }

    @Configuration(proxyBeanMethods = false)
    static class CustomSenderConfiguration {

        @Bean
        TransactionalMailSender customTransactionalMailSender() {
            return new CustomTransactionalMailSender();
        }
    }

    static class CustomTransactionalMailSender implements TransactionalMailSender {

        @Override
        public boolean isConfigured() {
            return true;
        }

        @Override
        public MailDeliveryReceipt send(TransactionalMailMessage message) {
            return new MailDeliveryReceipt("custom-provider-id");
        }
    }
}
