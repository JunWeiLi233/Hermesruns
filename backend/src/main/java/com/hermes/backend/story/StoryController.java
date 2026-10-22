package com.hermes.backend.story;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/stories/me")
public class StoryController {
    private final AuthService auth;
    private final StoryService stories;
    public StoryController(AuthService auth, StoryService stories) { this.auth = auth; this.stories = stories; }
    public record PreferenceRequest(String mode, Boolean shelf) {}
    public record ChapterRequest(String action, String branch) {}
    @GetMapping
    public ResponseEntity<?> read(@RequestHeader(value = "Authorization", required = false) String authorization) {
        Optional<Runner> owner = auth.findByAuthorizationHeader(authorization);
        return owner.isEmpty() ? unauthorized() : ResponseEntity.ok(stories.read(owner.get().getId()));
    }
    @PostMapping("/preferences")
    public ResponseEntity<?> preference(@RequestHeader(value = "Authorization", required = false) String authorization,
                                        @RequestBody PreferenceRequest body) {
        Optional<Runner> owner = auth.findByAuthorizationHeader(authorization);
        if (owner.isEmpty()) return unauthorized();
        try { return ResponseEntity.ok(stories.preference(owner.get().getId(), body.mode(), Boolean.TRUE.equals(body.shelf()))); }
        catch (IllegalArgumentException invalid) { return ResponseEntity.badRequest().body(Map.of("message", invalid.getMessage())); }
    }
    @PostMapping("/chapters/{chapterId}")
    public ResponseEntity<?> chapter(@RequestHeader(value = "Authorization", required = false) String authorization,
                                     @PathVariable String chapterId, @RequestBody ChapterRequest body) {
        Optional<Runner> owner = auth.findByAuthorizationHeader(authorization);
        if (owner.isEmpty()) return unauthorized();
        try { return ResponseEntity.ok(stories.chapter(owner.get().getId(), chapterId, body.action(), body.branch())); }
        catch (IllegalArgumentException invalid) { return ResponseEntity.badRequest().body(Map.of("message", invalid.getMessage())); }
    }
    private static ResponseEntity<?> unauthorized() { return ResponseEntity.status(401).body(Map.of("message", "Sign in required.")); }
}
