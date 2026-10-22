package com.hermes.backend.story;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoryChapterProgressRepository extends JpaRepository<StoryChapterProgress, Long> {
    List<StoryChapterProgress> findByRunnerId(Long runnerId);
    Optional<StoryChapterProgress> findByRunnerIdAndChapterId(Long runnerId, String chapterId);
}
