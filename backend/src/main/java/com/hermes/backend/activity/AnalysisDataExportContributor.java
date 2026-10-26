package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerDataExportContributor;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** The runner's labels and measured efforts, alongside the existing account export entries. */
@Component
class AnalysisDataExportContributor implements RunnerDataExportContributor {
    private final ActivityBestEffortRepository efforts;
    private final ActivityTagRepository tags;
    private final ActivityRepository activities;

    AnalysisDataExportContributor(ActivityBestEffortRepository efforts, ActivityTagRepository tags,
                                  ActivityRepository activities) {
        this.efforts = efforts;
        this.tags = tags;
        this.activities = activities;
    }

    @Override
    public String filename() { return "run-analysis.json"; }

    @Override
    @Transactional(readOnly = true)
    public Object export(Runner runner) {
        List<Map<String, Object>> records = efforts.findAllForRunner(runner.getId()).stream().map(effort -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("activityId", effort.getActivity().getId());
            row.put("distanceKey", effort.getDistanceKey());
            row.put("distanceMeters", effort.getDistanceMeters());
            row.put("measuredSeconds", effort.getElapsedSeconds());
            row.put("editedSeconds", effort.getEditedElapsedSeconds());
            row.put("effectiveSeconds", effort.getEffectiveSeconds());
            row.put("estimated", effort.isEstimated());
            row.put("hidden", effort.isHidden());
            row.put("localDate", effort.getLocalDate().toString());
            return row;
        }).toList();
        Map<Long, List<String>> labels = new LinkedHashMap<>();
        for (Object[] row : tags.findAllLabels(runner.getId())) {
            labels.computeIfAbsent((Long) row[0], ignored -> new java.util.ArrayList<>()).add((String) row[1]);
        }
        List<Map<String, Object>> runs = activities.findByRunnerOrderByIdDesc(runner).stream().map(run -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("activityId", run.getId());
            row.put("runType", run.getRunType());
            row.put("tags", labels.getOrDefault(run.getId(), List.of()));
            return row;
        }).toList();
        return Map.of("runs", runs, "bestEfforts", records);
    }
}
