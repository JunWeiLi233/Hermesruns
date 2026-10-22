package com.hermes.backend.coaching;

import com.hermes.backend.activity.RunMetricsProjection;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Scalar-only read: no activity entity, raw stream, route or lazy collection. */
public interface HrBlockProjection extends RunMetricsProjection {
    Long getActivityId();
    Long getMetricsId();
    LocalDate getMetricsDate();
    Integer getCoveredSeconds();
    Integer getZ1(); Integer getZ2(); Integer getZ3(); Integer getZ4(); Integer getZ5();
    Integer getMaxHrUsed();
    Integer getB1(); Integer getB2(); Integer getB3(); Integer getB4();
    Boolean getStale();
    Integer getModelVersion();
    String getEffortSource();
    LocalDateTime getComputedAt();
}
