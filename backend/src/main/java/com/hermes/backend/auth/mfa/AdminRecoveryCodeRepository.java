package com.hermes.backend.auth.mfa;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface AdminRecoveryCodeRepository extends JpaRepository<AdminRecoveryCode, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<AdminRecoveryCode> findByRunnerIdAndCodeHashAndUsedAtIsNull(Long runnerId, String codeHash);
    List<AdminRecoveryCode> findAllByRunnerIdAndUsedAtIsNull(Long runnerId);
    long deleteByRunnerId(Long runnerId);
}
