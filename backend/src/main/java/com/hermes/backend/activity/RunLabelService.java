package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The run type and the tags a runner puts on a run, and the rules about them.
 *
 * <p>A <b>run type</b> is one of {@link RunTypes} or nothing. A run's <b>tags</b> are a few words of the runner's own: at most
 * {@link #MAX_TAGS} per run, each at most {@link #MAX_TAG_LENGTH} characters, spaces collapsed, control characters removed,
 * and the same word in another case counted once (the first spelling is kept). Setting the tags replaces the whole set,
 * so a request says what the run should have, not what to add.</p>
 *
 * <p>Both are labels for the runner's own use (the training log filters by them, a fitness chart marks races). Nothing is
 * computed from them, so changing them recomputes nothing.</p>
 */
@Service
public class RunLabelService {

    public static final int MAX_TAGS = 6;
    public static final int MAX_TAG_LENGTH = 24;
    /** How many of a runner's most used tags are offered when they add one. */
    public static final int SUGGESTIONS = 12;

    /** A run's labels as the screens show them. */
    public record Labels(String runType, List<String> tags) {
    }

    /** How many of a runner's runs carry a tag. */
    public record TagUse(String tag, long runs) {
    }

    /**
     * What a request wants changed: nothing is touched that it does not mention.
     *
     * @param tags the whole set the run should have; ignored unless {@code tagsGiven}
     */
    public record Change(boolean runTypeGiven, String runType, boolean tagsGiven, List<String> tags) {
    }

    private final ActivityTagRepository tags;
    private final ActivityDataAccess activityData;

    public RunLabelService(ActivityTagRepository tags, ActivityDataAccess activityData) {
        this.tags = tags;
        this.activityData = activityData;
    }

    /** The labels of a run the caller has already established is the runner's. */
    @Transactional(readOnly = true)
    public Labels labels(Activity activity) {
        return new Labels(activity.getRunType(), labelsOf(activity.getId()));
    }

    /**
     * Checks a request without applying it, so a bad value changes nothing at all.
     *
     * @return the tags cleaned and made unique, in the order given
     * @throws IllegalArgumentException with a plain-language reason when a value is refused
     */
    public static List<String> cleanTags(List<?> raw) {
        Map<String, String> byKey = new LinkedHashMap<>();
        for (Object item : raw) {
            if (!(item instanceof String text)) {
                throw new IllegalArgumentException("Every tag must be text.");
            }
            String label = tidy(text);
            if (label.isEmpty()) {
                throw new IllegalArgumentException("A tag cannot be empty.");
            }
            if (label.codePointCount(0, label.length()) > MAX_TAG_LENGTH) {
                throw new IllegalArgumentException("A tag is at most " + MAX_TAG_LENGTH + " characters.");
            }
            byKey.putIfAbsent(keyOf(label), label);
        }
        if (byKey.size() > MAX_TAGS) {
            throw new IllegalArgumentException("A run can have at most " + MAX_TAGS + " tags.");
        }
        return new ArrayList<>(byKey.values());
    }

    /** Trims, collapses runs of white space to one space and drops control characters. */
    static String tidy(String text) {
        StringBuilder out = new StringBuilder();
        boolean pendingSpace = false;
        String normalized = Normalizer.normalize(text, Normalizer.Form.NFC);
        for (int i = 0; i < normalized.length(); ) {
            int codePoint = normalized.codePointAt(i);
            i += Character.charCount(codePoint);
            if (Character.isWhitespace(codePoint) || Character.isSpaceChar(codePoint)) {
                pendingSpace = out.length() > 0;
                continue;
            }
            if (Character.isISOControl(codePoint)) {
                continue;
            }
            if (pendingSpace) {
                out.append(' ');
                pendingSpace = false;
            }
            out.appendCodePoint(codePoint);
        }
        return out.toString();
    }

    /** What two spellings of one tag share. */
    static String keyOf(String label) {
        return label.toLowerCase(Locale.ROOT);
    }

    /**
     * Applies a change to a run the caller has established is the runner's, after the values have been checked.
     *
     * @param cleanTags the result of {@link #cleanTags}; only read when {@code change.tagsGiven()}
     * @return the labels now, and whether anything changed
     */
    @Transactional
    public Applied apply(Runner runner, Activity activity, Change change, List<String> cleanTags) {
        boolean changed = false;
        if (change.runTypeGiven()) {
            String next = change.runType();
            if (next != null && !RunTypes.isValid(next)) {
                throw new IllegalArgumentException("A run type is race, long run or workout.");
            }
            if (!java.util.Objects.equals(activity.getRunType(), next)) {
                activity.setRunType(next);
                activityData.save(activity);
                changed = true;
            }
        }
        boolean tagsChanged = false;
        if (change.tagsGiven()) {
            List<String> before = labelsOf(activity.getId());
            if (!before.equals(cleanTags)) {
                tags.deleteByActivityIds(List.of(activity.getId()));
                for (String label : cleanTags) {
                    tags.save(new ActivityTag(activity, runner, label, keyOf(label)));
                }
                tagsChanged = true;
            }
        }
        List<String> now = tagsChanged ? cleanTags : labelsOf(activity.getId());
        return new Applied(new Labels(activity.getRunType(), now), changed, tagsChanged);
    }

    private List<String> labelsOf(Long activityId) {
        return tags.findLabels(List.of(activityId)).stream().map((row) -> (String) row[1]).toList();
    }

    /** The result of {@link #apply}. */
    public record Applied(Labels labels, boolean runTypeChanged, boolean tagsChanged) {
    }

    /**
     * The runner's most used tags, for the picker and the log's filter: most runs first, then alphabetically. A tag is shown
     * the way the runner writes it most often (the earliest spelling when two are equally common).
     */
    @Transactional(readOnly = true)
    public List<TagUse> usage(Long runnerId, int limit) {
        record Spelling(String label, long runs, long firstRow) {
        }
        Map<String, List<Spelling>> byKey = new LinkedHashMap<>();
        for (Object[] row : tags.usageBySpelling(runnerId)) {
            byKey.computeIfAbsent((String) row[0], key -> new ArrayList<>())
                    .add(new Spelling((String) row[1], ((Number) row[2]).longValue(), ((Number) row[3]).longValue()));
        }
        List<Map.Entry<String, TagUse>> uses = new ArrayList<>();
        for (Map.Entry<String, List<Spelling>> entry : byKey.entrySet()) {
            long total = 0;
            Spelling shown = null;
            for (Spelling spelling : entry.getValue()) {
                total += spelling.runs();
                if (shown == null || spelling.runs() > shown.runs()
                        || (spelling.runs() == shown.runs() && spelling.firstRow() < shown.firstRow())) {
                    shown = spelling;
                }
            }
            uses.add(Map.entry(entry.getKey(), new TagUse(shown.label(), total)));
        }
        uses.sort((a, b) -> {
            int byRuns = Long.compare(b.getValue().runs(), a.getValue().runs());
            return byRuns != 0 ? byRuns : a.getKey().compareTo(b.getKey());
        });
        return uses.stream().limit(limit).map(Map.Entry::getValue).toList();
    }
}
