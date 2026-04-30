package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface ShoeRepository extends JpaRepository<Shoe, Long>, JpaSpecificationExecutor<Shoe> {

    List<Shoe> findByRunnerOrderByCreatedAtDesc(Runner runner);

    List<Shoe> findByRunnerAndRetiredFalseOrderByCreatedAtDesc(Runner runner);

    Optional<Shoe> findByIdAndRunner(Long id, Runner runner);

    List<Shoe> findByBrandIgnoreCaseAndModelIgnoreCase(String brand, String model);

    List<Shoe> findByRunnerAndIdentityKey(Runner runner, String identityKey);

    List<Shoe> findByRunnerAndRetiredFalseAndIdentityKeyNotNull(Runner runner);

    List<Shoe> findByRunnerAndRetiredTrueOrderByRetiredDateDesc(Runner runner);
}
