import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import RunLabelsCard from '../RunLabelsCard';

const state = vi.hoisted(() => ({ lang: 'en' }));
const t = (key, params = {}) => {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};

vi.mock('../../../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    lang: state.lang,
    t,
    formatNumber: (value) => new Intl.NumberFormat(state.lang === 'zh-CN' ? 'zh-CN' : 'en-US').format(value),
  }),
}));

function labels(overrides = {}) {
  return {
    id: 7,
    runType: null,
    tags: [],
    runTypes: ['RACE', 'LONG_RUN', 'WORKOUT'],
    maxTags: 6,
    maxTagLength: 24,
    suggestions: [],
    ...overrides,
  };
}

let served;
let patched;
let patchAnswer;
let patchGate;
const labelCalls = () => apiJson.mock.calls.filter(([url]) => url === '/api/activities/7/labels');

function renderCard(runId = 7) {
  return render(<MemoryRouter><RunLabelsCard runId={runId} /></MemoryRouter>);
}

async function ready() {
  const card = await screen.findByRole('region', { name: t('run_labels.title') });
  await screen.findByRole('group', { name: t('run_labels.type_group') });
  return card;
}

beforeEach(() => {
  state.lang = 'en';
  served = labels();
  patched = [];
  patchAnswer = (body) => ({ id: 7, ...body });
  patchGate = null;
  apiJson.mockReset();
  apiJson.mockImplementation(async (url, options) => {
    if (options?.method === 'PATCH') {
      const body = JSON.parse(options.body);
      patched.push(body);
      if (patchGate) await patchGate;
      const answer = patchAnswer(body);
      if (answer instanceof Error) throw answer;
      return answer;
    }
    if (url === '/api/activities/7/labels') {
      if (served instanceof Error) throw served;
      return served;
    }
    return {};
  });
});
afterEach(() => cleanup());

describe('after the run was edited elsewhere', () => {
  it('asks again when told to, and shows what the edit changed', async () => {
    const view = renderCard();
    await ready();
    expect(labelCalls()).toHaveLength(1);

    served = labels({ runType: 'WORKOUT', tags: ['track'] });
    view.rerender(<MemoryRouter><RunLabelsCard runId={7} refreshToken={1} /></MemoryRouter>);
    await waitFor(() => expect(labelCalls()).toHaveLength(2));
    // The old labels stay on screen until the new ones arrive, so wait for the change rather than for the radio button.
    await waitFor(() => expect(screen.getByRole('radio', { name: t('run_labels.type_WORKOUT') })).toBeChecked());
    expect(await screen.findByRole('list', { name: t('run_labels.tags_label') })).toHaveTextContent('track');
  });
});

describe('loading and failing', () => {
  it('is a region named after its title, busy with a skeleton until the labels are there', async () => {
    const { container } = renderCard();

    const card = screen.getByRole('region', { name: t('run_labels.title') });
    expect(card).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('.run-labels__skeleton')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(t('run_labels.loading'));

    await ready();
    expect(card).not.toHaveAttribute('aria-busy');
    expect(container.querySelector('.run-labels__skeleton')).not.toBeInTheDocument();
    expect(labelCalls()).toHaveLength(1);
  });

  it('says so, with a way to try again, when the labels cannot be loaded', async () => {
    served = new Error('boom');
    renderCard();

    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_labels.load_error'));
    served = labels({ runType: 'RACE' });
    await userEvent.click(screen.getByRole('button', { name: t('run_labels.retry') }));

    expect(await screen.findByRole('radio', { name: t('run_labels.type_RACE') })).toBeChecked();
    expect(screen.queryByText(t('run_labels.load_error'))).not.toBeInTheDocument();
  });

  it('treats an answer without the parts it draws as a failed load, not a half-drawn card', async () => {
    served = { id: 7, runType: 'RACE' };
    renderCard();

    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_labels.load_error'));
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: t('run_labels.type_group') })).not.toBeInTheDocument();
  });
});

describe('the run type', () => {
  it('offers a plain run and the three types, with the current one chosen', async () => {
    served = labels({ runType: 'LONG_RUN' });
    renderCard();
    await ready();

    const group = screen.getByRole('group', { name: t('run_labels.type_group') });
    const names = within(group).getAllByRole('radio').map((radio) => radio.closest('label').textContent);
    expect(names).toEqual([t('run_labels.type_none'), t('run_labels.type_RACE'), t('run_labels.type_LONG_RUN'), t('run_labels.type_WORKOUT')]);
    expect(within(group).getByRole('radio', { name: t('run_labels.type_LONG_RUN') })).toBeChecked();
    expect(within(group).getByRole('radio', { name: t('run_labels.type_RACE') })).not.toBeChecked();
    expect(within(group).getByRole('radio', { name: t('run_labels.type_none') })).not.toBeChecked();
  });

  it('has "just a run" chosen for a run with no type', async () => {
    renderCard();
    await ready();
    expect(screen.getByRole('radio', { name: t('run_labels.type_none') })).toBeChecked();
  });

  it('saves a type at once, shows it before the server answers and tells a screen reader', async () => {
    let release;
    patchGate = new Promise((resolve) => { release = resolve; });
    renderCard();
    await ready();

    await userEvent.click(screen.getByRole('radio', { name: t('run_labels.type_RACE') }));

    expect(patched).toEqual([{ runType: 'RACE' }]);
    expect(screen.getByRole('radio', { name: t('run_labels.type_RACE') })).toBeChecked();
    expect(screen.getByRole('group', { name: t('run_labels.type_group') })).toHaveAttribute('aria-busy', 'true');

    release();
    await waitFor(() => expect(screen.getByRole('group', { name: t('run_labels.type_group') })).not.toHaveAttribute('aria-busy'));
    expect(screen.getAllByRole('status').some((node) => node.textContent === t('run_labels.saved_type', { type: t('run_labels.type_RACE') }))).toBe(true);
  });

  it('clears the type when "just a run" is chosen, sending null and not an empty word', async () => {
    served = labels({ runType: 'WORKOUT' });
    renderCard();
    await ready();

    await userEvent.click(screen.getByRole('radio', { name: t('run_labels.type_none') }));

    expect(patched).toEqual([{ runType: null }]);
    await waitFor(() => expect(screen.getByRole('radio', { name: t('run_labels.type_none') })).toBeChecked());
    expect(screen.getAllByRole('status').some((node) => node.textContent === t('run_labels.saved_type_cleared'))).toBe(true);
  });

  it('asks for nothing when the type already chosen is chosen again', async () => {
    served = labels({ runType: 'RACE' });
    renderCard();
    await ready();

    await userEvent.click(screen.getByRole('radio', { name: t('run_labels.type_RACE') }));

    expect(patched).toEqual([]);
  });

  it('puts the earlier type back, and says why, when the save fails', async () => {
    served = labels({ runType: 'LONG_RUN' });
    patchAnswer = () => new Error('nope');
    renderCard();
    await ready();

    await userEvent.click(screen.getByRole('radio', { name: t('run_labels.type_RACE') }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_labels.save_failed'));
    expect(screen.getByRole('radio', { name: t('run_labels.type_LONG_RUN') })).toBeChecked();
    expect(screen.getByRole('radio', { name: t('run_labels.type_RACE') })).not.toBeChecked();
  });

  it('shows a second change made while the first is still being saved, and saves it after the first', async () => {
    let release;
    patchGate = new Promise((resolve) => { release = resolve; });
    renderCard();
    await ready();

    await userEvent.click(screen.getByRole('radio', { name: t('run_labels.type_RACE') }));
    await userEvent.click(screen.getByRole('radio', { name: t('run_labels.type_WORKOUT') }));

    expect(screen.getByRole('radio', { name: t('run_labels.type_WORKOUT') })).toBeChecked();
    expect(patched).toEqual([{ runType: 'RACE' }]);
    release();

    await waitFor(() => expect(patched).toEqual([{ runType: 'RACE' }, { runType: 'WORKOUT' }]));
    await waitFor(() => expect(screen.getByRole('group', { name: t('run_labels.type_group') })).not.toHaveAttribute('aria-busy'));
    expect(screen.getByRole('radio', { name: t('run_labels.type_WORKOUT') })).toBeChecked();
  });

  it('sends only the last of several type changes made while one is being saved', async () => {
    let release;
    patchGate = new Promise((resolve) => { release = resolve; });
    renderCard();
    await ready();

    await userEvent.click(screen.getByRole('radio', { name: t('run_labels.type_RACE') }));
    await userEvent.click(screen.getByRole('radio', { name: t('run_labels.type_LONG_RUN') }));
    await userEvent.click(screen.getByRole('radio', { name: t('run_labels.type_WORKOUT') }));
    release();

    await waitFor(() => expect(screen.getByRole('group', { name: t('run_labels.type_group') })).not.toHaveAttribute('aria-busy'));
    expect(patched).toEqual([{ runType: 'RACE' }, { runType: 'WORKOUT' }]);
    expect(screen.getByRole('radio', { name: t('run_labels.type_WORKOUT') })).toBeChecked();
  });

  it('follows the arrow keys through the types, saving where the runner stops', async () => {
    served = labels({ runType: 'RACE' });
    renderCard();
    await ready();

    screen.getByRole('radio', { name: t('run_labels.type_RACE') }).focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');

    await waitFor(() => expect(screen.getByRole('radio', { name: t('run_labels.type_WORKOUT') })).toBeChecked());
    await waitFor(() => expect(screen.getByRole('group', { name: t('run_labels.type_group') })).not.toHaveAttribute('aria-busy'));
    expect(patched.at(-1)).toEqual({ runType: 'WORKOUT' });
    expect(screen.getByRole('radio', { name: t('run_labels.type_WORKOUT') })).toHaveFocus();
  });

  it('drops a change that was waiting behind one that failed, and puts the confirmed labels back', async () => {
    let release;
    patchGate = new Promise((resolve) => { release = resolve; });
    patchAnswer = () => new Error('nope');
    served = labels({ runType: 'LONG_RUN', tags: ['dog'] });
    renderCard();
    await ready();

    await userEvent.click(screen.getByRole('radio', { name: t('run_labels.type_RACE') }));
    await userEvent.type(screen.getByRole('textbox', { name: t('run_labels.tag_input') }), 'hills{Enter}');
    expect(screen.getByRole('radio', { name: t('run_labels.type_RACE') })).toBeChecked();
    expect(screen.getByText('hills')).toBeInTheDocument();
    release();

    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_labels.save_failed'));
    expect(screen.getByRole('radio', { name: t('run_labels.type_LONG_RUN') })).toBeChecked();
    expect(screen.queryByText('hills')).not.toBeInTheDocument();
    expect(patched).toEqual([{ runType: 'RACE' }]);
  });

  it('shows a type it does not know by its own name rather than hiding it', async () => {
    served = labels({ runTypes: ['RACE', 'ULTRA'], runType: 'ULTRA' });
    renderCard();
    await ready();

    expect(screen.getByRole('radio', { name: 'ULTRA' })).toBeChecked();
  });
});

describe('the tags', () => {
  it('lists the tags in the order given, each with a button to remove it, and counts them', async () => {
    served = labels({ tags: ['Hill repeats', 'dog'] });
    renderCard();
    await ready();

    const list = screen.getByRole('list', { name: t('run_labels.tags_label') });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent.replace('×', ''))).toEqual(['Hill repeats', 'dog']);
    expect(within(list).getByRole('button', { name: t('run_labels.tag_remove', { tag: 'Hill repeats' }) })).toBeInTheDocument();
    expect(screen.getByText(t('run_labels.tag_counter', { count: 2, max: 6 }))).toBeInTheDocument();
  });

  it('says what tags are for when there are none, and has a box named for adding one', async () => {
    renderCard();
    await ready();

    expect(screen.getByText(t('run_labels.tags_empty'))).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: t('run_labels.tags_label') })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: t('run_labels.tag_input') })).toHaveAttribute('placeholder', t('run_labels.tag_placeholder'));
    expect(screen.getByText(t('run_labels.tag_counter', { count: 0, max: 6 }))).toBeInTheDocument();
  });

  it('adds a typed tag when Enter is pressed, tidied, keeping the old tags and the typing going', async () => {
    served = labels({ tags: ['dog'] });
    renderCard();
    await ready();
    const box = screen.getByRole('textbox', { name: t('run_labels.tag_input') });

    await userEvent.type(box, '  Hill    repeats {Enter}');

    expect(patched).toEqual([{ tags: ['dog', 'Hill repeats'] }]);
    await waitFor(() => expect(box).toHaveValue(''));
    expect(box).toHaveFocus();
    const list = screen.getByRole('list', { name: t('run_labels.tags_label') });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(t('run_labels.tag_counter', { count: 2, max: 6 }))).toBeInTheDocument();
    expect(screen.getAllByRole('status').some((node) => node.textContent === t('run_labels.saved_tag_added', { tag: 'Hill repeats' }))).toBe(true);
  });

  it('adds a tag with the Add button as well', async () => {
    renderCard();
    await ready();

    await userEvent.type(screen.getByRole('textbox', { name: t('run_labels.tag_input') }), 'treadmill');
    await userEvent.click(screen.getByRole('button', { name: t('run_labels.tag_add_label') }));

    expect(patched).toEqual([{ tags: ['treadmill'] }]);
  });

  it('uses the tags the server answers with, in case it tidied them differently', async () => {
    patchAnswer = () => ({ id: 7, tags: ['Cafe au lait'] });
    renderCard();
    await ready();

    await userEvent.type(screen.getByRole('textbox', { name: t('run_labels.tag_input') }), 'cafe au lait{Enter}');

    expect(await screen.findByText('Cafe au lait')).toBeInTheDocument();
    expect(screen.queryByText('cafe au lait')).not.toBeInTheDocument();
  });

  it('does nothing, and says nothing, for an empty box', async () => {
    renderCard();
    await ready();

    await userEvent.type(screen.getByRole('textbox', { name: t('run_labels.tag_input') }), '   {Enter}');
    await userEvent.click(screen.getByRole('button', { name: t('run_labels.tag_add_label') }));

    expect(patched).toEqual([]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('refuses a tag the run already has, in any case, and says so until the runner types again', async () => {
    served = labels({ tags: ['Hills'] });
    renderCard();
    await ready();
    const box = screen.getByRole('textbox', { name: t('run_labels.tag_input') });

    await userEvent.type(box, 'HILLS{Enter}');

    expect(patched).toEqual([]);
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_labels.error_duplicate'));
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
    expect(box).toHaveValue('HILLS');

    await userEvent.type(box, 'x');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(box).not.toHaveAttribute('aria-invalid');
  });

  it('allows 24 characters and refuses 25, counting an emoji as one', async () => {
    renderCard();
    await ready();
    const box = screen.getByRole('textbox', { name: t('run_labels.tag_input') });

    await userEvent.type(box, `${'x'.repeat(25)}{Enter}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_labels.error_too_long', { max: 24 }));
    expect(patched).toEqual([]);

    await userEvent.clear(box);
    await userEvent.type(box, `${'🏃'.repeat(24)}{Enter}`);
    await waitFor(() => expect(patched).toEqual([{ tags: ['🏃'.repeat(24)] }]));
  });

  it('refuses a seventh tag and says how many a run can have', async () => {
    served = labels({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] });
    renderCard();
    await ready();

    await userEvent.type(screen.getByRole('textbox', { name: t('run_labels.tag_input') }), 'g{Enter}');

    expect(patched).toEqual([]);
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_labels.error_full', { max: 6 }));
    expect(screen.getByText(t('run_labels.tag_counter', { count: 6, max: 6 }))).toBeInTheDocument();
  });

  it('uses the limits the server sends', async () => {
    served = labels({ tags: ['a', 'b'], maxTags: 2, maxTagLength: 5 });
    renderCard();
    await ready();
    const box = screen.getByRole('textbox', { name: t('run_labels.tag_input') });

    await userEvent.type(box, 'c{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_labels.error_full', { max: 2 }));
    expect(screen.getByText(t('run_labels.tag_counter', { count: 2, max: 2 }))).toBeInTheDocument();
  });

  it('removes a tag, keeps the others in order, and leaves the keyboard on the card', async () => {
    served = labels({ tags: ['c', 'Hills', 'a'] });
    renderCard();
    const card = await ready();

    await userEvent.click(screen.getByRole('button', { name: t('run_labels.tag_remove', { tag: 'Hills' }) }));

    expect(patched).toEqual([{ tags: ['c', 'a'] }]);
    await waitFor(() => expect(screen.queryByText('Hills')).not.toBeInTheDocument());
    expect(card).toHaveFocus();
    expect(screen.getAllByRole('status').some((node) => node.textContent === t('run_labels.saved_tag_removed', { tag: 'Hills' }))).toBe(true);
  });

  it('removes the last tag and goes back to saying what tags are for', async () => {
    served = labels({ tags: ['only'] });
    renderCard();
    await ready();

    await userEvent.click(screen.getByRole('button', { name: t('run_labels.tag_remove', { tag: 'only' }) }));

    expect(patched).toEqual([{ tags: [] }]);
    expect(await screen.findByText(t('run_labels.tags_empty'))).toBeInTheDocument();
  });

  it('does not bring back a change that was dropped when the next one is made', async () => {
    let release;
    patchGate = new Promise((resolve) => { release = resolve; });
    patchAnswer = () => new Error('nope');
    served = labels({ runType: 'LONG_RUN', tags: ['dog'] });
    renderCard();
    await ready();
    await userEvent.click(screen.getByRole('radio', { name: t('run_labels.type_RACE') }));
    await userEvent.type(screen.getByRole('textbox', { name: t('run_labels.tag_input') }), 'hills{Enter}');
    release();
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_labels.save_failed'));

    patchGate = null;
    patchAnswer = (body) => ({ id: 7, ...body });
    await userEvent.type(screen.getByRole('textbox', { name: t('run_labels.tag_input') }), 'track{Enter}');

    await waitFor(() => expect(screen.getByText('track')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('group', { name: t('run_labels.type_group') })).not.toHaveAttribute('aria-busy'));
    expect(patched).toEqual([{ runType: 'RACE' }, { tags: ['dog', 'track'] }]);
    expect(screen.queryByText('hills')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: t('run_labels.type_LONG_RUN') })).toBeChecked();
  });

  it('puts the tags back and says why when a save fails, and the runner can add the tag again', async () => {
    served = labels({ tags: ['dog'] });
    patchAnswer = () => new Error('nope');
    renderCard();
    await ready();
    const box = screen.getByRole('textbox', { name: t('run_labels.tag_input') });

    await userEvent.type(box, 'hills{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_labels.save_failed'));
    const list = screen.getByRole('list', { name: t('run_labels.tags_label') });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText(t('run_labels.tag_counter', { count: 1, max: 6 }))).toBeInTheDocument();

    patchAnswer = (body) => ({ id: 7, ...body });
    await userEvent.type(box, 'hills{Enter}');
    await waitFor(() => expect(within(screen.getByRole('list', { name: t('run_labels.tags_label') })).getAllByRole('listitem')).toHaveLength(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('removes two tags in quick succession, in the order asked, without losing the second', async () => {
    let release;
    patchGate = new Promise((resolve) => { release = resolve; });
    served = labels({ tags: ['a', 'b', 'c'] });
    renderCard();
    await ready();

    await userEvent.click(screen.getByRole('button', { name: t('run_labels.tag_remove', { tag: 'a' }) }));
    await userEvent.click(screen.getByRole('button', { name: t('run_labels.tag_remove', { tag: 'c' }) }));
    expect(screen.queryByText('a')).not.toBeInTheDocument();
    expect(screen.queryByText('c')).not.toBeInTheDocument();
    release();

    await waitFor(() => expect(patched).toEqual([{ tags: ['b', 'c'] }, { tags: ['b'] }]));
    await waitFor(() => expect(screen.getByRole('group', { name: t('run_labels.type_group') })).not.toHaveAttribute('aria-busy'));
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('adds two tags in quick succession, each on top of the one before', async () => {
    let release;
    patchGate = new Promise((resolve) => { release = resolve; });
    renderCard();
    await ready();
    const box = screen.getByRole('textbox', { name: t('run_labels.tag_input') });

    await userEvent.type(box, 'one{Enter}two{Enter}');
    release();

    await waitFor(() => expect(patched).toEqual([{ tags: ['one'] }, { tags: ['one', 'two'] }]));
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
  });

  it('counts a tag added a moment ago when it checks the next one against the limit', async () => {
    let release;
    patchGate = new Promise((resolve) => { release = resolve; });
    served = labels({ tags: ['a', 'b', 'c', 'd', 'e'] });
    renderCard();
    await ready();
    const box = screen.getByRole('textbox', { name: t('run_labels.tag_input') });

    await userEvent.type(box, 'f{Enter}g{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_labels.error_full', { max: 6 }));
    release();
    await waitFor(() => expect(patched).toEqual([{ tags: ['a', 'b', 'c', 'd', 'e', 'f'] }]));
  });

  it('lets a very long tag be read in full on hover while the chip stays inside the card', async () => {
    const long = 'a-very-long-tag-of-24ch!';
    served = labels({ tags: [long] });
    renderCard();
    await ready();

    expect(screen.getByText(long)).toHaveAttribute('title', long);
  });
});

describe('the runner\'s other tags', () => {
  const suggestions = [{ tag: 'Track', runs: 9 }, { tag: 'hills', runs: 7 }, { tag: 'easy', runs: 4 }];

  it('offers the tags the run does not have yet, most used first', async () => {
    served = labels({ tags: ['HILLS'], suggestions });
    renderCard();
    await ready();

    const list = screen.getByRole('list', { name: t('run_labels.suggestions_label') });
    expect(within(list).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      t('run_labels.suggestion_add', { tag: 'Track' }),
      t('run_labels.suggestion_add', { tag: 'easy' }),
    ]);
  });

  it('puts a tapped suggestion on the run without raising the keyboard', async () => {
    served = labels({ tags: ['dog'], suggestions });
    renderCard();
    const card = await ready();

    await userEvent.click(screen.getByRole('button', { name: t('run_labels.suggestion_add', { tag: 'Track' }) }));

    expect(patched).toEqual([{ tags: ['dog', 'Track'] }]);
    await waitFor(() => expect(screen.queryByRole('button', { name: t('run_labels.suggestion_add', { tag: 'Track' }) })).not.toBeInTheDocument());
    expect(card).toHaveFocus();
    expect(screen.getByRole('textbox', { name: t('run_labels.tag_input') })).not.toHaveFocus();
  });

  it('shows nothing when there is nothing to offer', async () => {
    renderCard();
    await ready();
    expect(screen.queryByRole('list', { name: t('run_labels.suggestions_label') })).not.toBeInTheDocument();
  });

  it('says a run is full when a suggestion is tapped on a full run', async () => {
    served = labels({ tags: ['a', 'b', 'c', 'd', 'e', 'f'], suggestions });
    renderCard();
    await ready();

    await userEvent.click(screen.getByRole('button', { name: t('run_labels.suggestion_add', { tag: 'Track' }) }));

    expect(patched).toEqual([]);
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_labels.error_full', { max: 6 }));
  });
});

describe('around the card', () => {
  it('links to the training log', async () => {
    renderCard();
    await ready();
    expect(screen.getByRole('link', { name: t('run_labels.log_link') })).toHaveAttribute('href', '/training-log');
  });

  it('asks for the labels of the run it is given, and of no other', async () => {
    renderCard(7);
    await ready();
    expect(labelCalls()).toHaveLength(1);
    expect(apiJson.mock.calls.every(([url]) => String(url).includes('/api/activities/7'))).toBe(true);
  });

  it('asks for nothing without a run', () => {
    renderCard(null);
    expect(apiJson).not.toHaveBeenCalled();
  });
});

describe('in Chinese', () => {
  it('speaks Chinese everywhere, tags and numbers included', async () => {
    state.lang = 'zh-CN';
    served = labels({ runType: 'RACE', tags: ['爬坡', '跑步机'], suggestions: [{ tag: '遛狗', runs: 3 }] });
    renderCard();
    const card = await screen.findByRole('region', { name: '类型与标签' });
    await screen.findByRole('group', { name: '跑步类型' });

    expect(within(card).getByRole('radio', { name: '比赛' })).toBeChecked();
    expect(within(card).getByRole('radio', { name: '普通跑步' })).toBeInTheDocument();
    expect(within(card).getByText('2 / 6')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: '移除标签 爬坡' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: '添加标签 遛狗' })).toBeInTheDocument();
    expect(within(card).getByRole('textbox', { name: '添加标签' })).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: '在训练日志中查看带标签的跑步' })).toBeInTheDocument();
  });
});
