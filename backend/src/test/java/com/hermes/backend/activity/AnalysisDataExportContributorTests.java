package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class AnalysisDataExportContributorTests {
    @Test
    void exportsOnlyTheOwnersLabelsAndMeasuredEffortsWithoutSerializingEntities() {
        Runner runner = mock(Runner.class);
        when(runner.getId()).thenReturn(42L);
        Activity activity = mock(Activity.class);
        when(activity.getId()).thenReturn(7L);
        when(activity.getRunType()).thenReturn(RunTypes.WORKOUT);
        ActivityBestEffort effort = mock(ActivityBestEffort.class);
        when(effort.getActivity()).thenReturn(activity);
        when(effort.getDistanceKey()).thenReturn("1k");
        when(effort.getLocalDate()).thenReturn(LocalDate.of(2026, 10, 15));
        when(effort.getElapsedSeconds()).thenReturn(240.0);
        when(effort.getEffectiveSeconds()).thenReturn(235.0);
        when(effort.getEditedElapsedSeconds()).thenReturn(235);
        ActivityBestEffortRepository efforts = mock(ActivityBestEffortRepository.class);
        ActivityTagRepository tags = mock(ActivityTagRepository.class);
        ActivityRepository activities = mock(ActivityRepository.class);
        when(efforts.findAllForRunner(42L)).thenReturn(List.of(effort));
        when(tags.findAllLabels(42L)).thenReturn(List.<Object[]>of(new Object[]{7L, "Track"}));
        when(activities.findByRunnerOrderByIdDesc(runner)).thenReturn(List.of(activity));

        var contributor = new AnalysisDataExportContributor(efforts, tags, activities);
        assertThat(contributor.filename()).isEqualTo("run-analysis.json");
        Map<?, ?> exported = (Map<?, ?>) contributor.export(runner);
        Map<?, ?> record = (Map<?, ?>) ((List<?>) exported.get("bestEfforts")).get(0);
        Map<?, ?> run = (Map<?, ?>) ((List<?>) exported.get("runs")).get(0);
        assertThat(record.get("activityId")).isEqualTo(7L);
        assertThat(record.get("editedSeconds")).isEqualTo(235);
        assertThat(record.get("effectiveSeconds")).isEqualTo(235.0);
        assertThat(run.get("runType")).isEqualTo(RunTypes.WORKOUT);
        assertThat(run.get("tags")).isEqualTo(List.of("Track"));
        verify(efforts).findAllForRunner(42L);
        verify(tags).findAllLabels(42L);
        verify(activities).findByRunnerOrderByIdDesc(runner);
    }
}
