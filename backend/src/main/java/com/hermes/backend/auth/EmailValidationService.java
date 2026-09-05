package com.hermes.backend.auth;

import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import java.time.Duration;
import java.util.Hashtable;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import javax.naming.Context;
import javax.naming.NameNotFoundException;
import javax.naming.NamingException;
import javax.naming.directory.Attributes;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Pre-send signup validation: strict syntax, disposable-domain blocklist, and DNS MX/A checks.
 * The verification email stays the authoritative proof a mailbox exists; this service only
 * filters obviously fake addresses before a runner row is created and a mail is attempted.
 * DNS resolution failures fail open so a flaky resolver never blocks a real runner.
 */
@Service
public class EmailValidationService {

    private static final Logger log = LoggerFactory.getLogger(EmailValidationService.class);
    private static final String DNS_CACHE_NAMESPACE = "email-domain-dns";
    private static final Duration DNS_POSITIVE_TTL = Duration.ofHours(24);
    private static final Duration DNS_NEGATIVE_TTL = Duration.ofHours(1);
    private static final int DNS_TIMEOUT_MILLIS = 2000;
    private static final int MAX_TYPO_DISTANCE = 2;

    public enum Status { VALID, INVALID_SYNTAX, DISPOSABLE, DOMAIN_UNDELIVERABLE }

    public record Verdict(Status status, String suggestedEmail) {
        public static final Verdict VALID = new Verdict(Status.VALID, null);
    }

    @FunctionalInterface
    public interface DomainMailRecordLookup {
        /** @return true when the domain publishes MX or A records; false when it provably does not. */
        boolean hasMailRecords(String domain);
    }

    private static final Set<String> DISPOSABLE_DOMAINS = Set.of(
            "027168.com", "10minutemail.com", "10minutemail.net", "10minutemail.org", "10minutemail.info",
            "1secmail.com", "1secmail.net", "1secmail.org", "20minutemail.com", "33mail.com",
            "bccto.me", "byom.de", "burnermail.io", "chacuo.net", "cool.fr.nf", "courriel.fr.nf",
            "cust.in", "discard.email", "dispostable.com", "dropmail.me", "dropmail.net",
            "email-fake.com", "emailfake.com", "emailondeck.com", "esiix.com", "fakeinbox.com",
            "fake-mail.net", "fakeemail.net", "getairmail.com", "getairmail.net", "getnada.com",
            "grr.la", "gustr.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
            "guerrillamail.biz", "guerrillamailblock.com", "guerrillamail.info", "jetable.fr.nf",
            "laafd.com", "letthemeatspam.com", "linshiyouxiang.net", "mail.tm", "mail.gw",
            "mail7.io", "mailcatch.com", "mailde.de", "mailde.info", "maildrop.cc",
            "mailin8r.com", "mailinator.com", "mailinator.net", "mailinator2.com", "mailnesia.com",
            "mailtemp.net", "mailtemp.info", "mail-temp.com", "moakt.com", "moakt.co",
            "mohmal.com", "mohmal.im", "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
            "mytemp.email", "mytrashmail.com", "nada.email", "nospam.ze.tc", "pokemail.net",
            "sharklasers.com", "snapmail.cc", "sogetthis.com", "spam4.me", "spambog.com",
            "spambog.de", "spambog.ru", "spamhere.com", "suremail.info", "tempemail.net",
            "tempemail.co", "tempinbox.com", "temp-mail.io", "temp-mail.me", "temp-mail.org",
            "tempmail.com", "tempmail.net", "tempmail.org", "tempmail.plus", "tempmailaddress.com",
            "tempmailo.com", "tempr.email", "throwawaymail.com", "throwawaymail.net",
            "tinoza.org", "trashmail.com", "trashmail.de", "trashmail.net", "trashmail.org",
            "trash-mail.com", "trash-mail.de", "txcct.com", "u-mail.net", "vjuum.com",
            "vomoto.com", "wegwerfmail.de", "wegwerfmail.net", "wwjmp.com", "xojxe.com",
            "yoggm.com", "yopmail.com", "yopmail.fr", "yopmail.net");

    private static final Set<String> POPULAR_DOMAINS = Set.of(
            "aol.com", "comcast.net", "foxmail.com", "gmail.com", "googlemail.com", "hotmail.com",
            "icloud.com", "live.com", "me.com", "msn.com", "outlook.com", "proton.me",
            "protonmail.com", "sina.com", "yahoo.com", "yeah.net", "126.com", "163.com", "qq.com");

    private static final String LOCAL_PART = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*";
    private static final String LABEL = "[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?";
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "^" + LOCAL_PART + "@" + LABEL + "(?:\\." + LABEL + ")+$");
    private static final Pattern ALPHA_TLD_PATTERN = Pattern.compile("\\.[A-Za-z]{2,}$");

    private final TtlCacheStore cacheStore;
    private final EmailVerificationService emailVerificationService;
    private final DomainMailRecordLookup dnsLookup;
    private final boolean dnsEnabled;

    @Autowired
    public EmailValidationService(
            TtlCacheStore cacheStore,
            EmailVerificationService emailVerificationService,
            @Value("${app.email-validation.dns-enabled:true}") boolean dnsEnabled) {
        this(cacheStore, emailVerificationService, EmailValidationService::lookupMailRecordsViaDns, dnsEnabled);
    }

    EmailValidationService(TtlCacheStore cacheStore,
                           EmailVerificationService emailVerificationService,
                           DomainMailRecordLookup dnsLookup,
                           boolean dnsEnabled) {
        this.cacheStore = cacheStore;
        this.emailVerificationService = emailVerificationService;
        this.dnsLookup = dnsLookup;
        this.dnsEnabled = dnsEnabled;
    }

    public Verdict validateSignupEmail(String normalizedEmail) {
        if (normalizedEmail == null
                || normalizedEmail.length() > 254
                || !EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            return new Verdict(Status.INVALID_SYNTAX, null);
        }
        String domain = domainOf(normalizedEmail);
        if (!ALPHA_TLD_PATTERN.matcher(domain).find()) {
            return new Verdict(Status.INVALID_SYNTAX, null);
        }
        if (isDisposableDomain(domain)) {
            return new Verdict(Status.DISPOSABLE, null);
        }
        if (dnsCheckEnabled()) {
            Boolean deliverable = cachedDomainDeliverable(domain);
            if (Boolean.FALSE.equals(deliverable)) {
                return new Verdict(Status.DOMAIN_UNDELIVERABLE, suggestPopularEmail(normalizedEmail, domain));
            }
        }
        return Verdict.VALID;
    }

    private boolean dnsCheckEnabled() {
        // Without a configured mail server no verification mail will ever go out, so a DNS
        // verdict is noise; skipping it keeps local H2 development signup working offline.
        return dnsEnabled && emailVerificationService.isMailConfigured();
    }

    private Boolean cachedDomainDeliverable(String domain) {
        Optional<Boolean> cached = cacheStore.get(DNS_CACHE_NAMESPACE, domain, Boolean.class);
        if (cached.isPresent()) {
            return cached.get();
        }
        boolean hasMailRecords;
        try {
            hasMailRecords = dnsLookup.hasMailRecords(domain);
        } catch (RuntimeException e) {
            log.warn("Email DNS lookup failed for domain {}; failing open", domain, e);
            return null;
        }
        cacheStore.put(DNS_CACHE_NAMESPACE, domain, hasMailRecords,
                hasMailRecords ? DNS_POSITIVE_TTL : DNS_NEGATIVE_TTL);
        return hasMailRecords;
    }

    private static boolean isDisposableDomain(String domain) {
        if (DISPOSABLE_DOMAINS.contains(domain)) {
            return true;
        }
        int lastDot = domain.lastIndexOf('.');
        if (lastDot < 0) {
            return false;
        }
        // subdomain check: mail.foo.mailinator.com -> foo.mailinator.com -> mailinator.com
        String parent = domain.substring(domain.lastIndexOf('.', lastDot - 1) + 1);
        return DISPOSABLE_DOMAINS.contains(parent);
    }

    private static String suggestPopularEmail(String email, String domain) {
        String best = null;
        int bestDistance = MAX_TYPO_DISTANCE + 1;
        for (String popular : POPULAR_DOMAINS) {
            if (popular.equals(domain)) {
                return null;
            }
            int distance = levenshtein(domain, popular);
            if (distance > 0 && distance < bestDistance) {
                bestDistance = distance;
                best = popular;
            }
        }
        return best == null ? null : email.substring(0, email.indexOf('@') + 1) + best;
    }

    static boolean lookupMailRecordsViaDns(String domain) {
        Hashtable<String, String> env = new Hashtable<>();
        env.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.dns.DnsContextFactory");
        env.put("com.sun.jndi.dns.timeout.initial", String.valueOf(DNS_TIMEOUT_MILLIS));
        env.put("com.sun.jndi.dns.timeout.retries", "2");
        DirContext ctx = null;
        try {
            ctx = new InitialDirContext(env);
            Attributes attrs = ctx.getAttributes(domain, new String[]{"MX", "A"});
            return attrs.get("MX") != null || attrs.get("A") != null;
        } catch (NameNotFoundException e) {
            return false;
        } catch (NamingException e) {
            throw new IllegalStateException("DNS lookup failed for " + domain, e);
        } finally {
            if (ctx != null) {
                try {
                    ctx.close();
                } catch (NamingException ignored) {
                    // close is best-effort; the lookup verdict already stands
                }
            }
        }
    }

    private static String domainOf(String email) {
        return email.substring(email.lastIndexOf('@') + 1).toLowerCase();
    }

    private static int levenshtein(String a, String b) {
        int[] prev = new int[b.length() + 1];
        int[] curr = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) {
            prev[j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            curr[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                curr[j] = Math.min(Math.min(curr[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }
            int[] swap = prev;
            prev = curr;
            curr = swap;
        }
        return prev[b.length()];
    }
}
