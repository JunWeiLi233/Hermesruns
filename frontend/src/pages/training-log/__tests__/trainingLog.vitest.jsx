import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import TrainingLog from '../TrainingLog';
import { day, emptyWeeks, log, run, threeWeeks, week } from './trainingLogFixtures';

const state = vi.hoisted(() => ({ lang: 'en', unit: 'km' }));
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
vi.mock('../../../contexts/UnitContext', () => ({
  useUnit: () => ({ unit: state.unit, isMile: state.unit === 'mile' }),
}));
// The goals card has tests of its own; here it is a marker, so its requests and messages do not mix with the log's.
vi.mock('../../../components/goals/GoalsCard', () => ({ default: () => <div data-testid="goals-card" /> }))
vi.mock('../../../components/AuthenticatedPageChrome', () => ({
  default: ({ children, title, parentLabel, parentRoute, activeKey, bodyClassName }) => (
    <div data-testid="chrome" className={bodyClassName} data-title={title} data-parent-label={parentLabel} data-parent-route={parentRoute} data-active-key={activeKey}>
      {children}
    </div>
  ),
}));

let respond;
const logCalls = () => apiJson.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/api/training/log'));

function Where() {
  const location = useLocation();
  return <span data-testid="where">{`${location.pathname}${location.search}`}</span>;
}

function renderPage(entry = '/training-log') {
  return render(<MemoryRouter initialEntries={[entry]}><Where /><TrainingLog /></MemoryRouter>);
}

async function ready() {
  await screen.findByRole('heading', { level: 2, name: t('training_log.title') });
  await screen.findAllByRole('article');
}

const weekCard = (name) => screen.getByRole('article', { name });

beforeEach(() => {
  state.lang = 'en';
  state.unit = 'km';
  apiJson.mockReset();
  respond = () => log();
  apiJson.mockImplementation(async (url, options) => {
    const result = await respond(String(url), options);
    if (result instanceof Error) throw result;
    return result;
  });
});
afterEach(() => cleanup());

describe('around the page', () => {
  it('sits in the runner shell as a part of Runs, with its own title', async () => {
    const { container } = renderPage();
    await ready();

    expect(screen.queryByTestId('chrome')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: t('training_log.title') })).toHaveClass('training-log-v2');
    expect(container.querySelectorAll('h1')).toHaveLength(0);
  });

  it('puts the goals card between the heading and the filters', async () => {
    renderPage();
    await ready();

    const goals = screen.getByTestId('goals-card');
    const filters = screen.getByRole('region', { name: t('training_log.filters_label') });
    expect(goals.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: t('training_log.title') }).compareDocumentPosition(goals) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('links to all runs and to the fitness chart', async () => {
    renderPage();
    await ready();

    const links = screen.getByRole('navigation', { name: t('training_log.links_label') });
    expect(within(links).getByRole('link', { name: t('training_log.link_runs') })).toHaveAttribute('href', '/runs');
    expect(within(links).getByRole('link', { name: t('training_log.link_fitness') })).toHaveAttribute('href', '/analysis/load-balance#load-fitness');
  });

  it('keeps the fitness shortcut when the owning Runs page supplies the heading', async () => {
    render(<MemoryRouter initialEntries={['/runs#training-log']}><TrainingLog showHeader={false} /></MemoryRouter>);
    await screen.findAllByRole('article');
    expect(screen.queryByRole('heading', { name: t('training_log.title') })).not.toBeInTheDocument();
    const links = screen.getByRole('navigation', { name: t('training_log.links_label') });
    expect(within(links).getByRole('link', { name: t('training_log.link_fitness') })).toHaveAttribute('href', '/analysis/load-balance#load-fitness');
  });

  it('asks for twelve weeks ending today and nothing else to start with', async () => {
    renderPage();
    await ready();
    expect(logCalls()).toEqual(['/api/training/log?weeks=12']);
  });
});

describe('loading and failing', () => {
  it('shows a skeleton, busy and announced, until the first weeks arrive', async () => {
    let release;
    respond = () => new Promise((resolve) => { release = () => resolve(log()); });
    const { container } = renderPage();

    expect(container.querySelector('.training-log-v2')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('.training-log-v2__skeleton')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(t('training_log.loading'));
    expect(screen.queryByRole('article')).not.toBeInTheDocument();

    release();
    await ready();
    expect(container.querySelector('.training-log-v2__skeleton')).not.toBeInTheDocument();
    expect(container.querySelector('.training-log-v2')).not.toHaveAttribute('aria-busy');
  });

  it('says so, with a way to try again, when the log cannot be loaded', async () => {
    respond = () => new Error('boom');
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(t('training_log.error'));
    respond = () => log();
    await userEvent.click(screen.getByRole('button', { name: t('training_log.retry') }));

    await ready();
    expect(screen.queryByText(t('training_log.error'))).not.toBeInTheDocument();
  });

  it.each([
    ['no weeks', { id: 1 }],
    ['weeks that are not a list', { weeks: 'none', runTypes: [], tags: [], olderRuns: false }],
    ['no answer about older runs', { weeks: [], runTypes: [], tags: [] }],
  ])('treats an answer with %s as a failed load, not a half-drawn page', async (_name, answer) => {
    respond = () => answer;
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(t('training_log.error'));
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});

describe('the weeks', () => {
  it('lists the weeks newest first, each named by its dates, and marks the one going on', async () => {
    renderPage();
    await ready();

    const names = screen.getAllByRole('article').map((article) => article.querySelector('h2').textContent);
    expect(names[0]).toMatch(/^Oct\s5\s*[–-]\s*11This week$/u);
    expect(names[1]).toMatch(/^Sep\s28\s*[–-]\s*Oct\s4$/u);
    expect(names[2]).toMatch(/^Sep\s21\s*[–-]\s*27$/u);
    expect(screen.getAllByText(t('training_log.this_week'))).toHaveLength(1);
  });

  it('adds a week up: runs, distance, time, effort and climb', async () => {
    renderPage();
    await ready();

    const list = weekCard(/Oct\s5/u).querySelector('.training-log-v2__totals');
    expect(within(list).getAllByRole('definition').map((node) => node.textContent)).toEqual(['3', '18.0 km', '1 h 27 min', '153', '80 m']);
    const captions = within(list).getAllByRole('term').map((node) => node.textContent);
    expect(captions).toEqual([t('training_log.stat_runs'), t('training_log.stat_distance'), t('training_log.stat_time'), t('training_log.stat_effort'), t('training_log.stat_climb')]);
  });

  it('leaves out the climb of a week with none', async () => {
    renderPage();
    await ready();
    expect(within(weekCard(/Sep\s21/u).querySelector('.training-log-v2__totals')).queryByText(t('training_log.stat_climb'))).not.toBeInTheDocument();
  });

  it('writes the days of a week with their runs, earliest day first', async () => {
    const { container } = renderPage();
    await ready();

    const headings = [...weekCard(/Oct\s5/u).querySelectorAll('h3 time')];
    expect(headings.map((node) => node.textContent)).toEqual(['Mon, Oct 5', 'Sat, Oct 10']);
    expect(headings.map((node) => node.getAttribute('datetime'))).toEqual(['2026-10-05', '2026-10-10']);
    expect(container.querySelectorAll('.training-log-v2__run')).toHaveLength(4);
  });

  it('shows a week without a run as one quiet line, with no strip and no days', async () => {
    renderPage();
    await ready();

    const quiet = weekCard(/Sep\s28/u);
    expect(within(quiet).getByText(t('training_log.no_runs_week'))).toBeInTheDocument();
    expect(quiet.querySelector('.training-log-v2__strip')).not.toBeInTheDocument();
    expect(quiet.querySelector('.training-log-v2__days')).not.toBeInTheDocument();
  });

  it('draws a strip of seven days for a week with runs, hidden from a screen reader that has the lists', async () => {
    renderPage();
    await ready();

    const strip = weekCard(/Oct\s5/u).querySelector('.training-log-v2__strip');
    expect(strip).toHaveAttribute('aria-hidden', 'true');
    expect(strip.querySelectorAll('li')).toHaveLength(7);
    expect(strip.querySelectorAll('li.has-runs')).toHaveLength(2);
    // The longest day on the page (the 10 km race) is the full height; 8 km on the Monday is four fifths of it.
    const heights = [...strip.querySelectorAll('i')].map((bar) => bar.style.height);
    expect(heights[0]).toBe('80%');
    expect(heights[5]).toBe('100%');
    expect(heights[1]).toBe('0%');
  });
});

describe('a run', () => {
  it('links to the run and shows its distance, time, pace, effort and climb', async () => {
    renderPage();
    await ready();

    const row = screen.getByRole('link', { name: 'Morning jog' }).closest('li');
    expect(screen.getByRole('link', { name: 'Morning jog' })).toHaveAttribute('href', '/runs/11');
    expect(within(row).getAllByRole('definition').map((node) => node.textContent)).toEqual(['5.0 km', '25:00', '5:00 /km', '42', '–']);
    expect(within(row).getAllByRole('term').map((node) => node.textContent)).toEqual([
      t('training_log.stat_distance'), t('training_log.stat_time'), t('training_log.stat_pace'), t('training_log.stat_effort'), t('training_log.stat_climb'),
    ]);
  });

  it('shows the climb of a run that has some, and a dash for one that has none', async () => {
    renderPage();
    await ready();

    const race = screen.getByRole('link', { name: 'City 10K' }).closest('li');
    expect(within(race).getAllByRole('definition')[4]).toHaveTextContent('80 m');
    const jog = screen.getByRole('link', { name: 'Morning jog' }).closest('li');
    expect(within(jog).getAllByRole('definition')[4]).toHaveTextContent('–');
  });

  it('shows the type of a typed run and its tags, and nothing for a plain run', async () => {
    renderPage();
    await ready();

    const race = screen.getByRole('link', { name: 'City 10K' }).closest('li');
    expect(within(race).getByText(t('run_labels.type_RACE'))).toHaveClass('is-race');
    const tags = within(race).getByRole('list', { name: t('training_log.tags_label') });
    expect(within(tags).getAllByRole('button').map((button) => button.textContent)).toEqual(['10k', 'PR']);

    const plain = screen.getByRole('link', { name: 'Evening strides' }).closest('li');
    expect(plain.querySelector('.training-log-v2__type')).not.toBeInTheDocument();
    expect(within(plain).queryByRole('list', { name: t('training_log.tags_label') })).not.toBeInTheDocument();
  });

  it('shows a dash, with the reason on hover, for a run that has no effort yet', async () => {
    renderPage();
    await ready();

    const row = screen.getByRole('link', { name: 'Hill repeats' }).closest('li');
    const effort = within(row).getAllByRole('definition')[3];
    expect(effort).toHaveTextContent('–');
    expect(effort).toHaveAttribute('title', t('training_log.effort_none'));
  });

  it('calls a run with no name untitled, and a very long name stays one line with the whole name on hover', async () => {
    const long = 'A'.repeat(60);
    respond = () => log({ weeks: [week('2026-10-05', [day('2026-10-06', [run({ id: 21, name: '' }), run({ id: 22, name: long })])])] });
    renderPage();
    await ready();

    expect(screen.getByRole('link', { name: t('training_log.unnamed_run') })).toHaveAttribute('href', '/runs/21');
    expect(screen.getByRole('link', { name: long })).toHaveAttribute('title', long);
  });

  it('writes distances and paces in miles for a runner who counts in miles', async () => {
    state.unit = 'mile';
    renderPage();
    await ready();

    const row = screen.getByRole('link', { name: 'Morning jog' }).closest('li');
    expect(within(row).getAllByRole('definition').map((node) => node.textContent)).toEqual(['3.1 mi', '25:00', '8:03 /mi', '42', '–']);
    expect(within(weekCard(/Oct\s5/u).querySelector('.training-log-v2__totals')).getAllByRole('definition')[1]).toHaveTextContent('11.2 mi');
  });
});

describe('filtering', () => {
  it('offers all runs and the types the runner has used, with the tags they use most', async () => {
    renderPage();
    await ready();

    const types = screen.getByRole('group', { name: t('training_log.filter_type') });
    expect(within(types).getAllByRole('button').map((button) => button.textContent)).toEqual([
      t('training_log.filter_all'), t('run_labels.type_RACE'), t('run_labels.type_WORKOUT'),
    ]);
    expect(within(types).getByRole('button', { name: t('training_log.filter_all') })).toHaveAttribute('aria-pressed', 'true');

    const tags = screen.getByRole('group', { name: t('training_log.filter_tags') });
    expect(within(tags).getAllByRole('button').map((button) => button.textContent)).toEqual(['easy5', 'hills2', '10k1']);
    expect(within(tags).getAllByRole('button').every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('narrows the log to a type: asks the server, keeps the address, and presses the chip', async () => {
    respond = (url) => (url.includes('runType=RACE')
      ? log({ weeks: [week('2026-10-05', [day('2026-10-10', [run({ id: 13, name: 'City 10K', runType: 'RACE' })])]), week('2026-09-28', [])] })
      : log());
    renderPage();
    await ready();

    await userEvent.click(within(screen.getByRole('group', { name: t('training_log.filter_type') })).getByRole('button', { name: t('run_labels.type_RACE') }));

    await waitFor(() => expect(logCalls()).toContain('/api/training/log?weeks=12&runType=RACE'));
    expect(screen.getByTestId('where')).toHaveTextContent('/training-log?runType=RACE');
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Morning jog' })).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'City 10K' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: t('training_log.filter_type') })).getByRole('button', { name: t('run_labels.type_RACE') })).toHaveAttribute('aria-pressed', 'true');
    expect(within(weekCard(/Sep\s28/u)).getByText(t('training_log.no_matches_week'))).toBeInTheDocument();
  });

  it('keeps the earlier weeks on screen, marked busy, until the filtered ones arrive', async () => {
    renderPage();
    await ready();
    let release;
    respond = () => new Promise((resolve) => { release = () => resolve(log({ weeks: [week('2026-10-05', [])] })); });

    await userEvent.click(within(screen.getByRole('group', { name: t('training_log.filter_type') })).getByRole('button', { name: t('run_labels.type_RACE') }));

    expect(screen.getByRole('link', { name: 'Morning jog' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: t('training_log.filters_label') })).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelector('.training-log-v2__weeks')).toHaveAttribute('aria-busy', 'true');

    release();
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Morning jog' })).not.toBeInTheDocument());
    expect(screen.getByRole('region', { name: t('training_log.filters_label') })).not.toHaveAttribute('aria-busy');
  });

  it('narrows the log to a tag, and lets a second tag narrow it further, saying that a run must have both', async () => {
    renderPage();
    await ready();
    const tags = () => screen.getByRole('group', { name: t('training_log.filter_tags') });

    await userEvent.click(within(tags()).getByRole('button', { name: /^hills/ }));
    await waitFor(() => expect(logCalls()).toContain('/api/training/log?weeks=12&tag=hills'));
    expect(screen.queryByText(t('training_log.filter_tags_note'))).not.toBeInTheDocument();

    await userEvent.click(within(tags()).getByRole('button', { name: /^easy/ }));
    await waitFor(() => expect(logCalls()).toContain('/api/training/log?weeks=12&tag=hills&tag=easy'));
    expect(screen.getByTestId('where')).toHaveTextContent('/training-log?tag=hills&tag=easy');
    expect(screen.getByText(t('training_log.filter_tags_note'))).toBeInTheDocument();

    await userEvent.click(within(tags()).getByRole('button', { name: /^hills/ }));
    await waitFor(() => expect(logCalls()).toContain('/api/training/log?weeks=12&tag=easy'));
    expect(screen.getByTestId('where')).toHaveTextContent('/training-log?tag=easy');
  });

  it('filters by the tag of a run when that tag is pressed on the run, and again to take it off', async () => {
    renderPage();
    await ready();

    const race = screen.getByRole('link', { name: 'City 10K' }).closest('li');
    await userEvent.click(within(race).getByRole('button', { name: t('training_log.tag_filter', { tag: 'PR' }) }));

    await waitFor(() => expect(logCalls()).toContain('/api/training/log?weeks=12&tag=PR'));
    const pressed = within(screen.getByRole('link', { name: 'City 10K' }).closest('li')).getByRole('button', { name: t('training_log.tag_filter', { tag: 'PR' }) });
    expect(pressed).toHaveAttribute('aria-pressed', 'true');
    // A tag the runner has not used much is still on the chips, so that it can be taken off.
    expect(within(screen.getByRole('group', { name: t('training_log.filter_tags') })).getByRole('button', { name: 'PR' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(pressed);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/training-log$/u));
  });

  it('reads the filters from the address, ignores what it does not understand and clears them with one press', async () => {
    renderPage('/training-log?runType=RACE&tag=hills&tag=HILLS&tag=%20%20&runType=ULTRA');
    await ready();

    expect(logCalls()[0]).toBe('/api/training/log?weeks=12&runType=RACE&tag=hills');
    expect(within(screen.getByRole('group', { name: t('training_log.filter_type') })).getByRole('button', { name: t('run_labels.type_RACE') })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('group', { name: t('training_log.filter_tags') })).getByRole('button', { name: /^hills/ })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: t('training_log.clear_filters') }));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/training-log$/u));
    await waitFor(() => expect(logCalls().at(-1)).toBe('/api/training/log?weeks=12'));
    expect(screen.queryByRole('button', { name: t('training_log.clear_filters') })).not.toBeInTheDocument();
  });

  it('ignores a run type in the address that is not one of the three', async () => {
    renderPage('/training-log?runType=ULTRA');
    await ready();
    expect(logCalls()).toEqual(['/api/training/log?weeks=12']);
  });

  it('says how to get filters when the runner has used no type and no tag', async () => {
    respond = () => log({ runTypes: [], tags: [] });
    renderPage();
    await ready();

    expect(screen.getByText(t('training_log.filter_hint'))).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: t('training_log.filter_type') })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: t('training_log.filter_tags') })).not.toBeInTheDocument();
  });

  it('shows no clear button while nothing is filtered', async () => {
    renderPage();
    await ready();
    expect(screen.queryByRole('button', { name: t('training_log.clear_filters') })).not.toBeInTheDocument();
  });
});

describe('a long list of tags', () => {
  const manyTags = Array.from({ length: 12 }, (_, index) => ({ tag: `tag${index + 1}`, runs: 20 - index }));
  const group = () => screen.getByRole('group', { name: t('training_log.filter_tags') });

  it('shows the eight most used first, with a button for the rest', async () => {
    respond = () => log({ tags: manyTags });
    renderPage();
    await ready();

    const names = within(group()).getAllByRole('button').map((button) => button.textContent);
    expect(names).toEqual(['tag120', 'tag219', 'tag318', 'tag417', 'tag516', 'tag615', 'tag714', 'tag813', t('training_log.tags_all', { count: 12 })]);
    const more = within(group()).getByRole('button', { name: t('training_log.tags_all', { count: 12 }) });
    expect(more).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(more);
    expect(within(group()).getByText('tag12')).toBeInTheDocument();
    expect(within(group()).getByRole('button', { name: t('training_log.tags_fewer') })).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(within(group()).getByRole('button', { name: t('training_log.tags_fewer') }));
    expect(within(group()).queryByText('tag12')).not.toBeInTheDocument();
  });

  it('keeps a chosen tag in view even when it is one of the less used', async () => {
    respond = () => log({ tags: manyTags });
    renderPage('/training-log?tag=tag11');
    await ready();

    expect(within(group()).getByText('tag11').closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(within(group()).queryByText('tag10')).not.toBeInTheDocument();
  });

  it('has no button when the runner has eight tags or fewer', async () => {
    respond = () => log({ tags: manyTags.slice(0, 8) });
    renderPage();
    await ready();
    expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
  });
});

describe('weeks with nothing in a filtered log', () => {
  const sparse = () => [
    week('2026-10-05', [day('2026-10-10', [run({ id: 13, name: 'City 10K', runType: 'RACE' })])]),
    week('2026-09-28', []),
    week('2026-09-21', []),
    week('2026-09-14', []),
    week('2026-09-07', [day('2026-09-12', [run({ id: 14, name: 'Autumn 5K', runType: 'RACE' })])]),
    week('2026-08-31', []),
  ];

  it('folds a run of empty weeks into one line when a filter is on, with the dates and how many', async () => {
    respond = () => log({ weeks: sparse() });
    const { container } = renderPage('/training-log?runType=RACE');
    await ready();

    expect(screen.getAllByRole('article')).toHaveLength(3);
    const gap = container.querySelector('.training-log-v2__gap');
    expect(gap).toHaveTextContent(t('training_log.gap_weeks', { count: 3 }));
    expect(gap.querySelector('span').textContent).toMatch(/^Sep\s14\s*[–-]\s*Oct\s4$/u);
    // A single empty week is kept as it is.
    expect(within(screen.getAllByRole('article')[2]).getByText(t('training_log.no_matches_week'))).toBeInTheDocument();
  });

  it('gives each empty week its own line when nothing is filtered', async () => {
    respond = () => log({ weeks: sparse() });
    const { container } = renderPage();
    await ready();

    expect(screen.getAllByRole('article')).toHaveLength(6);
    expect(container.querySelector('.training-log-v2__gap')).not.toBeInTheDocument();
  });
});

describe('earlier weeks', () => {
  const older = () => log({ weeks: [week('2026-09-14', [day('2026-09-15', [run({ id: 31, name: 'September jog' })])]), week('2026-09-07', [])], olderRuns: false });

  it('offers them when there are earlier runs, asking for the weeks before the oldest one shown', async () => {
    respond = (url) => (url.includes('to=') ? older() : log());
    renderPage();
    await ready();

    await userEvent.click(screen.getByRole('button', { name: t('training_log.load_earlier') }));

    await waitFor(() => expect(logCalls()).toContain('/api/training/log?weeks=12&to=2026-09-20'));
    expect(await screen.findByRole('link', { name: 'September jog' })).toBeInTheDocument();
    const names = screen.getAllByRole('article').map((article) => article.querySelector('h2').textContent);
    expect(names).toHaveLength(5);
    expect(names[3]).toMatch(/^Sep\s14/u);
    // Nothing is before them, so the button gives way to a line saying so.
    expect(screen.queryByRole('button', { name: t('training_log.load_earlier') })).not.toBeInTheDocument();
    expect(screen.getByText(t('training_log.all_loaded'))).toBeInTheDocument();
  });

  it('carries the filters along', async () => {
    renderPage('/training-log?runType=RACE&tag=hills');
    await ready();
    respond = (url) => (url.includes('to=') ? older() : log());

    await userEvent.click(screen.getByRole('button', { name: t('training_log.load_earlier') }));

    await waitFor(() => expect(logCalls()).toContain('/api/training/log?weeks=12&to=2026-09-20&runType=RACE&tag=hills'));
    expect(await screen.findByText(t('training_log.all_loaded_filtered'))).toBeInTheDocument();
  });

  it('is disabled and says it is loading while the weeks come, and asks only once', async () => {
    renderPage();
    await ready();
    let release;
    respond = () => new Promise((resolve) => { release = () => resolve(older()); });

    const button = screen.getByRole('button', { name: t('training_log.load_earlier') });
    await userEvent.click(button);
    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(t('training_log.loading_earlier'));
    expect(logCalls().filter((url) => url.includes('to='))).toHaveLength(1);

    release();
    expect(await screen.findByRole('link', { name: 'September jog' })).toBeInTheDocument();
  });

  it('keeps the weeks it has, says so and lets the runner try again when earlier ones cannot be loaded', async () => {
    renderPage();
    await ready();
    respond = () => new Error('nope');

    await userEvent.click(screen.getByRole('button', { name: t('training_log.load_earlier') }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t('training_log.load_earlier_error'));
    expect(screen.getAllByRole('article')).toHaveLength(3);

    respond = () => older();
    await userEvent.click(screen.getByRole('button', { name: t('training_log.load_earlier') }));
    expect(await screen.findByRole('link', { name: 'September jog' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not add weeks that were asked for under filters that have been changed since', async () => {
    renderPage();
    await ready();
    let release;
    respond = () => new Promise((resolve) => { release = () => resolve(older()); });
    await userEvent.click(screen.getByRole('button', { name: t('training_log.load_earlier') }));

    respond = () => log({ weeks: [week('2026-10-05', [day('2026-10-10', [run({ id: 13, name: 'City 10K', runType: 'RACE' })])])], olderRuns: false });
    await userEvent.click(within(screen.getByRole('group', { name: t('training_log.filter_type') })).getByRole('button', { name: t('run_labels.type_RACE') }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Morning jog' })).not.toBeInTheDocument());
    release();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.queryByRole('link', { name: 'September jog' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('says there is nothing earlier, and does not offer a button, when the log reaches the first run', async () => {
    respond = () => log({ olderRuns: false });
    renderPage();
    await ready();

    expect(screen.queryByRole('button', { name: t('training_log.load_earlier') })).not.toBeInTheDocument();
    expect(screen.getByText(t('training_log.all_loaded'))).toBeInTheDocument();
  });

  it('moves the keyboard to the first of the weeks that came, since the button may be gone by then', async () => {
    respond = (url) => (url.includes('to=') ? older() : log());
    renderPage();
    await ready();

    await userEvent.click(screen.getByRole('button', { name: t('training_log.load_earlier') }));
    await screen.findByRole('link', { name: 'September jog' });

    expect(weekCard(/Sep\s14/u).querySelector('h2')).toHaveFocus();
  });

  it('leaves the keyboard on the button when the weeks could not be loaded', async () => {
    renderPage();
    await ready();
    respond = () => new Error('nope');

    const button = screen.getByRole('button', { name: t('training_log.load_earlier') });
    await userEvent.click(button);
    await screen.findByRole('alert');

    expect(button).toHaveFocus();
  });

  it('does not move the keyboard later on account of a request that failed', async () => {
    renderPage();
    await ready();
    respond = () => new Error('nope');
    await userEvent.click(screen.getByRole('button', { name: t('training_log.load_earlier') }));
    await screen.findByRole('alert');

    // Filtering brings in weeks older than the ones on screen were; the failed request must not claim the keyboard for them.
    respond = () => older();
    const chip = within(screen.getByRole('group', { name: t('training_log.filter_type') })).getByRole('button', { name: t('run_labels.type_RACE') });
    await userEvent.click(chip);
    await waitFor(() => expect(logCalls().at(-1)).toContain('runType=RACE'));
    await screen.findByRole('link', { name: 'September jog' });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(chip).toHaveFocus();
  });
});

describe('the metric the log looks at', () => {
  const group = () => screen.getByRole('group', { name: t('training_log.metric_label') });
  const chip = (metric) => within(group()).getByRole('button', { name: t(`training_log.metric_${metric}`) });
  const heights = (name) => [...weekCard(name).querySelectorAll('.training-log-v2__strip i')].map((bar) => bar.style.height);
  const dayTotals = (name) => [...weekCard(name).querySelectorAll('.training-log-v2__day-total')].map((node) => node.textContent);
  const weekCaptions = (name) => [...weekCard(name).querySelectorAll('.training-log-v2__totals > .is-chosen dt')].map((node) => node.textContent);

  it('offers distance, time, climb and effort, with distance chosen to begin with', async () => {
    renderPage();
    await ready();

    expect(within(group()).getAllByRole('button').map((button) => button.textContent)).toEqual(['Distance', 'Time', 'Climb', 'Effort']);
    expect(chip('distance')).toHaveAttribute('aria-pressed', 'true');
    for (const metric of ['time', 'climb', 'effort']) expect(chip(metric)).toHaveAttribute('aria-pressed', 'false');
  });

  it('writes each day with its total in distance to begin with, and marks the distance of the week and of each run', async () => {
    renderPage();
    await ready();

    expect(dayTotals(/Oct\s5/u)).toEqual(['8.0 km', '10.0 km']);
    expect(weekCaptions(/Oct\s5/u)).toEqual([t('training_log.stat_distance')]);
    const row = screen.getByRole('link', { name: 'Morning jog' }).closest('li');
    expect([...row.querySelectorAll('.is-chosen dt')].map((node) => node.textContent)).toEqual([t('training_log.stat_distance')]);
    expect(row.querySelector('.is-chosen dd')).toHaveTextContent('5.0 km');
  });

  it.each([
    ['time', ['41:40', '45:00'], ['93%', '0%', '0%', '0%', '0%', '100%', '0%'], 'Time'],
    ['climb', ['–', '80 m'], ['0%', '0%', '0%', '0%', '0%', '100%', '0%'], 'Climb'],
    ['effort', ['62', '90'], ['69%', '0%', '0%', '0%', '0%', '100%', '0%'], 'Effort'],
  ])('looks at %s: redraws the strip, rewrites the day totals, marks the figures and keeps it in the address, asking the server for nothing', async (metric, totals, bars, caption) => {
    renderPage();
    await ready();

    await userEvent.click(chip(metric));

    expect(chip(metric)).toHaveAttribute('aria-pressed', 'true');
    expect(chip('distance')).toHaveAttribute('aria-pressed', 'false');
    expect(heights(/Oct\s5/u)).toEqual(bars);
    expect(dayTotals(/Oct\s5/u)).toEqual(totals);
    expect(weekCaptions(/Oct\s5/u)).toEqual([caption]);
    expect(screen.getByTestId('where')).toHaveTextContent(`/training-log?metric=${metric}`);
    expect(logCalls()).toEqual(['/api/training/log?weeks=12']);
  });

  it('marks the figure of each run too', async () => {
    renderPage('/training-log?metric=climb');
    await ready();

    const race = screen.getByRole('link', { name: 'City 10K' }).closest('li');
    expect([...race.querySelectorAll('.is-chosen dt')].map((node) => node.textContent)).toEqual([t('training_log.stat_climb')]);
    expect(race.querySelector('.is-chosen dd')).toHaveTextContent('80 m');
  });

  it('draws against the biggest day of the metric over all the weeks on the page', async () => {
    renderPage('/training-log?metric=time');
    await ready();

    // 2,700 s on the Saturday is the most; Thursday the 24th (2,100 s) is seven ninths of it.
    expect(heights(/Sep\s21/u)).toEqual(['0%', '0%', '0%', '78%', '0%', '0%', '0%']);
  });

  it('tells the days apart on hover: the day and its total in the metric', async () => {
    renderPage();
    await ready();
    const titles = () => [...weekCard(/Oct\s5/u).querySelectorAll('.training-log-v2__strip li')].map((item) => item.getAttribute('title'));

    expect(titles()).toEqual(['Mon, Oct 5: 8.0 km', null, null, null, null, 'Sat, Oct 10: 10.0 km', null]);
    await userEvent.click(chip('time'));
    expect(titles()[0]).toBe('Mon, Oct 5: 41:40');
  });

  it('shows the climb of a week with none when climb is what the log looks at', async () => {
    renderPage('/training-log?metric=climb');
    await ready();

    const totals = weekCard(/Sep\s21/u).querySelector('.training-log-v2__totals');
    expect(within(totals).getByText(t('training_log.stat_climb'))).toBeInTheDocument();
    expect(within(totals).getAllByRole('definition').at(-1)).toHaveTextContent('0 m');
  });

  it('reads the metric from the address and ignores one it does not know', async () => {
    renderPage('/training-log?metric=effort');
    await ready();
    expect(chip('effort')).toHaveAttribute('aria-pressed', 'true');
    cleanup();

    renderPage('/training-log?metric=pace');
    await ready();
    expect(chip('distance')).toHaveAttribute('aria-pressed', 'true');
    expect(logCalls().every((url) => url === '/api/training/log?weeks=12')).toBe(true);
  });

  it('keeps the metric when the filters change and the filters when the metric changes', async () => {
    renderPage('/training-log?metric=time');
    await ready();

    await userEvent.click(within(screen.getByRole('group', { name: t('training_log.filter_type') })).getByRole('button', { name: t('run_labels.type_RACE') }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/training-log?runType=RACE&metric=time'));
    await userEvent.click(chip('effort'));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/training-log?runType=RACE&metric=effort'));
    await userEvent.click(screen.getByRole('button', { name: t('training_log.clear_filters') }));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/training-log\?metric=effort$/u));
  });

  it('goes back to distance with no metric in the address', async () => {
    renderPage('/training-log?metric=time');
    await ready();

    await userEvent.click(chip('distance'));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/training-log$/u));
  });

  it('speaks Chinese', async () => {
    state.lang = 'zh-CN';
    renderPage('/training-log?metric=time');
    await screen.findByRole('heading', { level: 2, name: '训练日志' });
    await screen.findAllByRole('article');

    expect(within(screen.getByRole('group', { name: '显示' })).getAllByRole('button').map((button) => button.textContent)).toEqual(['距离', '用时', '爬升', '强度']);
    expect(screen.getByRole('region', { name: '查看方式' })).toBeInTheDocument();
    expect(screen.getByLabelText('跳到某一天')).toBeInTheDocument();
    expect(screen.getAllByRole('article')[0].querySelector('.training-log-v2__day-total')).toHaveTextContent('41:40');
  });
});

describe('jumping to a date', () => {
  const field = () => screen.getByLabelText(t('training_log.jump_label'));
  const jumpedTo = (value) => fireEvent.change(field(), { target: { value } });
  const march = () => log({
    weeks: [week('2026-03-30', [day('2026-03-31', [run({ id: 51, name: 'March jog' })])]), week('2026-03-23', [])],
    olderRuns: true,
  });

  beforeEach(() => {
    respond = (url) => (url.includes('to=2026-03-31') ? march() : log());
  });

  it('is a date field from 1970 to the runner\'s today, with a line saying what it does', async () => {
    renderPage();
    await ready();

    expect(field()).toHaveAttribute('type', 'date');
    expect(field()).toHaveAttribute('min', '1970-01-01');
    expect(field()).toHaveAttribute('max', '2026-10-10');
    expect(field()).toHaveAccessibleDescription(t('training_log.jump_hint'));
    expect(field()).toHaveValue('');
    expect(screen.queryByRole('button', { name: t('training_log.jump_latest') })).not.toBeInTheDocument();
  });

  it('asks for the week of the chosen day and the weeks before it, and shows them', async () => {
    renderPage();
    await ready();

    jumpedTo('2026-03-31');

    await waitFor(() => expect(logCalls()).toContain('/api/training/log?weeks=12&to=2026-03-31'));
    expect(screen.getByTestId('where')).toHaveTextContent('/training-log?to=2026-03-31');
    expect(await screen.findByRole('link', { name: 'March jog' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Morning jog' })).not.toBeInTheDocument();
    expect(field()).toHaveValue('2026-03-31');
    expect(screen.getByRole('button', { name: t('training_log.jump_latest') })).toBeInTheDocument();
    const names = screen.getAllByRole('article').map((article) => article.querySelector('h2').textContent);
    expect(names[0]).toMatch(/^Mar\s30\s*[–-]\s*Apr\s5$/u);
    expect(screen.queryByText(t('training_log.this_week'))).not.toBeInTheDocument();
  });

  it('waits while a year is being typed: nothing is asked for until the date is a day', async () => {
    renderPage();
    await ready();

    for (const typed of ['0002-03-31', '0020-03-31', '0202-03-31']) jumpedTo(typed);
    expect(field()).toHaveValue('0202-03-31');
    expect(logCalls()).toEqual(['/api/training/log?weeks=12']);
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/training-log$/u);

    jumpedTo('2026-03-31');
    await waitFor(() => expect(logCalls()).toEqual(['/api/training/log?weeks=12', '/api/training/log?weeks=12&to=2026-03-31']));
  });

  it('does not jump to a day after today, nor when the field is cleared', async () => {
    renderPage();
    await ready();

    jumpedTo('2026-10-11');
    jumpedTo('2099-01-01');
    jumpedTo('');

    expect(logCalls()).toEqual(['/api/training/log?weeks=12']);
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/training-log$/u);
  });

  it('goes back to the latest weeks with one press, empties the field and puts the keyboard on it', async () => {
    renderPage();
    await ready();
    jumpedTo('2026-03-31');
    await screen.findByRole('link', { name: 'March jog' });

    await userEvent.click(screen.getByRole('button', { name: t('training_log.jump_latest') }));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/training-log$/u));
    expect(await screen.findByRole('link', { name: 'Morning jog' })).toBeInTheDocument();
    expect(field()).toHaveValue('');
    expect(field()).toHaveFocus();
    expect(screen.queryByRole('button', { name: t('training_log.jump_latest') })).not.toBeInTheDocument();
  });

  it('reads the day from the address and asks for it from the start', async () => {
    renderPage('/training-log?to=2026-03-31');

    expect(await screen.findByRole('link', { name: 'March jog' })).toBeInTheDocument();
    expect(logCalls()[0]).toBe('/api/training/log?weeks=12&to=2026-03-31');
    expect(field()).toHaveValue('2026-03-31');
  });

  it('ignores a day in the address that is no day', async () => {
    renderPage('/training-log?to=2026-02-30');
    await ready();

    expect(logCalls()).toEqual(['/api/training/log?weeks=12']);
    expect(field()).toHaveValue('');
  });

  it('keeps the filters when it jumps and the day when the filters change', async () => {
    renderPage('/training-log?runType=RACE');
    await ready();

    jumpedTo('2026-03-31');
    await waitFor(() => expect(logCalls()).toContain('/api/training/log?weeks=12&to=2026-03-31&runType=RACE'));
    expect(screen.getByTestId('where')).toHaveTextContent('/training-log?runType=RACE&to=2026-03-31');

    await userEvent.click(screen.getByRole('button', { name: t('training_log.clear_filters') }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/training-log\?to=2026-03-31$/u));
  });

  it('keeps the field as it is while the weeks come, and the old weeks on screen', async () => {
    renderPage();
    await ready();
    let release;
    respond = () => new Promise((resolve) => { release = () => resolve(march()); });

    jumpedTo('2026-03-31');

    expect(field()).toHaveValue('2026-03-31');
    expect(screen.getByRole('link', { name: 'Morning jog' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: t('training_log.view_label') })).toHaveAttribute('aria-busy', 'true');
    release();
    expect(await screen.findByRole('link', { name: 'March jog' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: t('training_log.view_label') })).not.toHaveAttribute('aria-busy');
  });

  it('shows neither the way back nor later weeks when the day is in the week going on', async () => {
    renderPage('/training-log?to=2026-10-08');
    await ready();

    expect(logCalls()[0]).toBe('/api/training/log?weeks=12&to=2026-10-08');
    expect(screen.queryByRole('button', { name: t('training_log.jump_latest') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('training_log.load_later') })).not.toBeInTheDocument();
  });

  it('is kept out of the way when the runner has no runs at all', async () => {
    respond = () => log({ weeks: emptyWeeks(), olderRuns: false, runTypes: [], tags: [] });
    renderPage();

    await screen.findByRole('heading', { level: 2, name: t('training_log.empty_title') });
    expect(screen.queryByRole('region', { name: t('training_log.view_label') })).not.toBeInTheDocument();
  });
});

describe('later weeks after a jump', () => {
  const march = () => log({
    weeks: [week('2026-03-30', [day('2026-03-31', [run({ id: 51, name: 'March jog' })])]), week('2026-03-23', [])],
    olderRuns: true,
  });
  const aprilToJune = () => log({
    weeks: [...emptyWeeks('2026-06-22', 11), week('2026-04-06', [day('2026-04-07', [run({ id: 52, name: 'April jog' })])])],
    olderRuns: true,
  });
  const button = () => screen.getByRole('button', { name: t('training_log.load_later') });

  beforeEach(() => {
    respond = (url) => {
      if (url.includes('to=2026-06-28')) return aprilToJune();
      if (url.includes('to=2026-03-31')) return march();
      return log();
    };
  });

  it('are offered above the weeks when the weeks stop short of today, and not otherwise', async () => {
    renderPage();
    await ready();
    expect(screen.queryByRole('button', { name: t('training_log.load_later') })).not.toBeInTheDocument();
    cleanup();

    renderPage('/training-log?to=2026-03-31');
    await screen.findByRole('link', { name: 'March jog' });
    expect(button().compareDocumentPosition(screen.getAllByRole('article')[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('asks for the weeks a page further on than the newest one, puts them above, and keeps the button while today is not reached', async () => {
    renderPage('/training-log?to=2026-03-31');
    await screen.findByRole('link', { name: 'March jog' });

    await userEvent.click(button());

    expect(await screen.findByRole('link', { name: 'April jog' })).toBeInTheDocument();
    expect(logCalls()).toContain('/api/training/log?weeks=12&to=2026-06-28');
    const names = screen.getAllByRole('article').map((article) => article.querySelector('h2').textContent);
    expect(names).toHaveLength(14);
    expect(names[0]).toMatch(/^Jun\s22\s*[–-]\s*28$/u);
    expect(names[11]).toMatch(/^Apr\s6\s*[–-]\s*12$/u);
    expect(names[12]).toMatch(/^Mar\s30/u);
    expect(button()).toBeEnabled();
  });

  it('asks for today when a page further on would pass it, and the button goes once today is reached', async () => {
    respond = (url) => (url.includes('to=2026-10-10')
      ? log({ weeks: emptyWeeks('2026-10-05', 12), olderRuns: true })
      : log({ weeks: [week('2026-08-31', [day('2026-09-01', [run({ id: 61, name: 'September jog' })])]), week('2026-08-24', [])], olderRuns: true }));
    renderPage('/training-log?to=2026-09-01');
    await screen.findByRole('link', { name: 'September jog' });

    await userEvent.click(button());

    await waitFor(() => expect(logCalls()).toContain('/api/training/log?weeks=12&to=2026-10-10'));
    await waitFor(() => expect(screen.queryByRole('button', { name: t('training_log.load_later') })).not.toBeInTheDocument());
    const names = screen.getAllByRole('article').map((article) => article.querySelector('h2').textContent);
    // The five weeks after the one jumped to, each once, then the two it had.
    expect(names).toHaveLength(7);
    expect(names[0]).toMatch(/^Oct\s5\s*[–-]\s*11This week$/u);
    expect(names[4]).toMatch(/^Sep\s7/u);
    expect(names[5]).toMatch(/^Aug\s31/u);
  });

  it('still has the way back once later weeks have reached today, since the log was started from a past day', async () => {
    respond = (url) => (url.includes('to=2026-10-10')
      ? log({ weeks: emptyWeeks('2026-10-05', 12), olderRuns: true })
      : log({ weeks: [week('2026-08-31', [day('2026-09-01', [run({ id: 61, name: 'September jog' })])]), week('2026-08-24', [])], olderRuns: true }));
    renderPage('/training-log?to=2026-09-01');
    await screen.findByRole('link', { name: 'September jog' });
    await userEvent.click(button());
    await waitFor(() => expect(screen.queryByRole('button', { name: t('training_log.load_later') })).not.toBeInTheDocument());

    expect(screen.getByRole('button', { name: t('training_log.jump_latest') })).toBeInTheDocument();
    expect(screen.getByLabelText(t('training_log.jump_label'))).toHaveValue('2026-09-01');

    await userEvent.click(screen.getByRole('button', { name: t('training_log.jump_latest') }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/training-log$/u));
    expect(screen.queryByRole('button', { name: t('training_log.jump_latest') })).not.toBeInTheDocument();
    expect(screen.getByLabelText(t('training_log.jump_label'))).toHaveValue('');
  });

  it('is disabled and says it is loading while the weeks come, and asks only once', async () => {
    renderPage('/training-log?to=2026-03-31');
    await screen.findByRole('link', { name: 'March jog' });
    let release;
    respond = () => new Promise((resolve) => { release = () => resolve(aprilToJune()); });

    const pressed = button();
    await userEvent.click(pressed);
    await userEvent.click(pressed);

    expect(pressed).toBeDisabled();
    expect(pressed).toHaveTextContent(t('training_log.loading_later'));
    expect(logCalls().filter((url) => url.includes('to=2026-06-28'))).toHaveLength(1);
    release();
    expect(await screen.findByRole('link', { name: 'April jog' })).toBeInTheDocument();
  });

  it('moves the keyboard to the newest of the weeks that came', async () => {
    renderPage('/training-log?to=2026-03-31');
    await screen.findByRole('link', { name: 'March jog' });

    await userEvent.click(button());
    await screen.findByRole('link', { name: 'April jog' });

    expect(screen.getAllByRole('article')[0].querySelector('h2')).toHaveFocus();
  });

  it('says so, keeps the weeks and lets the runner try again when later weeks cannot be loaded', async () => {
    renderPage('/training-log?to=2026-03-31');
    await screen.findByRole('link', { name: 'March jog' });
    respond = () => new Error('nope');

    await userEvent.click(button());

    expect(await screen.findByRole('alert')).toHaveTextContent(t('training_log.load_later_error'));
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(button()).toHaveFocus();

    respond = () => aprilToJune();
    await userEvent.click(button());
    expect(await screen.findByRole('link', { name: 'April jog' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not move the keyboard later on account of a request that failed', async () => {
    renderPage('/training-log?to=2026-03-31');
    await screen.findByRole('link', { name: 'March jog' });
    respond = () => new Error('nope');
    await userEvent.click(button());
    await screen.findByRole('alert');

    respond = () => march();
    const chip = within(screen.getByRole('group', { name: t('training_log.filter_type') })).getByRole('button', { name: t('run_labels.type_RACE') });
    await userEvent.click(chip);
    await waitFor(() => expect(logCalls().at(-1)).toContain('runType=RACE'));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(chip).toHaveFocus();
  });

  it('carries the filters along', async () => {
    renderPage('/training-log?runType=RACE&to=2026-03-31');
    await screen.findByRole('link', { name: 'March jog' });

    await userEvent.click(button());

    await waitFor(() => expect(logCalls()).toContain('/api/training/log?weeks=12&to=2026-06-28&runType=RACE'));
  });

  it('does not add weeks that were asked for under another day', async () => {
    renderPage('/training-log?to=2026-03-31');
    await screen.findByRole('link', { name: 'March jog' });
    let release;
    respond = () => new Promise((resolve) => { release = () => resolve(aprilToJune()); });
    await userEvent.click(button());

    respond = () => log({ weeks: [week('2026-02-23', [day('2026-02-24', [run({ id: 71, name: 'February jog' })])])], olderRuns: false });
    fireEvent.change(screen.getByLabelText(t('training_log.jump_label')), { target: { value: '2026-02-28' } });
    await screen.findByRole('link', { name: 'February jog' });
    release();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.queryByRole('link', { name: 'April jog' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });
});

describe('when there is nothing to show', () => {
  it('invites a runner with no runs at all to import some', async () => {
    respond = () => log({ weeks: emptyWeeks(), olderRuns: false, runTypes: [], tags: [] });
    renderPage();

    expect(await screen.findByRole('heading', { level: 2, name: t('training_log.empty_title') })).toBeInTheDocument();
    expect(screen.getByText(t('training_log.empty_body'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('training_log.empty_action') })).toHaveAttribute('href', '/settings/import-data');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    // Nothing to narrow down yet, so no filters either.
    expect(screen.queryByRole('region', { name: t('training_log.filters_label') })).not.toBeInTheDocument();
  });

  it('says no run matches, with a way out, when the filters leave nothing at all', async () => {
    respond = () => log({ weeks: emptyWeeks(), olderRuns: false });
    renderPage('/training-log?tag=hills');

    expect(await screen.findByRole('heading', { level: 2, name: t('training_log.empty_filtered_title') })).toBeInTheDocument();
    expect(screen.getByText(t('training_log.empty_filtered_body'))).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: t('training_log.clear_filters') }).at(-1));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/training-log$/u));
  });

  it('shows the quiet weeks and says the earlier runs are further back when only the recent weeks are empty', async () => {
    respond = () => log({ weeks: emptyWeeks(), olderRuns: true });
    renderPage();
    await ready();

    expect(screen.getByText(t('training_log.empty_recent_body'))).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(12);
    expect(screen.getByRole('button', { name: t('training_log.load_earlier') })).toBeInTheDocument();
  });

  describe('after a jump to a day before the first run', () => {
    const before = () => log({ weeks: emptyWeeks('2026-03-02', 12), olderRuns: false });

    it('says there is nothing in those weeks or before them, keeps the way forward and does not call it the first run', async () => {
      respond = (url) => (url.includes('to=') ? before() : log());
      renderPage('/training-log?to=2026-03-04');
      await ready();

      expect(screen.getByText(t('training_log.empty_window_body'))).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 2, name: t('training_log.empty_title') })).not.toBeInTheDocument();
      expect(screen.queryByText(t('training_log.all_loaded'))).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: t('training_log.load_later') })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: t('training_log.jump_latest') })).toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(12);
      expect(screen.getByRole('region', { name: t('training_log.view_label') })).toBeInTheDocument();
    });

    it('says so for the filters when they are on', async () => {
      respond = (url) => (url.includes('to=') ? before() : log());
      renderPage('/training-log?runType=RACE&to=2026-03-04');

      // With a filter on, twelve empty weeks in a row are one line, so there is no week to wait for.
      expect(await screen.findByText(t('training_log.empty_window_filtered'))).toBeInTheDocument();
      expect(screen.queryByText(t('training_log.all_loaded_filtered'))).not.toBeInTheDocument();
      expect(document.querySelector('.training-log-v2__gap')).toHaveTextContent(t('training_log.gap_weeks', { count: 12 }));
    });

    it('says the earlier runs are further back when there are some', async () => {
      respond = (url) => (url.includes('to=') ? log({ weeks: emptyWeeks('2026-03-02', 12), olderRuns: true }) : log());
      renderPage('/training-log?to=2026-03-04');
      await ready();

      expect(screen.getByText(t('training_log.empty_recent_body'))).toBeInTheDocument();
      expect(screen.getByRole('button', { name: t('training_log.load_earlier') })).toBeInTheDocument();
    });
  });
});

describe('what it tells the runner about the numbers', () => {
  it('says weeks run Monday to Sunday in the runner\'s time zone, naming UTC for a runner with none set', async () => {
    renderPage();
    await ready();
    expect(screen.getByText(t('training_log.basis', { zone: 'UTC' }))).toBeInTheDocument();
    cleanup();

    respond = () => log({ timeZone: 'Pacific/Auckland' });
    renderPage();
    await ready();
    expect(screen.getByText(t('training_log.basis', { zone: 'Pacific/Auckland' }))).toBeInTheDocument();
  });
});

describe('in Chinese', () => {
  it('speaks Chinese everywhere, with the dates and the figures in the same places', async () => {
    state.lang = 'zh-CN';
    renderPage();
    await screen.findByRole('heading', { level: 2, name: '训练日志' });
    await screen.findAllByRole('article');

    expect(screen.getByRole('link', { name: '全部跑步' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: '跑步类型' })).getByRole('button', { name: '比赛' })).toBeInTheDocument();
    expect(screen.getByText('本周')).toBeInTheDocument();
    expect(screen.getByText('这一周没有跑步。')).toBeInTheDocument();
    const totals = within(screen.getAllByRole('article')[0].querySelector('.training-log-v2__totals')).getAllByRole('definition').map((node) => node.textContent);
    expect(totals).toEqual(['3', '18.0 公里', '1 小时 27 分', '153', '80 m']);
    expect(screen.getByRole('button', { name: '加载更早的几周' })).toBeInTheDocument();
  });
});

describe('the fixtures', () => {
  it('add a week up the way the server does', () => {
    const weeks = threeWeeks();
    expect(weeks[0]).toMatchObject({ runs: 3, distanceKm: 18, movingSeconds: 5200, effort: 152.6, elevationGainM: 80 });
    expect(weeks[1]).toMatchObject({ runs: 0, distanceKm: 0 });
  });
});
