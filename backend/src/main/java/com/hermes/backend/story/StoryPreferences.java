package com.hermes.backend.story;

import com.hermes.backend.runner.Runner;
import jakarta.persistence.*;

@Entity
@Table(name = "story_preferences", uniqueConstraints = @UniqueConstraint(columnNames = "runner_id"))
public class StoryPreferences {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) @JoinColumn(name = "runner_id", nullable = false) Runner runner;
    @Column(nullable = false, length = 16) String mode = "invitation";
    @Column(length = 32) String currentChapterId;
    @Column(nullable = false, length = 16) String currentPanel = "shelf";
    protected StoryPreferences() {}
    StoryPreferences(Runner runner) { this.runner = runner; }
}
