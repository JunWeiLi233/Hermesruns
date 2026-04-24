package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RunnerRepository extends JpaRepository<Runner, Long>, JpaSpecificationExecutor<Runner> {
    boolean existsByEmailIgnoreCase(String email);

    Optional<Runner> findByEmailIgnoreCase(String email);

    Optional<Runner> findBySessionToken(String sessionToken);

    Optional<Runner> findByStravaAthleteId(Long stravaAthleteId);

    List<Runner> findByDeletedFalseOrderByIdAsc();

    List<Runner> findByStravaAthleteIdIsNotNullAndStravaRefreshTokenIsNotNullAndDeletedFalse();

    List<Runner> findByGarminWellnessSyncEnabledTrueAndGarminConnectEmailIsNotNullAndDeletedFalse();

    Optional<Runner> findByEmailVerificationTokenHash(String emailVerificationTokenHash);

    Optional<Runner> findByPasswordResetTokenHash(String passwordResetTokenHash);

    long countByDeletedFalse();

    @Query("""
        select coalesce(sum(r.aiDailyScansUsed), 0)
        from Runner r
        where r.deleted = false and r.aiDailyResetDate = :date
    """)
    long sumAiDailyScansUsedForDate(@Param("date") LocalDate date);
}
