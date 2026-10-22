package com.hermes.backend.activity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;

/** Session metadata remains on the activity row, without entity-local persistence boilerplate. */
@MappedSuperclass
public abstract class ActivitySessionAnalysisFields extends ActivityEditableFields {
    /** Immutable imported lap boundaries/labels; never overwritten by runner declarations. */
    @Column(columnDefinition = "text")
    private String sourceImportedLapsJson;

    /** Runner-owned interval and comparison declarations, deleted with the activity. */
    @Column(columnDefinition = "text")
    private String sessionAnalysisDeclarationsJson;

    private Instant sessionAnalysisUpdatedAt;

    @JsonIgnore
    public String getSourceImportedLapsJson() { return sourceImportedLapsJson; }
    public void setSourceImportedLapsJson(String value) { sourceImportedLapsJson = value; }
    @JsonIgnore
    public String getSessionAnalysisDeclarationsJson() { return sessionAnalysisDeclarationsJson; }
    public void setSessionAnalysisDeclarationsJson(String value) { sessionAnalysisDeclarationsJson = value; }
    @JsonIgnore
    public Instant getSessionAnalysisUpdatedAt() { return sessionAnalysisUpdatedAt; }
    public void setSessionAnalysisUpdatedAt(Instant value) { sessionAnalysisUpdatedAt = value; }
}
