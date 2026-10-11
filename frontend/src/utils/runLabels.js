/**
 * The rules for a run's tags, as the run page applies them before it asks the server (see docs/README-ANALYSIS.md,
 * "Run Type and Tags"). The server checks the same rules again and has the last word; these exist so a mistake is
 * explained at once, in the runner's language, instead of as a refused request.
 */

export const DEFAULT_MAX_TAGS = 6;
export const DEFAULT_MAX_TAG_LENGTH = 24;

/** Trims, collapses runs of white space to one space, drops control characters and composes accents. */
export function tidyTag(text) {
  const composed = String(text ?? '').normalize('NFC');
  let out = '';
  let pendingSpace = false;
  for (const character of composed) {
    if (/\s/u.test(character)) {
      pendingSpace = out.length > 0;
      continue;
    }
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f-\u009f]/u.test(character)) continue;
    if (pendingSpace) {
      out += ' ';
      pendingSpace = false;
    }
    out += character;
  }
  return out;
}

/** What two spellings of one tag share: the same word in another case is the same tag. */
export function tagKey(label) {
  return String(label ?? '').toLowerCase();
}

/** Characters as a person counts them: an emoji or a Chinese character is one. */
export function characterCount(text) {
  return [...String(text ?? '')].length;
}

/**
 * Whether a word can be added to a run's tags.
 *
 * @returns `{ ok: true, label }` with the word tidied, or `{ ok: false, reason }` where reason is `empty`, `too_long`,
 *          `duplicate` or `full`
 */
export function checkNewTag(text, current, { maxTags = DEFAULT_MAX_TAGS, maxTagLength = DEFAULT_MAX_TAG_LENGTH } = {}) {
  const label = tidyTag(text);
  if (label === '') return { ok: false, reason: 'empty' };
  if (characterCount(label) > maxTagLength) return { ok: false, reason: 'too_long' };
  if (current.some((existing) => tagKey(existing) === tagKey(label))) return { ok: false, reason: 'duplicate' };
  if (current.length >= maxTags) return { ok: false, reason: 'full' };
  return { ok: true, label };
}

/** The tags without one of them, however it is capitalised. */
export function withoutTag(current, label) {
  return current.filter((existing) => tagKey(existing) !== tagKey(label));
}

/** The suggestions that are not already on the run, most used first, at most `limit`. */
export function unusedSuggestions(suggestions, current, limit = 8) {
  const have = new Set(current.map(tagKey));
  return (Array.isArray(suggestions) ? suggestions : [])
    .filter((suggestion) => suggestion && typeof suggestion.tag === 'string' && !have.has(tagKey(suggestion.tag)))
    .slice(0, limit);
}
