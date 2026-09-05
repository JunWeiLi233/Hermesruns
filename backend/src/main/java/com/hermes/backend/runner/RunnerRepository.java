package com.hermes.backend.runner;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
        select count(r)
        from Runner r
        where r.deleted = false
          and r.createdAt >= :start
          and r.createdAt < :end
    """)
    long countActiveByCreatedAtWindow(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("""
        select coalesce(sum(r.aiDailyScansUsed), 0)
        from Runner r
        where r.deleted = false and r.aiDailyResetDate = :date
    """)
    long sumAiDailyScansUsedForDate(@Param("date") LocalDate date);
}
