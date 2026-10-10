import { describe, expect, it } from 'vitest';
import {
  characterCount,
  checkNewTag,
  tagKey,
  tidyTag,
  unusedSuggestions,
  withoutTag,
} from './runLabels';

describe('tidyTag', () => {
  it('trims, and turns every run of white space into one space', () => {
    expect(tidyTag('  hill   repeats  ')).toBe('hill repeats');
    expect(tidyTag('with\tthe\ndog')).toBe('with the dog');
    expect(tidyTag('a b')).toBe('a b');
    expect(tidyTag('   ')).toBe('');
    expect(tidyTag(null)).toBe('');
    expect(tidyTag(undefined)).toBe('');
  });

  it('drops control characters and keeps everything else', () => {
    expect(tidyTag('tr\u0000ea\u0007dmill\u001B')).toBe('treadmill');
    expect(tidyTag('5K 🏃 跑步 café')).toBe('5K 🏃 跑步 café');
  });

  it('composes an accent, so two ways of writing it are one tag', () => {
    const composed = 'café';
    const decomposed = 'café';
    expect(decomposed).not.toBe(composed);
    expect(tidyTag(decomposed)).toBe(composed);
  });
});

describe('characterCount', () => {
  it('counts what a person sees as one character as one', () => {
    expect(characterCount('abc')).toBe(3);
    expect(characterCount('🏃🏃🏃')).toBe(3);
    expect(characterCount('跑步')).toBe(2);
    expect(characterCount('')).toBe(0);
    expect(characterCount(null)).toBe(0);
  });
});

describe('checkNewTag', () => {
  it('accepts a word and returns it tidied', () => {
    expect(checkNewTag('  Hill   repeats ', [])).toEqual({ ok: true, label: 'Hill repeats' });
  });

  it('refuses nothing at all', () => {
    expect(checkNewTag('', [])).toEqual({ ok: false, reason: 'empty' });
    expect(checkNewTag('   \t', [])).toEqual({ ok: false, reason: 'empty' });
  });

  it('allows 24 characters and refuses 25, counting an emoji as one', () => {
    expect(checkNewTag('x'.repeat(24), []).ok).toBe(true);
    expect(checkNewTag('x'.repeat(25), [])).toEqual({ ok: false, reason: 'too_long' });
    expect(checkNewTag('🏃'.repeat(24), []).ok).toBe(true);
    expect(checkNewTag('🏃'.repeat(25), [])).toEqual({ ok: false, reason: 'too_long' });
  });

  it('uses the length the server sends', () => {
    expect(checkNewTag('abcdef', [], { maxTagLength: 5 })).toEqual({ ok: false, reason: 'too_long' });
    expect(checkNewTag('abcde', [], { maxTagLength: 5 }).ok).toBe(true);
  });

  it('refuses a word the run already has, in any case', () => {
    expect(checkNewTag('HILLS', ['Hills'])).toEqual({ ok: false, reason: 'duplicate' });
    expect(checkNewTag(' hills ', ['Track', 'Hills'])).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('allows six tags and refuses a seventh, telling a repeat from a new word when the list is full', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(checkNewTag('g', six.slice(0, 5)).ok).toBe(true);
    expect(checkNewTag('g', six)).toEqual({ ok: false, reason: 'full' });
    expect(checkNewTag('F', six)).toEqual({ ok: false, reason: 'duplicate' });
    expect(checkNewTag('g', ['a', 'b'], { maxTags: 2 })).toEqual({ ok: false, reason: 'full' });
  });

  it('checks what is empty before what is too long before what is repeated', () => {
    expect(checkNewTag(' ', ['a'])).toEqual({ ok: false, reason: 'empty' });
    expect(checkNewTag('A'.repeat(30), ['a'.repeat(30)])).toEqual({ ok: false, reason: 'too_long' });
  });
});

describe('the tag list', () => {
  it('writes a tag in lower case for comparing', () => {
    expect(tagKey('Hill Repeats')).toBe('hill repeats');
    expect(tagKey(null)).toBe('');
  });

  it('removes a tag whatever its case and leaves the order of the rest alone', () => {
    expect(withoutTag(['c', 'Hills', 'a'], 'hills')).toEqual(['c', 'a']);
    expect(withoutTag(['c', 'a'], 'zzz')).toEqual(['c', 'a']);
  });

  it('suggests the runner\'s tags that the run does not have yet, most used first, up to the limit', () => {
    const suggestions = [
      { tag: 'Track', runs: 9 },
      { tag: 'hills', runs: 7 },
      { tag: 'easy', runs: 4 },
      { tag: 'dog', runs: 2 },
    ];
    expect(unusedSuggestions(suggestions, ['Hills']).map((entry) => entry.tag)).toEqual(['Track', 'easy', 'dog']);
    expect(unusedSuggestions(suggestions, [], 2).map((entry) => entry.tag)).toEqual(['Track', 'hills']);
    expect(unusedSuggestions(undefined, [])).toEqual([]);
    expect(unusedSuggestions([null, { tag: 5 }, { tag: 'ok', runs: 1 }], []).map((entry) => entry.tag)).toEqual(['ok']);
  });
});
