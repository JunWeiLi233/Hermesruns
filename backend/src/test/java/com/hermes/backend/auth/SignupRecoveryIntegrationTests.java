package com.hermes.backend.auth;

import com.hermes.backend.infrastructure.mail.MailDeliveryException;
import com.hermes.backend.infrastructure.mail.MailDeliveryReceipt;
import com.hermes.backend.infrastructure.mail.TransactionalMailSender;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:signup-recovery;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.mail.provider=disabled"
})
class SignupRecoveryIntegrationTests {
    private static final String PASSWORD = "TestOnly-Signup!2026";

    @Autowired private EmailVerificationService verification;
    @Autowired private RunnerRepository runners;
    @Autowired private AuthService auth;
    @Autowired private LoginController controller;
    @MockitoBean private TransactionalMailSender sender;
    @MockitoBean private EmailValidationService emailValidation;
    @MockitoBean private RecaptchaVerifier captcha;

    @BeforeEach
    void configure() {
        when(sender.isConfigured()).thenReturn(true);
        when(sender.send(any())).thenReturn(new MailDeliveryReceipt("test-message"));
        when(captcha.verify(any(), any())).thenReturn(true);
        when(emailValidation.validateSignupEmail(any()))
                .thenReturn(new EmailValidationService.Verdict(EmailValidationService.Status.VALID, null));
    }

    @Test
    void unexpectedMailFailureRollsBackNewAccountAndAllowsRetry() {
        String email = email();
        doThrow(new IllegalStateException("test mail client unavailable")).when(sender).send(any());

        assertThat(controller.signup(body(email, PASSWORD), request()).getStatusCode())
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(runners.findByEmailIgnoreCase(email)).isEmpty();

        org.mockito.Mockito.doReturn(new MailDeliveryReceipt("retry-message")).when(sender).send(any());
        assertThat(controller.signup(body(email, PASSWORD), request()).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(runners.findByEmailIgnoreCase(email)).get().satisfies(runner -> {
            assertThat(runner.isEmailVerified()).isFalse();
            assertThat(runner.getEmailVerificationTokenHash()).isNotBlank();
        });
    }

    @Test
    void providerFailureRollsBackNewAccount() {
        String email = email();
        doThrow(new MailDeliveryException("test provider unavailable", 503, true)).when(sender).send(any());
        assertThat(controller.signup(body(email, PASSWORD), request()).getStatusCode())
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(runners.findByEmailIgnoreCase(email)).isEmpty();
    }

    @Test
    void resendFailurePreservesPreviouslyIssuedVerificationToken() {
        Runner runner = unverifiedRunner();
        runner.setEmailVerificationTokenHash("previous-valid-token");
        runner.setEmailVerificationExpiresAt(LocalDateTime.now().plusHours(2));
        runners.save(runner);
        doThrow(new MailDeliveryException("test provider unavailable", 503, true)).when(sender).send(any());

        assertThatThrownBy(() -> verification.resendVerification(runner)).isInstanceOf(MailDeliveryException.class);
        assertThat(runners.findById(runner.getId())).get()
                .extracting(Runner::getEmailVerificationTokenHash).isEqualTo("previous-valid-token");
    }

    @Test
    void pendingAccountWithCorrectPasswordCanContinueVerificationWithoutBeingOverwritten() {
        Runner runner = unverifiedRunner();
        String hash = runner.getPassword();
        var response = controller.signup(body(runner.getEmail(), PASSWORD), request());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(((Map<?, ?>) response.getBody()).get("code")).isEqualTo("EMAIL_VERIFICATION_PENDING");
        assertThat(runners.findById(runner.getId())).get().satisfies(stored -> {
            assertThat(stored.getPassword()).isEqualTo(hash);
            assertThat(stored.isEmailVerified()).isFalse();
            assertThat(stored.getSessionToken()).isNull();
        });
        verify(sender, never()).send(any());
    }

    @Test
    void pendingAccountRejectsDifferentPasswordWithoutChangingIt() {
        Runner runner = unverifiedRunner();
        String hash = runner.getPassword();
        var response = controller.signup(body(runner.getEmail(), "Different-TestOnly!2026"), request());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(runners.findById(runner.getId())).get().extracting(Runner::getPassword).isEqualTo(hash);
        verify(sender, never()).send(any());
    }

    @Test
    void verifiedAccountStillDirectsUserToSignIn() {
        Runner runner = unverifiedRunner();
        runner.setEmailVerified(true);
        runners.save(runner);
        assertThat(controller.signup(body(runner.getEmail(), PASSWORD), request()).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
        verify(sender, never()).send(any());
    }

    @Test
    void failedReactivationPreservesDeletedAccountState() {
        Runner runner = unverifiedRunner();
        runner.setDeleted(true);
        runner.setStatus("DELETED");
        runners.save(runner);
        String hash = runner.getPassword();
        doThrow(new IllegalStateException("test mail client unavailable")).when(sender).send(any());

        assertThat(controller.signup(body(runner.getEmail(), "Replacement-TestOnly!2026"), request()).getStatusCode())
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(runners.findById(runner.getId())).get().satisfies(stored -> {
            assertThat(stored.isDeleted()).isTrue();
            assertThat(stored.getStatus()).isEqualTo("DELETED");
            assertThat(stored.getPassword()).isEqualTo(hash);
        });
    }

    private Runner unverifiedRunner() {
        Runner runner = new Runner();
        runner.setEmail(email());
        runner.setStatus("ACTIVE");
        runner.setEmailVerified(false);
        auth.storePassword(runner, PASSWORD);
        return runners.save(runner);
    }

    private String email() {
        return "signup-test-" + UUID.randomUUID() + "@gmail.com";
    }

    private Map<String, Object> body(String email, String password) {
        return Map.of("email", email, "password", password, "captchaToken", "test-only-captcha");
    }

    private MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("192.0.2." + (1 + Math.abs(UUID.randomUUID().hashCode() % 200)));
        return request;
    }
}
