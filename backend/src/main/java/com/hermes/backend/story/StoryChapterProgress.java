package com.hermes.backend.story;

import com.hermes.backend.runner.Runner;
import jakarta.persistence.*;
import java.time.Instant;

/** The postcard and its first earned time are derived from this completion, never separate writes. */
@Entity
@Table(name = "story_chapter_progress", uniqueConstraints = @UniqueConstraint(columnNames = {"runner_id", "chapter_id"}))
public class StoryChapterProgress {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) @JoinColumn(name = "runner_id", nullable = false) Runner runner;
    @Column(name = "chapter_id", nullable = false, length = 32) String chapterId;
    @Column(length = 8) String branch;
    @Column(nullable = false) Instant startedAt;
    Instant completedAt;
    protected StoryChapterProgress() {}
    StoryChapterProgress(Runner runner, String chapterId, Instant now) { this.runner = runner; this.chapterId = chapterId; this.startedAt = now; }
}
