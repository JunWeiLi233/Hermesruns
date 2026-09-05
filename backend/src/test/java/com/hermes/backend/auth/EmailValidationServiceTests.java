package com.hermes.backend.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import java.time.Clock;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EmailValidationServiceTests {

    @Test
    void rejectsInvalidSyntax() {
        EmailValidationService service = service(domain -> true, true);

        assertThat(service.validateSignupEmail(null).status()).isEqualTo(EmailValidationService.Status.INVALID_SYNTAX);
        assertThat(service.validateSignupEmail("").status()).isEqualTo(EmailValidationService.Status.INVALID_SYNTAX);
        assertThat(service.validateSignupEmail("no-at-sign.example.com").status()).isEqualTo(EmailValidationService.Status.INVALID_SYNTAX);
        assertThat(service.validateSignupEmail("a@b").status()).isEqualTo(EmailValidationService.Status.INVALID_SYNTAX);
        assertThat(service.validateSignupEmail("a@127.0.0.1").status()).isEqualTo(EmailValidationService.Status.INVALID_SYNTAX);
        assertThat(service.validateSignupEmail("a@ex_mple.com").status()).isEqualTo(EmailValidationService.Status.INVALID_SYNTAX);
        assertThat(service.validateSignupEmail("a b@example.com").status()).isEqualTo(EmailValidationService.Status.INVALID_SYNTAX);
        assertThat(service.validateSignupEmail(".dot@example.com").status()).isEqualTo(EmailValidationService.Status.INVALID_SYNTAX);
        assertThat(service.validateSignupEmail("a..b@example.com").status()).isEqualTo(EmailValidationService.Status.INVALID_SYNTAX);
        assertThat(service.validateSignupEmail("a@-bad.com").status()).isEqualTo(EmailValidationService.Status.INVALID_SYNTAX);
        assertThat(service.validateSignupEmail("a@bad-.com").status()).isEqualTo(EmailValidationService.Status.INVALID_SYNTAX);
        assertThat(service.validateSignupEmail("a@" + "x".repeat(64) + ".com").status()).isEqualTo(EmailValidationService.Status.INVALID_SYNTAX);
    }

    @Test
    void acceptsWellFormedDeliverableEmail() {
        EmailValidationService service = service(domain -> true, true);

        assertThat(service.validateSignupEmail("runner@hermes.test").status())
                .isEqualTo(EmailValidationService.Status.VALID);
        assertThat(service.validateSignupEmail("first.last+tag@sub.example-run.org").status())
                .isEqualTo(EmailValidationService.Status.VALID);
    }

    @Test
    void rejectsDisposableDomainIncludingSubdomains() {
        EmailValidationService service = service(domain -> true, true);

        assertThat(service.validateSignupEmail("a@mailinator.com").status())
                .isEqualTo(EmailValidationService.Status.DISPOSABLE);
        assertThat(service.validateSignupEmail("a@news.mailinator.com").status())
                .isEqualTo(EmailValidationService.Status.DISPOSABLE);
        assertThat(service.validateSignupEmail("a@10minutemail.com").status())
                .isEqualTo(EmailValidationService.Status.DISPOSABLE);
    }

    @Test
    void rejectsDomainWithoutMailRecordsAndSuggestsPopularFix() {
        EmailValidationService service = service(domain -> false, true);

        EmailValidationService.Verdict typo = service.validateSignupEmail("runner@gnail.con");
        assertThat(typo.status()).isEqualTo(EmailValidationService.Status.DOMAIN_UNDELIVERABLE);
        assertThat(typo.suggestedEmail()).isEqualTo("runner@gmail.com");

        EmailValidationService.Verdict random = service.validateSignupEmail("runner@xjpqzwvut.net");
        assertThat(random.status()).isEqualTo(EmailValidationService.Status.DOMAIN_UNDELIVERABLE);
        assertThat(random.suggestedEmail()).isNull();
    }

    @Test
    void failsOpenWhenDnsLookupThrows() {
        EmailValidationService service = service(domain -> {
            throw new IllegalStateException("dns unreachable");
        }, true);

        assertThat(service.validateSignupEmail("runner@hermes.test").status())
                .isEqualTo(EmailValidationService.Status.VALID);
    }

    @Test
    void skipsDnsWhenMailIsNotConfigured() {
        EmailValidationService service = service(domain -> false, false);

        assertThat(service.validateSignupEmail("runner@hermes.test").status())
                .isEqualTo(EmailValidationService.Status.VALID);
    }

    @Test
    void skipsDnsWhenDisabledByConfig() {
        EmailValidationService service = service(domain -> false, true, false);

        assertThat(service.validateSignupEmail("runner@hermes.test").status())
                .isEqualTo(EmailValidationService.Status.VALID);
    }

    @Test
    void cachesDomainVerdictPerDomain() {
        AtomicInteger lookups = new AtomicInteger();
        EmailValidationService service = service(domain -> {
            lookups.incrementAndGet();
            return true;
        }, true);

        service.validateSignupEmail("a@cache-test.example");
        service.validateSignupEmail("b@cache-test.example");
        service.validateSignupEmail("c@other-cache-test.example");

        assertThat(lookups.get()).isEqualTo(2);
    }

    private EmailValidationService service(EmailValidationService.DomainMailRecordLookup lookup, boolean mailConfigured) {
        return service(lookup, mailConfigured, true);
    }

    private EmailValidationService service(EmailValidationService.DomainMailRecordLookup lookup,
                                           boolean mailConfigured,
                                           boolean dnsEnabled) {
        EmailVerificationService emailVerificationService = mock(EmailVerificationService.class);
        when(emailVerificationService.isMailConfigured()).thenReturn(mailConfigured);
        TtlCacheStore cacheStore = TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC());
        return new EmailValidationService(cacheStore, emailVerificationService, lookup, dnsEnabled);
    }
}
