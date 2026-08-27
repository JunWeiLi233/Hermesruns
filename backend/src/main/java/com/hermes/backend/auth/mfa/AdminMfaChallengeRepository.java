package com.hermes.backend.auth.mfa;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;

import java.time.LocalDateTime;
import java.util.Optional;

public interface AdminMfaChallengeRepository extends JpaRepository<AdminMfaChallenge, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<AdminMfaChallenge> findBySelectorHash(String selectorHash);
    long deleteByExpiresAtBefore(LocalDateTime cutoff);
}
