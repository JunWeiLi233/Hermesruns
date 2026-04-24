package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminBackgroundJobServiceTests {

    @Test
    void markCompletedTruncatesSummaryToFitDefaultVarcharColumn() {
        AdminBackgroundJobRepository repository = mock(AdminBackgroundJobRepository.class);
        when(repository.save(any(AdminBackgroundJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        AdminBackgroundJobService service = new AdminBackgroundJobService(repository);
        AdminBackgroundJob job = new AdminBackgroundJob();
        String longSummary = "Hermes accepted this stylized upload as a city-level course-map match for a standard road marathon in Chicago. "
                + "The upload is treated as a city-level map reference, not a distance-accurate route overlay. "
                + "Qwen was skipped for this stylized/raster map because the image can only support a city-level match.";

        service.markCompleted(job, 1, 0, longSummary, Map.of("raceId", "chicago-marathon"));

        assertThat(job.getStatus()).isEqualTo(AdminBackgroundJob.STATUS_COMPLETED);
        assertThat(job.getSummary()).hasSizeLessThanOrEqualTo(240);
        assertThat(job.getSummary()).endsWith("...");
    }
}
