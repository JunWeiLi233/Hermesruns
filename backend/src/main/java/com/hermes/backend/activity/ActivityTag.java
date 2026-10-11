package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;

/**
 * A word the runner put on one of their runs ("hill repeats", "with the dog", "treadmill"), which the training log filters
 * by. A run holds a few (see {@link RunLabelService}), each once however it is capitalised: {@link #labelKey} is the
 * lower-case form two spellings share, {@link #label} is how the runner wrote it.
 *
 * <p>The runner is kept on the row so that "all my tags", and the filters, never have to go through a run, and so a tag
 * can only ever be read by the runner who wrote it.</p>
 */
@Entity
@Table(
        name = "activity_tag",
        uniqueConstraints = @UniqueConstraint(name = "uk_activity_tag", columnNames = {"activity_id", "label_key"}),
        indexes = @Index(name = "idx_activity_tag_runner_key", columnList = "runner_id, label_key")
)
public class ActivityTag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "activity_id", nullable = false)
    private Activity activity;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "runner_id", nullable = false)
    private Runner runner;

    /** As the runner wrote it, after trimming and collapsing spaces. */
    @Column(nullable = false, length = 64)
    private String label;

    /** The label in lower case, which is what tags are compared and counted by. */
    @Column(name = "label_key", nullable = false, length = 64)
    private String labelKey;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected ActivityTag() {
    }

    public ActivityTag(Activity activity, Runner runner, String label, String labelKey) {
        this.activity = activity;
        this.runner = runner;
        this.label = label;
        this.labelKey = labelKey;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Activity getActivity() {
        return activity;
    }

    public Runner getRunner() {
        return runner;
    }

    public String getLabel() {
        return label;
    }

    public String getLabelKey() {
        return labelKey;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
