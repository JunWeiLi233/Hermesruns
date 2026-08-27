package com.hermes.backend.auth.mfa;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AdminMfaProfileRepository extends JpaRepository<AdminMfaProfile, Long> {
    Optional<AdminMfaProfile> findByRunnerId(Long runnerId);
    Optional<AdminMfaProfile> findByUserHandleB64(String userHandleB64);
}
