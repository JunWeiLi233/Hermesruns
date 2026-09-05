package com.hermes.backend.auth.mfa;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminMfaProfileRepository extends JpaRepository<AdminMfaProfile, Long> {
    Optional<AdminMfaProfile> findByRunnerId(Long runnerId);
    Optional<AdminMfaProfile> findByUserHandleB64(String userHandleB64);
}
