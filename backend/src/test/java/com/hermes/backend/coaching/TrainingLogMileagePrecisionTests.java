package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityTagRepository;
import com.hermes.backend.activity.RunLabelService;
import com.hermes.backend.runner.Runner;
import java.time.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TrainingLogMileagePrecisionTests {
    @Test
    void weeksAndRunsKeepRecordedPrecisionUntilTheDisplayFormatsThem() {
        var rows = mock(TrainingLogRepository.class);
        var tags = mock(ActivityTagRepository.class);
        var labels = mock(RunLabelService.class);
        var service = new TrainingLogService(rows, tags, labels, Clock.fixed(Instant.parse("2026-10-16T12:00:00Z"), ZoneOffset.UTC));
        Runner runner = new Runner(); runner.setId(7L); runner.setTimeZone("UTC");
        var first = mock(TrainingLogRepository.LogRunRow.class);
        var second = mock(TrainingLogRepository.LogRunRow.class);
        when(first.getId()).thenReturn(1L); when(second.getId()).thenReturn(2L);
        when(first.getStartTime()).thenReturn(LocalDateTime.parse("2026-10-12T12:00:00"));
        when(second.getStartTime()).thenReturn(LocalDateTime.parse("2026-10-13T12:00:00"));
        when(first.getDistanceKm()).thenReturn(17.675);
        when(second.getDistanceKm()).thenReturn(17.670);
        when(rows.findRows(eq(7L), any(), any(), any())).thenReturn(List.of(first, second));
        var week = service.log(runner, null, 1, null, List.of()).weeks().get(0);
        assertThat(week.distanceKm()).isCloseTo(35.345, org.assertj.core.data.Offset.offset(0.00000001));
        assertThat(week.days().get(0).runs().get(0).distanceKm()).isEqualTo(17.675);
        verify(rows).findRows(eq(7L), any(), any(), any());
    }
}
