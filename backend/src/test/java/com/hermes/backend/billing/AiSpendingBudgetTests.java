package com.hermes.backend.billing;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import static org.assertj.core.api.Assertions.*;

class AiSpendingBudgetTests {
    private final DriverManagerDataSource source = new DriverManagerDataSource(
            "jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000", "sa", "");
    private final JdbcTemplate jdbc = new JdbcTemplate(source);
    private final DataSourceTransactionManager transactions = new DataSourceTransactionManager(source);
    private final Clock today = Clock.fixed(Instant.parse("2026-10-21T12:00:00Z"), ZoneOffset.UTC);

    AiSpendingBudgetTests() {
        jdbc.execute("create table ai_budget_window (id varchar(64) primary key, reserved_requests bigint not null, reserved_usd decimal(19,6) not null)");
    }

    private AiSpendingBudget budget(long dailyRequests, long monthlyRequests, String dailyUsd, String monthlyUsd) {
        return new AiSpendingBudget(jdbc, transactions, true, dailyRequests, monthlyRequests,
                new BigDecimal(dailyUsd), new BigDecimal(monthlyUsd), new BigDecimal("0.10"), today);
    }

    @Test
    void dollarLimitBlocksBeforeRequestLimitAndDoesNotPartiallyReserve() {
        AiSpendingBudget budget = budget(100, 1000, "0.25", "10");
        budget.reserve();
        budget.reserve();
        assertThatThrownBy(budget::reserve).isInstanceOf(AiBudgetExceededException.class);
        assertThat(jdbc.queryForObject("select sum(reserved_requests) from ai_budget_window", Long.class)).isEqualTo(4L);
        assertThat(jdbc.queryForObject("select sum(reserved_usd) from ai_budget_window", BigDecimal.class))
                .isEqualByComparingTo("0.40");
    }

    @Test
    void monthlyBlockRollsBackDailyReservationAndPersistsAcrossServiceInstances() {
        budget(10, 1, "5", "50").reserve();
        AiSpendingBudget tomorrow = new AiSpendingBudget(jdbc, transactions, true, 10, 1,
                new BigDecimal("5"), new BigDecimal("50"), new BigDecimal("0.10"),
                Clock.offset(today, java.time.Duration.ofDays(1)));
        assertThatThrownBy(tomorrow::reserve).isInstanceOf(AiBudgetExceededException.class);
        assertThat(jdbc.queryForObject("select reserved_requests from ai_budget_window where id = 'day:2026-10-22'", Long.class))
                .isZero();
    }

    @Test
    void independentInstancesAndConnectionsCannotExceedSharedCap() throws Exception {
        List<AiSpendingBudget> services = List.of(budget(5, 100, "50", "100"), budget(5, 100, "50", "100"));
        var pool = Executors.newFixedThreadPool(12);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<Boolean>> results = new ArrayList<>();
        try {
            for (int i = 0; i < 30; i++) {
                AiSpendingBudget service = services.get(i % 2);
                results.add(pool.submit(() -> {
                    go.await();
                    try { service.reserve(); return true; }
                    catch (AiBudgetExceededException expected) { return false; }
                }));
            }
            go.countDown();
            int allowed = 0;
            for (Future<Boolean> result : results) if (result.get()) allowed++;
            assertThat(allowed).isEqualTo(5);
        } finally { pool.shutdownNow(); }
    }

    @Test
    void zeroRequestLimitStopsAllCallsAndInvalidCostCannotDisableDollarBudget() {
        assertThatThrownBy(() -> budget(0, 100, "5", "50").reserve()).isInstanceOf(AiBudgetExceededException.class);
        assertThatThrownBy(() -> new AiSpendingBudget(jdbc, transactions, true, 10, 100,
                BigDecimal.TEN, BigDecimal.TEN, BigDecimal.ZERO, today)).isInstanceOf(IllegalArgumentException.class);
    }
}
