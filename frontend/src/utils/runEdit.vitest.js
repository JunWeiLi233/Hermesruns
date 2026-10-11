import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDIT_LIMITS,
  afterSave,
  changesOf,
  draftFrom,
  isDirty,
  isRunEdit,
  limitsOf,
  nameProblem,
  notesProblem,
  shoeChanged,
  tidyName,
  tidyNotes,
} from './runEdit';

const edit = (overrides = {}) => ({
  id: 7,
  name: 'Afternoon Run',
  notes: null,
  perceivedExertion: null,
  useRatingForEffort: false,
  runType: null,
  tags: [],
  shoeId: null,
  runTypes: ['RACE', 'LONG_RUN', 'WORKOUT'],
  suggestions: [],
  limits: { maxNameLength: 120, maxNotesLength: 2000, maxTags: 6, maxTagLength: 24 },
  ...overrides,
});

describe('limitsOf', () => {
  it('takes the limits the server sent', () => {
    expect(limitsOf(edit({ limits: { maxNameLength: 50, maxNotesLength: 300, maxTags: 3, maxTagLength: 10 } })))
      .toEqual({ maxNameLength: 50, maxNotesLength: 300, maxTags: 3, maxTagLength: 10 });
  });

  it('falls back to the defaults for any it did not send, or sent wrongly', () => {
    expect(limitsOf(edit({ limits: { maxNameLength: 50 } }))).toEqual({ ...DEFAULT_EDIT_LIMITS, maxNameLength: 50 });
    expect(limitsOf(edit({ limits: { maxNameLength: 'a lot', maxNotesLength: -1, maxTags: 0 } }))).toEqual(DEFAULT_EDIT_LIMITS);
    expect(limitsOf(null)).toEqual(DEFAULT_EDIT_LIMITS);
    expect(limitsOf({})).toEqual(DEFAULT_EDIT_LIMITS);
    expect(limitsOf({ limits: null })).toEqual(DEFAULT_EDIT_LIMITS);
  });

  it('has the defaults the server has', () => {
    expect(DEFAULT_EDIT_LIMITS).toEqual({ maxNameLength: 120, maxNotesLength: 2000, maxTags: 6, maxTagLength: 24 });
  });
});

describe('isRunEdit', () => {
  it('accepts an answer with the parts the drawer draws', () => {
    expect(isRunEdit(edit())).toBe(true);
    expect(isRunEdit(edit({ notes: 'a', perceivedExertion: 5, runType: 'RACE', tags: ['x'], shoeId: 3 }))).toBe(true);
  });

  it.each([
    [null], [undefined], ['text'], [42], [[]], [{}],
    [{ ...edit(), name: undefined }],
    [{ ...edit(), tags: 'a' }],
    [{ ...edit(), runTypes: null }],
    [{ ...edit(), limits: null }],
    [{ ...edit(), limits: 'none' }],
  ])('treats %j as a failed load', (value) => {
    expect(isRunEdit(value)).toBe(false);
  });
});

describe('tidyName and nameProblem', () => {
  it('make a title one line with single spaces', () => {
    expect(tidyName('  Sunday   long\trun \n')).toBe('Sunday long run');
    expect(tidyName('two\nlines')).toBe('two lines');
    expect(tidyName('no break　space')).toBe('no break space');
    expect(tidyName(null)).toBe('');
    expect(tidyName(undefined)).toBe('');
  });

  it('accept any language and emoji', () => {
    expect(nameProblem('晨跑 10 公里 🏃‍♀️')).toBeNull();
    expect(nameProblem('Café – Güle güle')).toBeNull();
  });

  it('refuse an empty title, a title of only spaces and a title with control characters', () => {
    expect(nameProblem('')).toBe('empty');
    expect(nameProblem('   \n\t ')).toBe('empty');
    expect(nameProblem(null)).toBe('empty');
    expect(nameProblem('bell\u0007')).toBe('control');
    expect(nameProblem('nul\u0000')).toBe('control');
    expect(nameProblem('esc\u001b[0m')).toBe('control');
  });

  it('count a title after its spaces are tidied, to the limit and not past it', () => {
    expect(nameProblem('a'.repeat(120))).toBeNull();
    expect(nameProblem('a'.repeat(121))).toBe('too_long');
    expect(nameProblem(`  ${'a'.repeat(120)}  `)).toBeNull();
    expect(nameProblem('a'.repeat(51), { ...DEFAULT_EDIT_LIMITS, maxNameLength: 50 })).toBe('too_long');
  });

  it('count an emoji as two characters, as the server does', () => {
    expect('🏃'.length).toBe(2);
    expect(nameProblem('🏃'.repeat(60))).toBeNull();
    expect(nameProblem('🏃'.repeat(61))).toBe('too_long');
  });
});

describe('tidyNotes and notesProblem', () => {
  it('keep the lines and lose the white space around them', () => {
    expect(tidyNotes('Felt heavy.\n\nLegs were tired.')).toBe('Felt heavy.\n\nLegs were tired.');
    expect(tidyNotes('\n  first\n  second  \n\n')).toBe('first\n  second');
    expect(tidyNotes('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
  });

  it('turn nothing into null', () => {
    expect(tidyNotes('')).toBeNull();
    expect(tidyNotes('  \n\t ')).toBeNull();
    expect(tidyNotes(null)).toBeNull();
    expect(tidyNotes(undefined)).toBeNull();
  });

  it('allow tabs and line breaks, and refuse other control characters', () => {
    expect(notesProblem('a\tb\nc\r\nd')).toBeNull();
    expect(notesProblem('bell\u0007')).toBe('control');
    expect(notesProblem('nul\u0000')).toBe('control');
    expect(notesProblem('esc\u001b')).toBe('control');
  });

  it('count notes to the limit and not past it', () => {
    expect(notesProblem('n'.repeat(2000))).toBeNull();
    expect(notesProblem('n'.repeat(2001))).toBe('too_long');
    expect(notesProblem(`  ${'n'.repeat(2000)}  \n`)).toBeNull();
    expect(notesProblem('')).toBeNull();
    expect(notesProblem(null)).toBeNull();
  });
});

describe('draftFrom', () => {
  it('makes the form\'s own shape from the run', () => {
    expect(draftFrom(edit())).toEqual({ name: 'Afternoon Run', notes: '', rating: null, useRating: false, runType: null, tags: [], shoeId: null });
    expect(draftFrom(edit({ notes: 'windy', perceivedExertion: 7, useRatingForEffort: true, runType: 'WORKOUT', tags: ['a', 'b'], shoeId: 4 })))
      .toEqual({ name: 'Afternoon Run', notes: 'windy', rating: 7, useRating: true, runType: 'WORKOUT', tags: ['a', 'b'], shoeId: 4 });
  });

  it('does not keep the choice to use a rating that is not there', () => {
    expect(draftFrom(edit({ useRatingForEffort: true, perceivedExertion: null })).useRating).toBe(false);
  });

  it('copies the tags, so the draft can change without changing the run it came from', () => {
    const run = edit({ tags: ['a'] });
    const draft = draftFrom(run);
    draft.tags.push('b');
    expect(run.tags).toEqual(['a']);
  });
});

describe('changesOf', () => {
  it('is nothing for a draft that is the run as it is', () => {
    const run = edit({ notes: 'windy', perceivedExertion: 6, useRatingForEffort: true, runType: 'RACE', tags: ['x', 'y'], shoeId: 2 });
    expect(changesOf(run, draftFrom(run))).toEqual({});
    expect(isDirty(run, draftFrom(run))).toBe(false);
  });

  it('holds only what the runner changed', () => {
    const run = edit();
    expect(changesOf(run, { ...draftFrom(run), name: 'Windy 5K' })).toEqual({ name: 'Windy 5K' });
    expect(changesOf(run, { ...draftFrom(run), notes: 'felt good' })).toEqual({ notes: 'felt good' });
    expect(changesOf(run, { ...draftFrom(run), rating: 8 })).toEqual({ perceivedExertion: 8 });
    expect(changesOf(run, { ...draftFrom(run), runType: 'LONG_RUN' })).toEqual({ runType: 'LONG_RUN' });
    expect(changesOf(run, { ...draftFrom(run), tags: ['hills'] })).toEqual({ tags: ['hills'] });
  });

  it('tidies a title it sends, and leaves a title the runner did not touch alone', () => {
    const stravaTitle = edit({ name: 'Morning   Run' });
    expect(changesOf(stravaTitle, draftFrom(stravaTitle))).toEqual({});
    expect(changesOf(stravaTitle, { ...draftFrom(stravaTitle), name: '  Morning   Run, again ' })).toEqual({ name: 'Morning Run, again' });
  });

  it('sends the notes tidied, and null to clear them', () => {
    const run = edit({ notes: 'old notes' });
    expect(changesOf(run, { ...draftFrom(run), notes: '  new\r\nnotes \n' })).toEqual({ notes: 'new\nnotes' });
    expect(changesOf(run, { ...draftFrom(run), notes: '' })).toEqual({ notes: null });
    expect(changesOf(run, { ...draftFrom(run), notes: '  \n ' })).toEqual({ notes: null });
    expect(changesOf(edit(), { ...draftFrom(edit()), notes: '   ' })).toEqual({});
  });

  it('sends a rating and the choice to use it together or apart', () => {
    const run = edit();
    expect(changesOf(run, { ...draftFrom(run), rating: 8, useRating: true })).toEqual({ perceivedExertion: 8, useRatingForEffort: true });
    const rated = edit({ perceivedExertion: 8 });
    expect(changesOf(rated, { ...draftFrom(rated), useRating: true })).toEqual({ useRatingForEffort: true });
    const chosen = edit({ perceivedExertion: 8, useRatingForEffort: true });
    expect(changesOf(chosen, { ...draftFrom(chosen), useRating: false })).toEqual({ useRatingForEffort: false });
    expect(changesOf(chosen, { ...draftFrom(chosen), rating: 5 })).toEqual({ perceivedExertion: 5 });
  });

  it('clears the choice with the rating', () => {
    const chosen = edit({ perceivedExertion: 8, useRatingForEffort: true });
    expect(changesOf(chosen, { ...draftFrom(chosen), rating: null, useRating: false })).toEqual({ perceivedExertion: null, useRatingForEffort: false });
    expect(changesOf(chosen, { ...draftFrom(chosen), rating: null })).toEqual({ perceivedExertion: null, useRatingForEffort: false });
  });

  it('never asks to use a rating it is not sending', () => {
    const run = edit();
    expect(changesOf(run, { ...draftFrom(run), rating: null, useRating: true })).toEqual({});
  });

  it('sees tags changed in content or in order', () => {
    const run = edit({ tags: ['a', 'b'] });
    expect(changesOf(run, { ...draftFrom(run), tags: ['a', 'b'] })).toEqual({});
    expect(changesOf(run, { ...draftFrom(run), tags: ['b', 'a'] })).toEqual({ tags: ['b', 'a'] });
    expect(changesOf(run, { ...draftFrom(run), tags: ['a'] })).toEqual({ tags: ['a'] });
    expect(changesOf(run, { ...draftFrom(run), tags: [] })).toEqual({ tags: [] });
  });

  it('does not put the shoe in the request: it has a route of its own', () => {
    const run = edit({ shoeId: 1 });
    expect(changesOf(run, { ...draftFrom(run), shoeId: 2 })).toEqual({});
    expect(changesOf(run, { ...draftFrom(run), shoeId: null })).toEqual({});
  });
});

describe('shoeChanged and isDirty', () => {
  it('see a different shoe, and no shoe', () => {
    const run = edit({ shoeId: 3 });
    expect(shoeChanged(run, draftFrom(run))).toBe(false);
    expect(shoeChanged(run, { ...draftFrom(run), shoeId: 4 })).toBe(true);
    expect(shoeChanged(run, { ...draftFrom(run), shoeId: null })).toBe(true);
    expect(shoeChanged(edit(), { ...draftFrom(edit()), shoeId: 4 })).toBe(true);
    expect(shoeChanged(edit({ shoeId: undefined }), { ...draftFrom(edit()), shoeId: null })).toBe(false);
  });

  it('count a shoe or any other change as something to save', () => {
    const run = edit({ shoeId: 3 });
    expect(isDirty(run, { ...draftFrom(run), shoeId: 4 })).toBe(true);
    expect(isDirty(run, { ...draftFrom(run), name: 'x' })).toBe(true);
    expect(isDirty(run, draftFrom(run))).toBe(false);
  });
});

describe('afterSave', () => {
  it('takes the server\'s word for each field the request named', () => {
    const run = edit({ notes: 'old' });
    const body = { name: '  Windy  ', notes: 'new' };
    const next = afterSave(run, body, { id: 7, name: 'Windy', notes: 'new' }, null);
    expect(next.name).toBe('Windy');
    expect(next.notes).toBe('new');
  });

  it('keeps the fields the request did not name', () => {
    const run = edit({ notes: 'old', perceivedExertion: 6, runType: 'RACE', tags: ['a'] });
    const next = afterSave(run, { name: 'x' }, { id: 7, name: 'x' }, null);
    expect(next).toMatchObject({ notes: 'old', perceivedExertion: 6, runType: 'RACE', tags: ['a'] });
  });

  it('uses what was sent for a field the answer left out', () => {
    const next = afterSave(edit(), { tags: ['a', 'b'], perceivedExertion: 4 }, {}, null);
    expect(next.tags).toEqual(['a', 'b']);
    expect(next.perceivedExertion).toBe(4);
    expect(afterSave(edit(), { tags: ['a'] }, null, null).tags).toEqual(['a']);
  });

  it('turns cleared fields into nothing', () => {
    const run = edit({ notes: 'old', perceivedExertion: 6, runType: 'RACE', useRatingForEffort: true });
    const next = afterSave(run, { notes: null, perceivedExertion: null, runType: null }, { id: 7, notes: null, perceivedExertion: null, runType: null }, null);
    expect(next).toMatchObject({ notes: null, perceivedExertion: null, runType: null, useRatingForEffort: false });
  });

  it('follows the server about the choice to use the rating, and clears it when the rating goes', () => {
    const rated = edit({ perceivedExertion: 6 });
    expect(afterSave(rated, { useRatingForEffort: true }, { id: 7, useRatingForEffort: true }, null).useRatingForEffort).toBe(true);
    const chosen = edit({ perceivedExertion: 6, useRatingForEffort: true });
    expect(afterSave(chosen, { name: 'x' }, { id: 7, name: 'x' }, null).useRatingForEffort).toBe(true);
    expect(afterSave(chosen, { perceivedExertion: null }, { id: 7, perceivedExertion: null }, null).useRatingForEffort).toBe(false);
  });

  it('carries the shoe it is given', () => {
    expect(afterSave(edit({ shoeId: 1 }), {}, null, 1).shoeId).toBe(1);
    expect(afterSave(edit({ shoeId: 1 }), {}, null, 5).shoeId).toBe(5);
    expect(afterSave(edit({ shoeId: 1 }), {}, null, null).shoeId).toBeNull();
    expect(afterSave(edit({ shoeId: 1 }), {}, null, undefined).shoeId).toBeNull();
  });

  it('does not change the run it was given', () => {
    const run = edit({ tags: ['a'] });
    const copy = JSON.parse(JSON.stringify(run));
    afterSave(run, { name: 'x', tags: ['b'] }, { id: 7, name: 'x', tags: ['b'] }, 3);
    expect(run).toEqual(copy);
  });
});
