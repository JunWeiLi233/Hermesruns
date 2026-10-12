import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { formatShoeDisplayName } from '../../../utils/shoeNames';
import RunEditDrawer from '../RunEditDrawer';

const state = vi.hoisted(() => ({ lang: 'en' }));
const t = (key, params = {}) => {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};

vi.mock('../../../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({ lang: state.lang, t, formatNumber: (value) => String(value) }),
}));

const SHOES = [
  { id: 3, brand: 'Nike', model: 'Pegasus', nickname: null, retired: false },
  { id: 5, brand: 'Asics', model: 'Novablast', nickname: 'Blue', retired: false },
  { id: 9, brand: 'Saucony', model: 'Ride', nickname: null, retired: true },
];

function runEdit(overrides = {}) {
  return {
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
  };
}

const shoeName = (shoe) => formatShoeDisplayName({ brand: shoe.brand, model: shoe.model, nickname: shoe.nickname, lang: 'en' });

let server;
const patchCalls = () => apiJson.mock.calls.filter(([url, options]) => url === '/api/activities/7' && options?.method === 'PATCH');
const shoeCalls = () => apiJson.mock.calls.filter(([url]) => String(url).startsWith('/api/shoes/'));
const lastBody = () => JSON.parse(patchCalls().at(-1)[1].body);

beforeEach(() => {
  state.lang = 'en';
  server = {
    edit: runEdit(),
    patch: (body) => ({ id: 7, ...body }),
    assign: (shoeId) => ({ message: 'ok', activityId: 7, shoeId: shoeId === 0 ? null : shoeId, shoeName: shoeId === 5 ? 'Asics Novablast' : null }),
  };
  apiJson.mockReset();
  apiJson.mockImplementation(async (url, options) => {
    if (url === '/api/activities/7/edit') return server.edit;
    if (url === '/api/activities/7' && options?.method === 'PATCH') return server.patch(JSON.parse(options.body));
    const assign = /^\/api\/shoes\/(\d+)\/assign\/7$/.exec(url);
    if (assign && options?.method === 'PATCH') return server.assign(Number(assign[1]));
    return {};
  });
});
afterEach(() => cleanup());

async function open(props = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const view = render(
    <RunEditDrawer runId={7} provider="GARMIN" shoes={SHOES} currentShoeName={null} lang="en" onClose={onClose} onSaved={onSaved} {...props} />,
  );
  await screen.findByRole('textbox', { name: t('run_edit.name_label') });
  return { ...view, onClose, onSaved };
}

const title = () => screen.getByRole('textbox', { name: t('run_edit.name_label') });
const notes = () => screen.getByRole('textbox', { name: t('run_edit.notes_label') });
const rating = (value) => screen.getByRole('radio', { name: t('run_edit.rating_option', { value }) });
const useRatingBox = () => screen.getByRole('checkbox', { name: t('run_edit.use_rating_label') });
const runType = (name) => screen.getByRole('radio', { name });
const shoeSelect = () => screen.getByRole('combobox', { name: t('run_edit.shoe_label') });
const tagInput = () => screen.getByRole('textbox', { name: t('run_labels.tag_input') });
const saveButton = () => screen.getByRole('button', { name: t('run_edit.save') });

describe('opening the drawer', () => {
  it('says it is loading, then shows the run\'s own title, notes, rating, type, tags and shoe', async () => {
    server.edit = runEdit({ notes: 'Windy.\nHeavy legs.', perceivedExertion: 6, useRatingForEffort: true, runType: 'WORKOUT', tags: ['hills', 'windy'], shoeId: 5 });
    const onClose = vi.fn();
    render(<RunEditDrawer runId={7} provider="GARMIN" shoes={SHOES} lang="en" onClose={onClose} onSaved={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: t('run_edit.title') })).toBeInTheDocument();
    expect(screen.getByText(t('run_edit.loading'))).toBeInTheDocument();

    await screen.findByRole('textbox', { name: t('run_edit.name_label') });
    expect(title()).toHaveValue('Afternoon Run');
    expect(notes()).toHaveValue('Windy.\nHeavy legs.');
    expect(rating(6)).toBeChecked();
    expect(rating(5)).not.toBeChecked();
    expect(useRatingBox()).toBeChecked();
    expect(useRatingBox()).toBeEnabled();
    expect(runType(t('run_labels.type_WORKOUT'))).toBeChecked();
    expect(runType(t('run_labels.type_none'))).not.toBeChecked();
    const chips = within(screen.getByRole('list', { name: t('run_labels.tags_label') })).getAllByRole('listitem');
    expect(chips.map((chip) => chip.textContent.replace('×', ''))).toEqual(['hills', 'windy']);
    expect(shoeSelect()).toHaveValue('5');
    expect(saveButton()).toBeDisabled();
    expect(apiJson).toHaveBeenCalledWith('/api/activities/7/edit', expect.anything());
  });

  it('shows the counters and sets the lengths the server sent on the boxes', async () => {
    server.edit = runEdit({ notes: 'abc', limits: { maxNameLength: 30, maxNotesLength: 100, maxTags: 6, maxTagLength: 24 } });
    await open();
    expect(screen.getByText(t('run_edit.count', { count: 13, max: 30 }))).toBeInTheDocument();
    expect(screen.getByText(t('run_edit.count', { count: 3, max: 100 }))).toBeInTheDocument();
    expect(title()).toHaveAttribute('maxlength', '30');
    expect(notes()).toHaveAttribute('maxlength', '100');
  });

  it('says so when the run cannot be loaded, and loads it on retry', async () => {
    apiJson.mockRejectedValueOnce(new Error('down'));
    const user = userEvent.setup();
    render(<RunEditDrawer runId={7} provider="GARMIN" shoes={SHOES} lang="en" onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_edit.load_error'));
    await user.click(screen.getByRole('button', { name: t('run_edit.retry') }));
    expect(await screen.findByRole('textbox', { name: t('run_edit.name_label') })).toHaveValue('Afternoon Run');
  });

  it('treats an answer without the parts of a run as a failed load', async () => {
    apiJson.mockResolvedValueOnce({ id: 7 });
    render(<RunEditDrawer runId={7} provider="GARMIN" shoes={SHOES} lang="en" onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_edit.load_error'));
  });

  it('is written in Chinese when the language is Chinese', async () => {
    state.lang = 'zh-CN';
    await open({ lang: 'zh-CN' });
    expect(screen.getByRole('dialog', { name: '编辑跑步' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '标题' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '备注' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3 分（满分 10）' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存修改' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '跑鞋' })).toBeInTheDocument();
  });

  it('says Strava will not change a title the runner sets, for a Strava run only', async () => {
    const view = await open({ provider: 'STRAVA' });
    expect(screen.getByText(t('run_edit.name_hint_strava'))).toBeInTheDocument();
    view.unmount();
    await open({ provider: 'GARMIN' });
    expect(screen.queryByText(t('run_edit.name_hint_strava'))).not.toBeInTheDocument();
  });
});

describe('saving', () => {
  it('sends only the title when only the title changed, tells the page, and closes', async () => {
    const user = userEvent.setup();
    const { onClose, onSaved } = await open();
    await user.clear(title());
    await user.type(title(), '  Windy   Sunday 8K ');
    await user.click(saveButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(patchCalls()).toHaveLength(1);
    expect(lastBody()).toEqual({ name: 'Windy Sunday 8K' });
    expect(patchCalls()[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
    expect(onSaved).toHaveBeenCalledWith({ fields: ['name'], shoeChanged: false, name: 'Windy Sunday 8K', notes: null });
    expect(shoeCalls()).toHaveLength(0);
  });

  it('sends everything that changed in one request', async () => {
    server.edit = runEdit({ notes: 'old notes', perceivedExertion: 4, runType: 'RACE', tags: ['a'] });
    const user = userEvent.setup();
    const { onSaved } = await open();
    await user.clear(title());
    await user.type(title(), 'Track night');
    await user.clear(notes());
    await user.type(notes(), '6 x 800');
    await user.click(rating(8));
    await user.click(useRatingBox());
    await user.click(runType(t('run_labels.type_WORKOUT')));
    await user.type(tagInput(), 'track{Enter}');
    await user.click(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(patchCalls()).toHaveLength(1);
    expect(lastBody()).toEqual({
      name: 'Track night',
      notes: '6 x 800',
      perceivedExertion: 8,
      useRatingForEffort: true,
      runType: 'WORKOUT',
      tags: ['a', 'track'],
    });
    expect(onSaved.mock.calls[0][0].fields).toEqual(['name', 'notes', 'perceivedExertion', 'useRatingForEffort', 'runType', 'tags']);
  });

  it('clears the notes with null, and the rating along with the choice to use it', async () => {
    server.edit = runEdit({ notes: 'old notes', perceivedExertion: 7, useRatingForEffort: true });
    const user = userEvent.setup();
    const { onSaved } = await open();
    await user.clear(notes());
    await user.click(screen.getByRole('button', { name: t('run_edit.rating_clear') }));
    expect(useRatingBox()).toBeDisabled();
    expect(useRatingBox()).not.toBeChecked();
    await user.click(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(lastBody()).toEqual({ notes: null, perceivedExertion: null, useRatingForEffort: false });
    expect(onSaved.mock.calls[0][0]).toMatchObject({ notes: null });
  });

  it('keeps Save disabled until something is different, and different again from the saved one', async () => {
    const user = userEvent.setup();
    await open();
    expect(saveButton()).toBeDisabled();
    await user.type(notes(), 'x');
    expect(saveButton()).toBeEnabled();
    await user.clear(notes());
    expect(saveButton()).toBeDisabled();
    await user.type(title(), '!');
    await user.type(title(), '{Backspace}');
    expect(saveButton()).toBeDisabled();
  });

  it('does not save when Enter is pressed in the title and nothing changed', async () => {
    const user = userEvent.setup();
    await open();
    await user.type(title(), '{Enter}');
    expect(patchCalls()).toHaveLength(0);
  });

  it('saves with Enter in the title when something changed', async () => {
    const user = userEvent.setup();
    const { onClose } = await open();
    await user.type(title(), ' 2{Enter}');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(lastBody()).toEqual({ name: 'Afternoon Run 2' });
  });

  it('shows what it is doing and holds the form still while it saves', async () => {
    let finish;
    server.patch = (body) => new Promise((resolve) => { finish = () => resolve({ id: 7, ...body }); });
    const user = userEvent.setup();
    const { onClose } = await open();
    await user.type(title(), '!');
    await user.click(saveButton());

    expect(await screen.findByRole('button', { name: t('run_edit.saving') })).toBeDisabled();
    expect(title()).toBeDisabled();
    expect(notes()).toBeDisabled();
    expect(shoeSelect()).toBeDisabled();
    expect(screen.getByRole('button', { name: t('run_edit.cancel') })).toBeDisabled();
    expect(patchCalls()).toHaveLength(1);
    finish();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('the shoe', () => {
  it('lists the shoes in use, and a shoe the run has even when it is retired', async () => {
    server.edit = runEdit({ shoeId: 9 });
    await open();
    const options = within(shoeSelect()).getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual([
      t('run_edit.shoe_none'),
      shoeName(SHOES[0]),
      shoeName(SHOES[1]),
      t('run_edit.shoe_retired', { name: shoeName(SHOES[2]) }),
    ]);
    expect(shoeSelect()).toHaveValue('9');
  });

  it('does not offer a retired shoe the run does not have', async () => {
    await open();
    const options = within(shoeSelect()).getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual([t('run_edit.shoe_none'), shoeName(SHOES[0]), shoeName(SHOES[1])]);
  });

  it('falls back to the name the page knows for a shoe that is not in the list', async () => {
    server.edit = runEdit({ shoeId: 44 });
    await open({ currentShoeName: 'Old Brooks' });
    expect(shoeSelect()).toHaveValue('44');
    expect(within(shoeSelect()).getByRole('option', { name: 'Old Brooks' })).toBeInTheDocument();
  });

  it('links another shoe by its own route after nothing else is sent, and tells the page', async () => {
    server.edit = runEdit({ shoeId: 3 });
    const user = userEvent.setup();
    const { onClose, onSaved } = await open();
    await user.selectOptions(shoeSelect(), '5');
    await user.click(saveButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(patchCalls()).toHaveLength(0);
    expect(shoeCalls()).toEqual([['/api/shoes/5/assign/7', { method: 'PATCH' }]]);
    expect(onSaved).toHaveBeenCalledWith({ fields: [], shoeChanged: true, shoeId: 5, shoeName: 'Asics Novablast', name: 'Afternoon Run', notes: null });
  });

  it('unlinks the shoe with the route\'s 0', async () => {
    server.edit = runEdit({ shoeId: 3 });
    const user = userEvent.setup();
    const { onSaved } = await open();
    await user.selectOptions(shoeSelect(), '');
    await user.click(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(shoeCalls().map(([url]) => url)).toEqual(['/api/shoes/0/assign/7']);
    expect(onSaved.mock.calls[0][0]).toMatchObject({ shoeChanged: true, shoeId: null, shoeName: null });
  });

  it('saves the fields first and the shoe after, in two requests', async () => {
    const user = userEvent.setup();
    const { onSaved } = await open();
    await user.type(notes(), 'new shoes!');
    await user.selectOptions(shoeSelect(), '3');
    await user.click(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(lastBody()).toEqual({ notes: 'new shoes!' });
    expect(shoeCalls().map(([url]) => url)).toEqual(['/api/shoes/3/assign/7']);
    expect(onSaved.mock.calls[0][0]).toMatchObject({ fields: ['notes'], shoeChanged: true, shoeId: 3, notes: 'new shoes!' });
  });

  it('says so when the fields were saved and the shoe was not, tells the page about the fields, and lets the runner try the shoe again', async () => {
    let shoeWorks = false;
    server.assign = (shoeId) => {
      if (!shoeWorks) throw Object.assign(new Error('down'), { status: 500 });
      return { shoeId, shoeName: 'Nike Pegasus' };
    };
    const user = userEvent.setup();
    const { onClose, onSaved } = await open();
    await user.type(title(), '!');
    await user.selectOptions(shoeSelect(), '3');
    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_edit.shoe_failed'));
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved.mock.calls[0][0]).toMatchObject({ fields: ['name'], shoeChanged: false, name: 'Afternoon Run!' });
    expect(title()).toHaveValue('Afternoon Run!');
    expect(shoeSelect()).toHaveValue('3');
    expect(saveButton()).toBeEnabled();

    shoeWorks = true;
    await user.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(patchCalls()).toHaveLength(1);
    expect(onSaved).toHaveBeenCalledTimes(2);
    expect(onSaved.mock.calls[1][0]).toMatchObject({ fields: [], shoeChanged: true, shoeId: 3 });
  });
});

describe('what the drawer refuses', () => {
  it('will not save an empty title, says so under the title and puts the cursor there, and sends nothing', async () => {
    const user = userEvent.setup();
    await open();
    await user.clear(title());
    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_edit.name_empty'));
    expect(title()).toHaveAttribute('aria-invalid', 'true');
    expect(title()).toHaveFocus();
    expect(patchCalls()).toHaveLength(0);

    await user.type(title(), 'Back');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(title()).not.toHaveAttribute('aria-invalid');
  });

  it('will not save a title of only spaces or with a control character', async () => {
    const user = userEvent.setup();
    await open();
    await user.clear(title());
    await user.type(title(), '    ');
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_edit.name_empty'));

    fireEvent.change(title(), { target: { value: 'bell\u0007' } });
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_edit.name_control'));
    expect(patchCalls()).toHaveLength(0);
  });

  it('will not save a title that is too long, such as one that came from Strava, once the runner has changed it', async () => {
    server.edit = runEdit({ name: 'x'.repeat(130) });
    const user = userEvent.setup();
    await open();
    // The box takes nothing more at its limit, but a long title can be cut down: to 129 is still too long.
    await user.type(title(), '{Backspace}');
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_edit.name_too_long', { max: 120 }));
    expect(patchCalls()).toHaveLength(0);
  });

  it('will not save notes with a control character, and says so under the notes', async () => {
    const user = userEvent.setup();
    await open();
    fireEvent.change(notes(), { target: { value: 'bell\u0007' } });
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_edit.notes_control'));
    expect(notes()).toHaveAttribute('aria-invalid', 'true');
    expect(notes()).toHaveFocus();
    expect(patchCalls()).toHaveLength(0);
  });

  it('says so when the server refuses what the drawer accepted, and keeps the draft', async () => {
    server.patch = () => { throw Object.assign(new Error('The title cannot...'), { status: 400 }); };
    const user = userEvent.setup();
    const { onClose, onSaved } = await open();
    await user.type(title(), '!');
    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_edit.save_refused'));
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(title()).toHaveValue('Afternoon Run!');
    expect(saveButton()).toBeEnabled();
  });

  it('says so when saving fails, changes nothing, and a second try works', async () => {
    let works = false;
    server.patch = (body) => {
      if (!works) throw Object.assign(new Error('down'), { status: 500 });
      return { id: 7, ...body };
    };
    const user = userEvent.setup();
    const { onClose, onSaved } = await open();
    await user.type(title(), '!');
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_edit.save_failed'));
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    works = true;
    await user.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByText(t('run_edit.save_failed'))).not.toBeInTheDocument();
  });
});

describe('the rating', () => {
  it('cannot be used for the effort until there is one', async () => {
    const user = userEvent.setup();
    await open();
    expect(useRatingBox()).toBeDisabled();
    expect(screen.getByText(t('run_edit.use_rating_needs'))).toBeInTheDocument();
    expect(screen.getByText(t('run_edit.rating_none'))).toBeInTheDocument();
    await user.click(rating(7));
    expect(useRatingBox()).toBeEnabled();
    expect(screen.getByText(t('run_edit.rating_chosen', { value: 7 }))).toBeInTheDocument();
    expect(screen.getByText(t('run_edit.use_rating_hint'))).toBeInTheDocument();
  });

  it('can be chosen with the arrow keys, as any group of radio buttons can', async () => {
    const user = userEvent.setup();
    await open();
    rating(3).focus();
    await user.click(rating(3));
    await user.keyboard('{ArrowRight}');
    expect(rating(4)).toBeChecked();
  });

  it('is cleared with its link, which takes the choice with it', async () => {
    server.edit = runEdit({ perceivedExertion: 9, useRatingForEffort: true });
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: t('run_edit.rating_clear') }));
    expect(screen.queryByRole('radio', { checked: true, name: /out of 10/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('run_edit.rating_clear') })).not.toBeInTheDocument();
    expect(useRatingBox()).toBeDisabled();
    expect(useRatingBox()).not.toBeChecked();
  });
});

describe('the tags', () => {
  it('are added with Enter without saving the run, trimmed, and the box is emptied', async () => {
    const user = userEvent.setup();
    await open();
    await user.type(tagInput(), '  Hill   repeats {Enter}');
    expect(patchCalls()).toHaveLength(0);
    expect(tagInput()).toHaveValue('');
    expect(screen.getByRole('list', { name: t('run_labels.tags_label') })).toHaveTextContent('Hill repeats');
    expect(screen.getByText(t('run_labels.tag_counter', { count: 1, max: 6 }))).toBeInTheDocument();
  });

  it('are added with the Add button, and nothing is added for an empty box', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: t('run_labels.tag_add_label') }));
    expect(screen.queryByRole('list', { name: t('run_labels.tags_label') })).not.toBeInTheDocument();
    await user.type(tagInput(), 'track');
    await user.click(screen.getByRole('button', { name: t('run_labels.tag_add_label') }));
    expect(screen.getByRole('list', { name: t('run_labels.tags_label') })).toHaveTextContent('track');
  });

  it('are not added while an input method is still composing a word', async () => {
    const user = userEvent.setup();
    await open();
    await user.type(tagInput(), '跑');
    fireEvent.keyDown(tagInput(), { key: 'Enter', isComposing: true });
    expect(screen.queryByRole('list', { name: t('run_labels.tags_label') })).not.toBeInTheDocument();
    fireEvent.keyDown(tagInput(), { key: 'Enter' });
    expect(screen.getByRole('list', { name: t('run_labels.tags_label') })).toHaveTextContent('跑');
  });

  it('explain why a tag cannot be added: it is there already, too long, or there are too many', async () => {
    server.edit = runEdit({ tags: ['a', 'b', 'c', 'd', 'e'] });
    const user = userEvent.setup();
    await open();
    await user.type(tagInput(), 'A{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_labels.error_duplicate'));

    await user.clear(tagInput());
    await user.type(tagInput(), `${'x'.repeat(25)}{Enter}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_labels.error_too_long', { max: 24 }));

    await user.clear(tagInput());
    await user.type(tagInput(), 'f{Enter}');
    await user.type(tagInput(), 'g{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_labels.error_full', { max: 6 }));
    expect(tagInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('are removed with their buttons', async () => {
    server.edit = runEdit({ tags: ['hills', 'windy'] });
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: t('run_labels.tag_remove', { tag: 'hills' }) }));
    expect(screen.getByRole('list', { name: t('run_labels.tags_label') })).not.toHaveTextContent('hills');
    expect(saveButton()).toBeEnabled();
    await user.click(saveButton());
    await waitFor(() => expect(patchCalls()).toHaveLength(1));
    expect(lastBody()).toEqual({ tags: ['windy'] });
  });

  it('are offered from the runner\'s own most used, without the ones the run has, and added with a click', async () => {
    server.edit = runEdit({ tags: ['hills'], suggestions: [{ tag: 'hills', count: 9 }, { tag: 'track', count: 4 }, { tag: 'with the dog', count: 2 }] });
    const user = userEvent.setup();
    await open();
    expect(screen.queryByRole('button', { name: t('run_labels.suggestion_add', { tag: 'hills' }) })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('run_labels.suggestion_add', { tag: 'track' }) }));
    expect(screen.getByRole('list', { name: t('run_labels.tags_label') })).toHaveTextContent('track');
    expect(screen.queryByRole('button', { name: t('run_labels.suggestion_add', { tag: 'track' }) })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('run_labels.suggestion_add', { tag: 'with the dog' }) })).toBeInTheDocument();
  });
});

describe('leaving', () => {
  it('closes at once when nothing was changed', async () => {
    const user = userEvent.setup();
    const { onClose } = await open();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes at once from Cancel and from the close button when nothing was changed', async () => {
    const user = userEvent.setup();
    const first = await open();
    await user.click(screen.getByRole('button', { name: t('run_edit.cancel') }));
    expect(first.onClose).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = await open();
    await user.click(screen.getByRole('button', { name: t('run_edit.close') }));
    expect(second.onClose).toHaveBeenCalledTimes(1);
  });

  it('asks before leaving with unsaved changes, and goes on editing when told to', async () => {
    const user = userEvent.setup();
    const { onClose } = await open();
    await user.type(notes(), 'half a thought');
    await user.keyboard('{Escape}');

    const question = await screen.findByRole('alertdialog');
    expect(question).toHaveTextContent(t('run_edit.unsaved'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: t('run_edit.save') })).not.toBeInTheDocument();
    await user.click(within(question).getByRole('button', { name: t('run_edit.keep') }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(notes()).toHaveValue('half a thought');
    expect(saveButton()).toBeEnabled();
  });

  it('throws the changes away when told to', async () => {
    const user = userEvent.setup();
    const { onClose, onSaved } = await open();
    await user.type(notes(), 'half a thought');
    await user.click(screen.getByRole('button', { name: t('run_edit.close') }));
    await user.click(await screen.findByRole('button', { name: t('run_edit.discard') }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(patchCalls()).toHaveLength(0);
  });

  it('asks from Cancel as well, and counts a changed shoe as a change', async () => {
    const user = userEvent.setup();
    const { onClose } = await open();
    await user.selectOptions(shoeSelect(), '3');
    await user.click(screen.getByRole('button', { name: t('run_edit.cancel') }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close while a save is on its way', async () => {
    let finish;
    server.patch = (body) => new Promise((resolve) => { finish = () => resolve({ id: 7, ...body }); });
    const user = userEvent.setup();
    const { onClose } = await open();
    await user.type(title(), '!');
    await user.click(saveButton());
    await screen.findByRole('button', { name: t('run_edit.saving') });
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    finish();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('can be left while it is still loading', async () => {
    apiJson.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<RunEditDrawer runId={7} provider="GARMIN" shoes={SHOES} lang="en" onClose={onClose} onSaved={vi.fn()} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
