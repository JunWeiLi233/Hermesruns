package com.hermes.backend.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import javax.naming.directory.BasicAttributes;
import javax.naming.directory.InitialDirContext;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;

class EmailValidationServiceTests {

    @Test
    void queriesMxExplicitlyWhenCombinedDnsResponsesOmitMailRecords() throws Exception {
        try (var contexts = mockConstruction(InitialDirContext.class, (ctx, context) -> {
            when(ctx.getAttributes(eq("mail.example"), any(String[].class))).thenAnswer(call -> {
                String[] types = call.getArgument(1);
                BasicAttributes records = new BasicAttributes(true);
                if (types.length == 1 && "MX".equals(types[0])) records.put("MX", "10 inbound.example.");
                return records;
            });
        })) {
            assertThat(EmailValidationService.lookupMailRecordsViaDns("mail.example")).isTrue();
            verify(contexts.constructed().get(0)).getAttributes("mail.example", new String[]{"MX"});
            verify(contexts.constructed().get(0)).close();
        }
    }

    @Test
    void queriesAddressSeparatelyWhenTheDomainHasNoMx() throws Exception {
        try (var contexts = mockConstruction(InitialDirContext.class, (ctx, context) -> {
            when(ctx.getAttributes(eq("address.example"), any(String[].class))).thenAnswer(call -> {
                String[] types = call.getArgument(1);
                BasicAttributes records = new BasicAttributes(true);
                if (types.length == 1 && "A".equals(types[0])) records.put("A", "192.0.2.20");
                return records;
            });
        })) {
            assertThat(EmailValidationService.lookupMailRecordsViaDns("address.example")).isTrue();
            verify(contexts.constructed().get(0)).getAttributes("address.example", new String[]{"MX"});
            verify(contexts.constructed().get(0)).getAttributes("address.example", new String[]{"A"});
            verify(contexts.constructed().get(0)).close();
        }
    }

    @Test
    void stillRejectsDomainsWithoutMxOrAddressRecords() {
        try (var contexts = mockConstruction(InitialDirContext.class, (ctx, context) -> {
            when(ctx.getAttributes(eq("missing.example"), any(String[].class)))
                    .thenReturn(new BasicAttributes(true));
        })) {
            assertThat(EmailValidationService.lookupMailRecordsViaDns("missing.example")).isFalse();
        }
    }

    @Test
    void ignoresNegativeCacheEntriesFromTheOldCombinedDnsLookup() {
        TtlCacheStore cache = TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC());
        cache.put("email-domain-dns", "mail.example", false, Duration.ofHours(1));
        EmailVerificationService verification = mock(EmailVerificationService.class);
        when(verification.isMailConfigured()).thenReturn(true);
        EmailValidationService service = new EmailValidationService(cache, verification, domain -> true, true);

        assertThat(service.validateSignupEmail("runner@mail.example").status())
                .isEqualTo(EmailValidationService.Status.VALID);
    }

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
