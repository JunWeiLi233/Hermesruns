package com.hermes.backend.admin;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RunnerAdminNoteRepository extends JpaRepository<RunnerAdminNote, Long> {
    List<RunnerAdminNote> findByRunnerIdOrderByCreatedAtDesc(Long runnerId);

    @Query("""
            select n.runner.id, count(n)
            from RunnerAdminNote n
            where n.runner.id in :runnerIds
            group by n.runner.id
            """)
    List<Object[]> countGroupedByRunnerIds(Collection<Long> runnerIds);
}
