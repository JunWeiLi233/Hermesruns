import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
  await screen.findByRole('heading', { level: 1, name: t('training_log.title') });
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

    const chrome = screen.getByTestId('chrome');
    expect(chrome).toHaveAttribute('data-title', t('training_log.title'));
    expect(chrome).toHaveAttribute('data-parent-label', t('profile.dashboard_nav_activities'));
    expect(chrome).toHaveAttribute('data-parent-route', '/runs');
    expect(chrome).toHaveAttribute('data-active-key', 'activities');
    expect(chrome).toHaveClass('training-log-page');
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('puts the goals card between the heading and the filters', async () => {
    renderPage();
    await ready();

    const goals = screen.getByTestId('goals-card');
    const filters = screen.getByRole('region', { name: t('training_log.filters_label') });
    expect(goals.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).compareDocumentPosition(goals) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('links to all runs and to the fitness chart', async () => {
    renderPage();
    await ready();

    const links = screen.getByRole('navigation', { name: t('training_log.links_label') });
    expect(within(links).getByRole('link', { name: t('training_log.link_runs') })).toHaveAttribute('href', '/runs');
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
    expect(within(weekCard(/Sep\s21/u)).queryByText(t('training_log.stat_climb'))).not.toBeInTheDocument();
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
  it('links to the run and shows its distance, time, pace and effort', async () => {
    renderPage();
    await ready();

    const row = screen.getByRole('link', { name: 'Morning jog' }).closest('li');
    expect(screen.getByRole('link', { name: 'Morning jog' })).toHaveAttribute('href', '/runs/11');
    expect(within(row).getAllByRole('definition').map((node) => node.textContent)).toEqual(['5.0 km', '25:00', '5:00 /km', '42']);
    expect(within(row).getAllByRole('term').map((node) => node.textContent)).toEqual([
      t('training_log.stat_distance'), t('training_log.stat_time'), t('training_log.stat_pace'), t('training_log.stat_effort'),
    ]);
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
    expect(within(row).getAllByRole('definition').map((node) => node.textContent)).toEqual(['3.1 mi', '25:00', '8:03 /mi', '42']);
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
    await screen.findByRole('heading', { level: 1, name: '训练日志' });
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
