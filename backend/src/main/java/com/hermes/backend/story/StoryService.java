package com.hermes.backend.story;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.Clock;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StoryService {
    public static final List<String> CHAPTERS = List.of("lantern", "seed-library", "last-ferry");
    private final RunnerRepository runners;
    private final StoryPreferencesRepository preferences;
    private final StoryChapterProgressRepository chapters;
    private final Clock clock;
    public StoryService(RunnerRepository runners, StoryPreferencesRepository preferences, StoryChapterProgressRepository chapters, Clock clock) {
        this.runners = runners; this.preferences = preferences; this.chapters = chapters; this.clock = clock;
    }
    public record Chapter(String chapterId, String status, String branch, String startedAt, String completedAt, String postcardId, String earnedAt) {}
    public record State(String mode, String currentChapterId, String currentPanel, List<Chapter> chapters) {}

    @Transactional(readOnly = true)
    public State read(Long runnerId) {
        Runner runner = runners.findById(runnerId).filter(r -> !r.isDeleted())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return state(runner.getId());
    }
    @Transactional
    public State preference(Long runnerId, String mode, boolean shelf) {
        if (!List.of("invitation", "open", "hidden").contains(mode == null ? "" : mode)) throw new IllegalArgumentException("Unknown story preference.");
        Runner owner = lockedOwner(runnerId);
        StoryPreferences pref = preferences.findByRunnerId(runnerId).orElseGet(() -> new StoryPreferences(owner));
        pref.mode = mode;
        if (shelf || mode.equals("invitation")) pref.currentPanel = "shelf";
        preferences.saveAndFlush(pref);
        return state(runnerId);
    }
    @Transactional
    public State chapter(Long runnerId, String chapterId, String action, String branch) {
        if (!CHAPTERS.contains(chapterId)) throw new IllegalArgumentException("Unknown story chapter.");
        if (!List.of("start", "choose", "complete", "replay").contains(action == null ? "" : action)) throw new IllegalArgumentException("Unknown story action.");
        if (branch != null && !List.of("left", "right").contains(branch)) throw new IllegalArgumentException("Choose one of the supplied endings.");
        Runner owner = lockedOwner(runnerId);
        StoryPreferences pref = preferences.findByRunnerId(runnerId).orElseGet(() -> new StoryPreferences(owner));
        if (pref.mode.equals("hidden")) throw new IllegalArgumentException("Restore pocket stories before opening a chapter.");
        StoryChapterProgress row = chapters.findByRunnerIdAndChapterId(runnerId, chapterId).orElse(null);
        if (row == null && (action.equals("choose") || action.equals("complete"))) throw new IllegalArgumentException("Start the chapter first.");
        if (row == null) row = new StoryChapterProgress(owner, chapterId, clock.instant());
        // A lost completion response can be retried without changing its branch or first timestamp.
        if (action.equals("complete") && row.completedAt != null && pref.currentPanel.equals("ending") && chapterId.equals(pref.currentChapterId)) return state(runnerId);
        if (action.equals("choose") && branch == null) throw new IllegalArgumentException("Choose an ending first.");
        if (action.equals("complete") && branch == null && row.branch == null) throw new IllegalArgumentException("Choose an ending first.");
        if (action.equals("replay")) row.branch = null;
        if (branch != null) row.branch = branch;
        if (action.equals("complete") && row.completedAt == null) row.completedAt = clock.instant();
        pref.mode = "open";
        pref.currentChapterId = chapterId;
        pref.currentPanel = action.equals("complete") ? "ending" : "reading";
        chapters.saveAndFlush(row);
        preferences.saveAndFlush(pref);
        return state(runnerId);
    }
    private Runner lockedOwner(Long runnerId) {
        // Serializes first-use inserts as well as double completion on both H2 and PostgreSQL.
        return runners.findByIdForUpdate(runnerId).filter(r -> !r.isDeleted())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }
    private State state(Long runnerId) {
        StoryPreferences pref = preferences.findByRunnerId(runnerId).orElse(null);
        List<StoryChapterProgress> rows = chapters.findByRunnerId(runnerId);
        List<Chapter> result = CHAPTERS.stream().map(id -> {
            StoryChapterProgress row = rows.stream().filter(r -> r.chapterId.equals(id)).findFirst().orElse(null);
            return row == null ? new Chapter(id, "NOT_STARTED", null, null, null, null, null)
                    : new Chapter(id, row.completedAt != null ? "COMPLETED" : "IN_PROGRESS", row.branch, row.startedAt.toString(), row.completedAt == null ? null : row.completedAt.toString(),
                    row.completedAt == null ? null : "postcard-" + id, row.completedAt == null ? null : row.completedAt.toString());
        }).toList();
        return new State(pref == null ? "invitation" : pref.mode, pref == null ? null : pref.currentChapterId, pref == null ? "shelf" : pref.currentPanel, result);
    }
}
