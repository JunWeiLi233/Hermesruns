package com.hermes.backend.activity.analysis;

import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerDataExportContributor;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SessionAnalysisExportContributor implements RunnerDataExportContributor {
    private final ActivityRepository activities;
    private final SessionAnalysisService analysis;
    public SessionAnalysisExportContributor(ActivityRepository activities, SessionAnalysisService analysis) { this.activities = activities; this.analysis = analysis; }
    @Override public String filename() { return "session-analysis.json"; }
    @Override @Transactional(readOnly = true)
    public Object export(Runner owner) {
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (var activity : activities.findByRunnerAndActivityTypeOrderByIdDesc(owner, ActivityType.RUN))
            if (activity.getSessionAnalysisDeclarationsJson() != null || activity.getSourceImportedLapsJson() != null)
                result.add(analysis.read(activity.getId(), owner));
        return result;
    }
}
