package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

class RecaptchaVerifierTests {

    @Test
    void verifyAllowsSignupWhenRecaptchaSecretIsNotConfigured() {
        RecaptchaVerifier verifier = new RecaptchaVerifier();
        ReflectionTestUtils.setField(verifier, "secretKey", "");

        assertThat(verifier.verify("", "signup")).isTrue();
    }
}
