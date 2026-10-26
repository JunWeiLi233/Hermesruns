package com.hermes.backend.billing;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.infrastructure.config.SystemConfigService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.stripe.Stripe;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.checkout.SessionCreateParams;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(BillingConcurrencyTests.Config.class)
class BillingConcurrencyTests {
    @TestConfiguration
    @EnableTransactionManagement
    @EnableJpaRepositories(basePackages = {"com.hermes.backend.billing", "com.hermes.backend.runner"})
    static class Config {
        @Bean DataSource dataSource() {
            return new DriverManagerDataSource("jdbc:h2:mem:billing-concurrency;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=15000", "sa", "");
        }
        @Bean LocalContainerEntityManagerFactoryBean entityManagerFactory(DataSource source) {
            var factory = new LocalContainerEntityManagerFactoryBean();
            factory.setDataSource(source);
            factory.setPackagesToScan("com.hermes.backend.billing", "com.hermes.backend.runner");
            factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
            factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "create-drop",
                    "hibernate.physical_naming_strategy", "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
            return factory;
        }
        @Bean PlatformTransactionManager transactionManager(jakarta.persistence.EntityManagerFactory factory) {
            return new JpaTransactionManager(factory);
        }
        @Bean AiUsageService usage(RunnerRepository runners) { return new AiUsageService(runners, 3, 1000, 0); }
        @Bean AiUsageService otherUsage(RunnerRepository runners) { return new AiUsageService(runners, 3, 1000, 0); }
        @Bean QuotaService quota(RunnerRepository runners) { return new QuotaService(runners, 2, 0); }
        @Bean QuotaService otherQuota(RunnerRepository runners) { return new QuotaService(runners, 2, 0); }
        @Bean BillingRunnerDataPurger billingPurger() { return new BillingRunnerDataPurger(); }
        @Bean CheckoutSessionService checkout(RunnerRepository runners, CheckoutAttemptRepository attempts, PlatformTransactionManager tx) {
            return new CheckoutSessionService(runners, attempts, tx, "sk_test", "price_test", "https://example.com");
        }
        @Bean BillingController billing(RunnerRepository runners, @Qualifier("usage") AiUsageService usage,
                ProcessedStripeEventRepository events, CheckoutSessionService checkout) {
            return new BillingController(mock(AuthService.class), runners, usage, events,
                    "sk_test", "whsec_test", "price_test", "https://example.com", "", mock(SystemConfigService.class), checkout);
        }
    }

    @Autowired RunnerRepository runners;
    @Autowired ProcessedStripeEventRepository events;
    @Autowired CheckoutAttemptRepository attempts;
    @Autowired BillingController billing;
    @Autowired CheckoutSessionService checkout;
    @Autowired BillingRunnerDataPurger billingPurger;
    @Autowired PlatformTransactionManager transactionManager;
    @jakarta.persistence.PersistenceContext jakarta.persistence.EntityManager entityManager;
    @MockitoSpyBean(name = "usage") AiUsageService usage;
    @Autowired @Qualifier("otherUsage") AiUsageService otherUsage;
    @Autowired @Qualifier("quota") QuotaService quota;
    @Autowired @Qualifier("otherQuota") QuotaService otherQuota;

    Runner runner() { return runners.saveAndFlush(new Runner("billing-" + UUID.randomUUID() + "@hermes.test", "active")); }

    @Test
    void accountDeletionPurgesOnlyTheOwnersCheckoutAttempt() {
        Runner owner = runner();
        Runner other = runner();
        attempts.saveAndFlush(new CheckoutAttempt(owner.getId(), 1, owner.getEmail(), "price", "https://example.com"));
        attempts.saveAndFlush(new CheckoutAttempt(other.getId(), 1, other.getEmail(), "price", "https://example.com"));
        new org.springframework.transaction.support.TransactionTemplate(transactionManager)
                .executeWithoutResult(status -> billingPurger.purge(owner.getId()));
        assertThat(attempts.findById(owner.getId())).isEmpty();
        assertThat(attempts.findById(other.getId())).isPresent();
    }

    @Test
    void preloadedManagedAccountsAreRefreshedAfterWaitingForTheDatabaseLock() throws Exception {
        Runner owner = runner();
        java.util.concurrent.CyclicBarrier loaded = new java.util.concurrent.CyclicBarrier(12);
        List<Boolean> dailyResults = concurrently(12, i -> new org.springframework.transaction.support.TransactionTemplate(transactionManager)
                .execute(status -> {
                    Runner managed = entityManager.find(Runner.class, owner.getId());
                    await(loaded);
                    return (i % 2 == 0 ? usage : otherUsage).tryConsumeQuota(managed) == null;
                }));
        assertThat(dailyResults.stream().filter(Boolean::booleanValue).count()).isEqualTo(3);
        assertThat(runners.findById(owner.getId()).orElseThrow().getAiDailyScansUsed()).isEqualTo(3);

        java.util.concurrent.CyclicBarrier monthlyLoaded = new java.util.concurrent.CyclicBarrier(12);
        List<Boolean> monthlyResults = concurrently(12, i -> new org.springframework.transaction.support.TransactionTemplate(transactionManager)
                .execute(status -> {
                    Runner managed = entityManager.find(Runner.class, owner.getId());
                    await(monthlyLoaded);
                    return (i % 2 == 0 ? quota : otherQuota).tryConsumeFeature(managed, "shoe-scan");
                }));
        assertThat(monthlyResults.stream().filter(Boolean::booleanValue).count()).isEqualTo(2);
        assertThat(runners.findById(owner.getId()).orElseThrow().getShoeScanCount()).isEqualTo(2);
    }

    private void await(java.util.concurrent.CyclicBarrier barrier) {
        try { barrier.await(10, java.util.concurrent.TimeUnit.SECONDS); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }

    @Test
    void separateServiceInstancesAndDetachedAccountsCannotExceedDailyOrMonthlyQuota() throws Exception {
        Runner daily = runner();
        List<Runner> dailySnapshots = new ArrayList<>();
        for (int i = 0; i < 12; i++) dailySnapshots.add(runners.findById(daily.getId()).orElseThrow());
        List<Boolean> results = concurrently(12, i -> (i % 2 == 0 ? usage : otherUsage).tryConsumeQuota(dailySnapshots.get(i)) == null);
        assertThat(results.stream().filter(Boolean::booleanValue).count()).isEqualTo(3);
        assertThat(runners.findById(daily.getId()).orElseThrow().getAiDailyScansUsed()).isEqualTo(3);

        Runner monthly = runner();
        List<Runner> monthlySnapshots = new ArrayList<>();
        for (int i = 0; i < 12; i++) monthlySnapshots.add(runners.findById(monthly.getId()).orElseThrow());
        results = concurrently(12, i -> (i % 2 == 0 ? quota : otherQuota).tryConsumeFeature(monthlySnapshots.get(i), "shoe-scan"));
        assertThat(results.stream().filter(Boolean::booleanValue).count()).isEqualTo(2);
        assertThat(runners.findById(monthly.getId()).orElseThrow().getShoeScanCount()).isEqualTo(2);
    }

    @Test
    void simultaneousDifferentEventsForSamePaidCheckoutGrantOnlyOnce() throws Exception {
        Runner owner = runner();
        LocalDateTime expiry = LocalDateTime.now().plusDays(1).truncatedTo(ChronoUnit.MICROS);
        owner.setProExpiresAt(expiry);
        runners.saveAndFlush(owner);
        String session = "cs_" + UUID.randomUUID();
        assertThat(concurrently(12, i -> deliver(owner.getId(), "evt_" + UUID.randomUUID(), session))).allMatch(Boolean::booleanValue);
        assertThat(runners.findById(owner.getId()).orElseThrow().getProExpiresAt()).isEqualTo(expiry.plusMonths(1));
        assertThat(events.existsById("checkout:" + session)).isTrue();
    }

    @Test
    void independentPaymentsCannotLoseEntitlementExtensions() throws Exception {
        Runner owner = runner();
        LocalDateTime expiry = LocalDateTime.now().plusDays(1).truncatedTo(ChronoUnit.MICROS);
        owner.setProExpiresAt(expiry);
        runners.saveAndFlush(owner);
        assertThat(concurrently(6, i -> deliver(owner.getId(), "evt_" + UUID.randomUUID(), "cs_" + UUID.randomUUID()))).allMatch(Boolean::booleanValue);
        assertThat(runners.findById(owner.getId()).orElseThrow().getProExpiresAt()).isEqualTo(expiry.plusMonths(6));
    }

    @Test
    void failedGrantRollsBackReceiptsAndCanBeRetried() throws Exception {
        Runner owner = runner();
        String event = "evt_" + UUID.randomUUID();
        String session = "cs_" + UUID.randomUUID();
        doThrow(new IllegalStateException("simulated save failure")).when(usage).grantPro(any(), anyInt());
        assertThatThrownBy(() -> deliver(owner.getId(), event, session)).isInstanceOf(IllegalStateException.class);
        assertThat(events.existsById(event)).isFalse();
        assertThat(events.existsById("checkout:" + session)).isFalse();
        doCallRealMethod().when(usage).grantPro(any(), anyInt());
        assertThat(deliver(owner.getId(), event, session)).isTrue();
        assertThat(runners.findById(owner.getId()).orElseThrow().getSubscriptionTier()).isEqualTo("PRO");
    }

    @Test
    void concurrentCheckoutClicksShareOneDurableProviderIdempotencyKey() throws Exception {
        Runner owner = runner();
        Set<String> keys = ConcurrentHashMap.newKeySet();
        assertThat(concurrently(10, i -> {
            Session session = new Session();
            session.setId("cs_test");
            session.setUrl("https://checkout.stripe.com/same");
            try (var provider = mockStatic(Session.class)) {
                provider.when(() -> Session.create(any(SessionCreateParams.class), any(RequestOptions.class)))
                        .thenAnswer(call -> {
                            keys.add(((RequestOptions) call.getArgument(1)).getIdempotencyKey());
                            return session;
                        });
                return checkout.createOrReuse(owner.getId(), 1).equals(session.getUrl());
            }
        })).allMatch(Boolean::booleanValue);
        assertThat(keys).hasSize(1);
        assertThat(attempts.findById(owner.getId())).isPresent();
    }

    private boolean deliver(Long owner, String event, String session) throws Exception {
        String payload = """
                {"id":"%s","object":"event","api_version":"%s","type":"checkout.session.completed",
                "data":{"object":{"id":"%s","object":"checkout.session","mode":"payment","payment_status":"paid",
                "metadata":{"runnerId":"%s","months":"1"}}}}
                """.formatted(event, Stripe.API_VERSION, session, owner);
        String timestamp = String.valueOf(Instant.now().getEpochSecond());
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec("whsec_test".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String signature = "t=" + timestamp + ",v1=" + HexFormat.of().formatHex(mac.doFinal((timestamp + "." + payload).getBytes(StandardCharsets.UTF_8)));
        return billing.stripeWebhook(payload, signature).getStatusCode().is2xxSuccessful();
    }

    @FunctionalInterface interface Work { boolean run(int i) throws Exception; }
    private List<Boolean> concurrently(int count, Work work) throws Exception {
        var pool = Executors.newFixedThreadPool(count);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<Boolean>> futures = new ArrayList<>();
        try {
            for (int i = 0; i < count; i++) {
                int index = i;
                futures.add(pool.submit(() -> { go.await(); return work.run(index); }));
            }
            go.countDown();
            List<Boolean> results = new ArrayList<>();
            for (Future<Boolean> future : futures) results.add(future.get(30, java.util.concurrent.TimeUnit.SECONDS));
            return results;
        } finally { pool.shutdownNow(); }
    }
}
