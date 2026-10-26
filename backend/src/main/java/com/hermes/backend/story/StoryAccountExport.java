package com.hermes.backend.story;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerDataExportContributor;
import org.springframework.stereotype.Component;

@Component
class StoryAccountExport implements RunnerDataExportContributor {
    private final StoryService stories;
    StoryAccountExport(StoryService stories) { this.stories = stories; }
    @Override public String filename() { return "stories.json"; }
    @Override public Object export(Runner runner) { return stories.read(runner.getId()); }
}
