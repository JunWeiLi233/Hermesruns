package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
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

    @Query("""
        select count(s)
        from Shoe s
        where s.createdAt >= :start
          and s.createdAt < :end
    """)
    long countByCreatedAtWindow(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
