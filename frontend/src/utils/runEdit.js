import { DEFAULT_MAX_TAGS, DEFAULT_MAX_TAG_LENGTH } from './runLabels';

/**
 * The rules for what a runner writes on a run, and the arithmetic of the edit drawer (see docs/README-ANALYSIS.md,
 * "Editing a run"): what is a title, what are notes, which fields a draft has changed. The server checks the same rules again
 * and has the last word; these exist so a mistake is explained at once, in the runner's language, and so a save sends only what
 * the runner changed. Lengths are counted the way a browser's `value.length` counts, which is the way the server counts.
 */

export const DEFAULT_EDIT_LIMITS = {
  maxNameLength: 120,
  maxNotesLength: 2000,
  maxTags: DEFAULT_MAX_TAGS,
  maxTagLength: DEFAULT_MAX_TAG_LENGTH,
};

// Control characters other than the white space a title turns into spaces (tab, line feed, vertical tab, form feed, return).
// eslint-disable-next-line no-control-regex
const TITLE_CONTROL = /[\u0000-\u0008\u000e-\u001f\u007f-\u009f]/u;
// Control characters other than the tab and the line breaks notes may hold.
// eslint-disable-next-line no-control-regex
const NOTES_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;

/** The limits the server sent with the run, over the defaults for any it did not send. */
export function limitsOf(edit) {
  const sent = edit && typeof edit.limits === 'object' && edit.limits ? edit.limits : {};
  const limits = { ...DEFAULT_EDIT_LIMITS };
  for (const key of Object.keys(limits)) {
    if (Number.isFinite(sent[key]) && sent[key] > 0) limits[key] = sent[key];
  }
  return limits;
}

/** Whether an answer from /api/activities/{id}/edit has the parts the drawer draws; anything else is a failed load. */
export function isRunEdit(data) {
  return Boolean(
    data && typeof data === 'object'
    && typeof data.name === 'string'
    && Array.isArray(data.tags)
    && Array.isArray(data.runTypes)
    && data.limits && typeof data.limits === 'object',
  );
}

/** A title as the server keeps it: one line, with single spaces. */
export function tidyName(text) {
  return String(text ?? '').replace(/\s+/gu, ' ').trim();
}

/** `'empty'`, `'control'` or `'too_long'` for a title that cannot be saved; null for one that can. */
export function nameProblem(text, limits = DEFAULT_EDIT_LIMITS) {
  const tidy = tidyName(text);
  if (TITLE_CONTROL.test(tidy)) return 'control';
  if (tidy === '') return 'empty';
  if (tidy.length > limits.maxNameLength) return 'too_long';
  return null;
}

/** Notes as the server keeps them: line breaks as `\n`, the white space around them gone, nothing at all as null. */
export function tidyNotes(text) {
  const lines = String(text ?? '').replace(/\r\n?/gu, '\n').trim();
  return lines === '' ? null : lines;
}

/** `'control'` or `'too_long'` for notes that cannot be saved; null for notes that can. */
export function notesProblem(text, limits = DEFAULT_EDIT_LIMITS) {
  const lines = String(text ?? '').replace(/\r\n?/gu, '\n');
  if (NOTES_CONTROL.test(lines)) return 'control';
  const tidy = tidyNotes(lines);
  if (tidy != null && tidy.length > limits.maxNotesLength) return 'too_long';
  return null;
}

/** What the drawer starts from: the run as the server describes it, in the shape the form edits. */
export function draftFrom(edit) {
  return {
    name: edit.name,
    notes: edit.notes ?? '',
    rating: Number.isInteger(edit.perceivedExertion) ? edit.perceivedExertion : null,
    useRating: Boolean(edit.useRatingForEffort) && Number.isInteger(edit.perceivedExertion),
    runType: typeof edit.runType === 'string' ? edit.runType : null,
    tags: Array.isArray(edit.tags) ? [...edit.tags] : [],
    shoeId: edit.shoeId ?? null,
  };
}

function sameTags(left, right) {
  return left.length === right.length && left.every((tag, index) => tag === right[index]);
}

/**
 * The fields a draft has changed, as the body of the PATCH that saves them (the shoe has a route of its own, see
 * {@link shoeChanged}). A field that is as it was is left out, so a save never sends what the runner did not touch and a
 * title that Strava gave the run is not taken for one the runner chose.
 */
export function changesOf(edit, draft) {
  const was = draftFrom(edit);
  const body = {};
  if (draft.name !== was.name) body.name = tidyName(draft.name);
  const notes = tidyNotes(draft.notes);
  if (notes !== tidyNotes(was.notes)) body.notes = notes;
  if (draft.rating !== was.rating) body.perceivedExertion = draft.rating;
  const use = draft.rating != null && Boolean(draft.useRating);
  if (use !== was.useRating) body.useRatingForEffort = use;
  if (draft.runType !== was.runType) body.runType = draft.runType;
  if (!sameTags(draft.tags, was.tags)) body.tags = draft.tags;
  return body;
}

/** Whether the draft links a different shoe than the run has (null for no shoe). */
export function shoeChanged(edit, draft) {
  return (draft.shoeId ?? null) !== (edit.shoeId ?? null);
}

/** Whether there is anything to save. */
export function isDirty(edit, draft) {
  return Object.keys(changesOf(edit, draft)).length > 0 || shoeChanged(edit, draft);
}

/**
 * The run as it is after a save: the earlier description with what the server answered for each field the request named
 * (or, for a field the answer left out, what was sent), and the shoe the runner chose.
 */
export function afterSave(edit, body, answer, shoeId) {
  const next = { ...edit, shoeId: shoeId ?? null };
  const said = answer && typeof answer === 'object' ? answer : {};
  const pick = (field, key = field) => (key in body ? (field in said ? said[field] : body[key]) : next[field]);
  next.name = pick('name');
  next.notes = pick('notes') ?? null;
  next.perceivedExertion = pick('perceivedExertion') ?? null;
  next.useRatingForEffort = 'useRatingForEffort' in said ? said.useRatingForEffort : (next.perceivedExertion == null ? false : edit.useRatingForEffort);
  next.runType = pick('runType') ?? null;
  next.tags = Array.isArray(pick('tags')) ? pick('tags') : next.tags;
  return next;
}
