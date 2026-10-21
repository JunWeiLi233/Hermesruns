package com.hermes.backend.billing;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Cross-instance safety budget for all paid-provider attempts, including Pro/admin and failures.
 * USD is reserved at a configurable conservative per-call estimate, not an actual provider charge.
 */
@Service
public class AiSpendingBudget {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final boolean enabled;
    private final long dailyRequests;
    private final long monthlyRequests;
    private final BigDecimal dailyUsd;
    private final BigDecimal monthlyUsd;
    private final BigDecimal reservationUsd;
    private final Clock clock;

    @Autowired
    public AiSpendingBudget(JdbcTemplate jdbc, PlatformTransactionManager manager,
            @Value("${app.ai.budget.enabled:true}") boolean enabled,
            @Value("${app.ai.budget.daily-request-limit:200}") long dailyRequests,
            @Value("${app.ai.budget.monthly-request-limit:2000}") long monthlyRequests,
            @Value("${app.ai.budget.daily-usd-limit:5.00}") BigDecimal dailyUsd,
            @Value("${app.ai.budget.monthly-usd-limit:50.00}") BigDecimal monthlyUsd,
            @Value("${app.ai.budget.reservation-usd-per-request:0.10}") BigDecimal reservationUsd) {
        this(jdbc, manager, enabled, dailyRequests, monthlyRequests, dailyUsd, monthlyUsd, reservationUsd, Clock.systemUTC());
    }

    AiSpendingBudget(JdbcTemplate jdbc, PlatformTransactionManager manager, boolean enabled,
            long dailyRequests, long monthlyRequests, BigDecimal dailyUsd, BigDecimal monthlyUsd,
            BigDecimal reservationUsd, Clock clock) {
        if (dailyRequests < 0 || monthlyRequests < 0 || dailyUsd.signum() < 0 || monthlyUsd.signum() < 0
                || reservationUsd.signum() <= 0 || reservationUsd.scale() > 6) {
            throw new IllegalArgumentException("AI budget limits must be non-negative and reservation USD must be positive with at most 6 decimal places.");
        }
        this.jdbc = jdbc;
        this.transactions = new TransactionTemplate(manager);
        this.transactions.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.enabled = enabled;
        this.dailyRequests = dailyRequests;
        this.monthlyRequests = monthlyRequests;
        this.dailyUsd = dailyUsd;
        this.monthlyUsd = monthlyUsd;
        this.reservationUsd = reservationUsd;
        this.clock = clock;
    }

    public void reserve() {
        if (!enabled) return;
        LocalDate today = LocalDate.now(clock);
        String dailyKey = "day:" + today;
        String monthlyKey = "month:" + YearMonth.from(today);
        initialize(dailyKey);
        initialize(monthlyKey);
        // A rejected monthly reservation rolls back the daily increment too.
        transactions.executeWithoutResult(status -> {
            reserveWindow(dailyKey, dailyRequests, dailyUsd);
            reserveWindow(monthlyKey, monthlyRequests, monthlyUsd);
        });
    }

    private void initialize(String key) {
        // Own transaction: a simultaneous first insertion cannot poison the reservation transaction.
        try {
            transactions.executeWithoutResult(status -> {
                if (jdbc.queryForObject("select count(*) from ai_budget_window where id = ?", Long.class, key) == 0) {
                    jdbc.update("insert into ai_budget_window (id, reserved_requests, reserved_usd) values (?, 0, 0)", key);
                }
            });
        } catch (DuplicateKeyException ignored) {
            // Another instance initialized this UTC window first.
        }
    }

    private void reserveWindow(String key, long requestLimit, BigDecimal usdLimit) {
        int updated = jdbc.update("""
                update ai_budget_window
                set reserved_requests = reserved_requests + 1, reserved_usd = reserved_usd + ?
                where id = ? and reserved_requests < ? and reserved_usd + ? <= ?
                """, reservationUsd, key, requestLimit, reservationUsd, usdLimit);
        if (updated != 1) throw new AiBudgetExceededException();
    }
}
