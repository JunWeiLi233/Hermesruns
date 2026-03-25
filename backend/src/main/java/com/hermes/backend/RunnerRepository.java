package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RunnerRepository extends JpaRepository<Runner, Long> {
    boolean existsByEmailIgnoreCase(String email);

    Optional<Runner> findByEmailIgnoreCase(String email);

    Optional<Runner> findBySessionToken(String sessionToken);

    Optional<Runner> findByStravaAthleteId(Long stravaAthleteId);

    List<Runner> findByDeletedFalseOrderByIdAsc();

    List<Runner> findByStravaAthleteIdIsNotNullAndStravaRefreshTokenIsNotNullAndDeletedFalse();

    Optional<Runner> findByGarminUserId(String garminUserId);

    Optional<Runner> findByEmailVerificationTokenHash(String emailVerificationTokenHash);
}