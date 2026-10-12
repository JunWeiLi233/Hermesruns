package com.hermes.backend.activity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import org.hibernate.annotations.ColumnDefault;

/**
 * What the runner says about a run in their own words, and the choices they make about it: the notes, whether the title is theirs
 * and whether the effort score comes from their rating. Read and written through the edit routes ({@link ActivityEditController}),
 * never as part of a list of runs, so none of it is serialised with the entity.
 */
@MappedSuperclass
public abstract class ActivityEditableFields extends ActivityRelationshipFields {

    /** What the runner wrote about the run; null when there is nothing. Private to the runner. */
    @Column(length = RunTexts.MAX_NOTES_LENGTH)
    private String notes;

    /**
     * True once the runner has given the run a title of their own. A Strava re-sync brings the title Strava has back for every
     * other run, and leaves this one alone.
     */
    @Column(nullable = false)
    @ColumnDefault("false")
    private boolean nameEdited = false;

    /**
     * True when the runner wants the effort score to come from their rating even though the run has a heart rate (a strap that
     * misread, say). Without a rating it changes nothing.
     */
    @Column(nullable = false)
    @ColumnDefault("false")
    private boolean useRatingForEffort = false;

    @JsonIgnore
    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    @JsonIgnore
    public boolean isNameEdited() {
        return nameEdited;
    }

    public void setNameEdited(boolean nameEdited) {
        this.nameEdited = nameEdited;
    }

    @JsonIgnore
    public boolean isUseRatingForEffort() {
        return useRatingForEffort;
    }

    public void setUseRatingForEffort(boolean useRatingForEffort) {
        this.useRatingForEffort = useRatingForEffort;
    }
}
