package com.hermes.backend.auth.mfa;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminPasskeyCredentialRepository extends JpaRepository<AdminPasskeyCredential, Long> {
    List<AdminPasskeyCredential> findAllByRunnerIdOrderByCreatedAtAsc(Long runnerId);
    Optional<AdminPasskeyCredential> findByCredentialIdB64(String credentialIdB64);
    boolean existsByRunnerId(Long runnerId);
    long countByRunnerId(Long runnerId);
}
