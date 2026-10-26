import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedApiJson } from '../../../api/resourceCache';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { methodsDocUrl } from '../../../utils/methodsDoc';
import Vo2maxEstimates from '../Vo2maxEstimates';
import { LONG_HISTORY_RUNS, NOW, ancientRuns, lonelyRaces, longHistory, longHistorySeconds, manyRuns, mixedRuns, oldRaceRuns, oldRuns, racesRuns, shortRuns } from './vdotEvidenceFixtures';

const state = vi.hoisted(() => ({ lang: 'en', unit: 'km' }));
const t = (key, params = {}) => {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};

// The page has more than one table (the runs, the races, the years): the runs are the one with this name.
const RUNS_TABLE = /^Runs of the last 90 days with an estimate, highest first$/;
const ZH_RUNS_TABLE = /^最近 90 天内有估算值的跑步，从高到低$/;
const RUNS_CHART = /^A dot for each run of the last 90 days/;

vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    lang: state.lang,
    t,
    formatNumber: (value, options) => new Intl.NumberFormat(state.lang === 'zh-CN' ? 'zh-CN' : 'en-US', options).format(value),
  }),
}));
vi.mock('../../../contexts/UnitContext', () => ({
  useUnit: () => ({ unit: state.unit, isMile: state.unit === 'mile' }),
}));
vi.mock('../../../components/AuthenticatedPageChrome', () => ({
  default: ({ children, title, parentLabel, parentRoute, activeKey, bodyClassName }) => (
    <div data-testid="chrome" className={bodyClassName} data-title={title} data-parent-label={parentLabel} data-parent-route={parentRoute} data-active-key={activeKey}>
      {children}
    </div>
  ),
}));

let served;

function renderPage() {
  return render(<MemoryRouter initialEntries={['/analysis']}><Vo2maxEstimates /></MemoryRouter>);
}

async function ready() {
  await screen.findByRole('heading', { level: 2, name: t('vo2max_estimates.title') });
  await screen.findByRole('table', { name: RUNS_TABLE });
}

const bodyRows = () => within(screen.getByRole('table', { name: RUNS_TABLE })).getAllByRole('row').slice(1);

describe('compact evidence on Analysis', () => {
  it('starts with six real estimates and lets the runner expand and collapse the full list', async () => {
    render(<MemoryRouter><Vo2maxEstimates runs={manyRuns()} showHeader={false} compact /></MemoryRouter>);
    expect(bodyRows()).toHaveLength(6);
    const button = screen.getByRole('button', { name: 'Show all 24 runs' });
    await userEvent.click(button);
    expect(bodyRows()).toHaveLength(24);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(button);
    expect(bodyRows()).toHaveLength(6);
    expect(cachedApiJson).not.toHaveBeenCalled();
  });

  it('keeps race evidence above the run table and history accessible on demand', async () => {
    const { container } = render(<MemoryRouter><Vo2maxEstimates runs={racesRuns()} showHeader={false} compact /></MemoryRouter>);
    const races = container.querySelector('.vo2max-estimates-v2__race-evidence');
    const table = screen.getByRole('table', { name: RUNS_TABLE });
    expect(races.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(races.open).toBe(false);
    await userEvent.click(within(races).getByText('Against your races'));
    expect(screen.getByRole('table', { name: t('vo2max_estimates.races_table_label') })).toBeVisible();
    const history = container.querySelector('.vo2max-estimates-v2__history-disclosure');
    expect(history.open).toBe(false);
    await userEvent.click(history.querySelector('summary'));
    expect(await screen.findByRole('group', { name: t('vo2max_estimates.history_ranges_label') })).toBeVisible();
  });

  it('translates the compact controls into Chinese', async () => {
    state.lang = 'zh-CN';
    render(<MemoryRouter><Vo2maxEstimates runs={manyRuns()} showHeader={false} compact /></MemoryRouter>);
    expect(screen.getByRole('button', { name: '显示全部 24 次跑步' })).toBeVisible();
    expect(screen.getByText('与你的比赛对照')).toBeVisible();
  });
});

beforeEach(() => {
  state.lang = 'en';
  state.unit = 'km';
  served = mixedRuns();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  cachedApiJson.mockReset();
  cachedApiJson.mockImplementation(async () => {
    if (served instanceof Error) throw served;
    return served;
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('loading and failing', () => {
  it('is busy with a skeleton until the runs are there, asks for the runs Analysis uses, and sits under Analysis', async () => {
    const { container } = renderPage();
    expect(container.querySelector('.vo2max-estimates-v2')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(t('vo2max_estimates.loading'));
    expect(container.querySelector('.page-skeleton__block')).toBeInTheDocument();

    await ready();
    expect(container.querySelector('.vo2max-estimates-v2')).not.toHaveAttribute('aria-busy');
    expect(cachedApiJson).toHaveBeenCalledTimes(1);
    expect(cachedApiJson.mock.calls[0][0]).toBe('/api/activities/analysis');
    expect(screen.queryByTestId('chrome')).not.toBeInTheDocument();
    expect(container.querySelector('h1')).not.toBeInTheDocument();
  });

  it('says so, with a way to try again, when the runs cannot be loaded', async () => {
    served = new Error('down');
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(t('vo2max_estimates.error'));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    served = mixedRuns();
    await userEvent.click(screen.getByRole('button', { name: t('vo2max_estimates.retry') }));
    await ready();
    expect(cachedApiJson).toHaveBeenCalledTimes(2);
  });

  it('treats an answer that is not a list as a failed load, not as a runner with no runs', async () => {
    served = { error: 'nope' };
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(t('vo2max_estimates.error'));
  });

  it('says what a run needs when none of the window gives an estimate, and points to the runs', async () => {
    served = oldRuns();
    renderPage();
    expect(await screen.findByRole('heading', { level: 2, name: t('vo2max_estimates.empty_title') })).toBeInTheDocument();
    expect(screen.getByText(/last 90 days, and none of them gives an estimate/)).toBeInTheDocument();
    expect(screen.getByText(/at least 1\.5 km/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('vo2max_estimates.empty_action') })).toHaveAttribute('href', '/runs');
    expect(screen.queryByRole('table', { name: RUNS_TABLE })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: RUNS_CHART })).not.toBeInTheDocument();
  });

  it('says the same for a runner with no runs at all', async () => {
    served = [];
    renderPage();
    expect(await screen.findByRole('heading', { level: 2, name: t('vo2max_estimates.empty_title') })).toBeInTheDocument();
  });
});

describe('the number and what it is made of', () => {
  it('shows the VO2max, how many runs there are behind it and the highest heart rate the estimates are scaled by', async () => {
    renderPage();
    await ready();
    const tiles = screen.getByRole('region', { name: t('vo2max_estimates.tiles_label') });

    expect(within(tiles).getByText('Current VO2max').closest('article')).toHaveTextContent('45.5');
    expect(within(tiles).getByText('The mean of the best 3 of 5 runs of 3 km or more.')).toBeInTheDocument();
    expect(within(tiles).getByText('Runs with an estimate').closest('article')).toHaveTextContent('6');
    expect(within(tiles).getByText('5 from heart rate, 1 from the race equation.')).toBeInTheDocument();
    expect(within(tiles).getByText('Highest heart rate on record').closest('article')).toHaveTextContent('190 bpm');
    expect(within(tiles).getByText(/one wrong peak raises them all/)).toBeInTheDocument();
  });

  it('says there is no highest heart rate when no run has a peak, and that every estimate is from the race equation', async () => {
    served = mixedRuns().map((run) => ({ ...run, maxHeartRate: null }));
    renderPage();
    await ready();

    expect(screen.getByText('Highest heart rate on record').closest('article')).toHaveTextContent('None');
    expect(screen.getByText(/every estimate comes from the race equation/)).toBeInTheDocument();
    expect(screen.getByText('0 from heart rate, 6 from the race equation.')).toBeInTheDocument();
  });

  it('says every run is in the pool when none is 3 km long, and when there is only one', async () => {
    served = shortRuns();
    renderPage();
    await ready();
    expect(screen.getByText(/None is 3 km or longer, so every run is in the pool/)).toBeInTheDocument();

    cleanup();
    served = shortRuns().slice(0, 1);
    renderPage();
    await ready();
    expect(screen.getByText('There is one run in the pool, so its estimate is the number.')).toBeInTheDocument();
    expect(screen.getByText('The one estimate is 45.61, shown as 45.6.')).toBeInTheDocument();
  });
});

describe('the table', () => {
  it('lists every run of the window that has an estimate, the highest first, with how each estimate was made', async () => {
    renderPage();
    await ready();
    const rows = bodyRows();

    expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual([
      'Hill repeats', 'Tempo on the canal', 'Strides', 'Park 5K', 'Easy six', 'Long steady run',
    ]);
    const tempo = within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent);
    expect(within(rows[1]).getByRole('rowheader')).toHaveTextContent('Oct 11, 2026');
    expect(tempo[1]).toBe('10.0 km');
    expect(tempo[2]).toBe('5:00 /km');
    expect(tempo[3]).toBe('150 bpm · 79% of highest');
    expect(tempo[4]).toBe('Heart rate');
    expect(tempo[5]).toContain('45.61');
    const park = within(rows[3]).getAllByRole('cell').map((cell) => cell.textContent);
    expect(park[2]).toBe('4:24 /km');
    expect(park[3]).toBe('–');
    expect(park[4]).toBe('Race equation');
    expect(park[5]).toContain('44.54');
  });

  it('leaves out the old run and the slow one, which the note below the table accounts for', async () => {
    renderPage();
    await ready();

    expect(screen.queryByText('Old tempo')).not.toBeInTheDocument();
    expect(screen.queryByText('Recovery jog')).not.toBeInTheDocument();
    expect(screen.getByText(/1 of your runs in these 90 days got no estimate/)).toBeInTheDocument();
    expect(screen.getByText(/18% slower than your median pace \(5:00 \/km\), that is slower than 5:54 \/km/)).toBeInTheDocument();
  });

  it('marks the three runs the number is the mean of, and the run outside the pool as not used', async () => {
    renderPage();
    await ready();
    const rows = bodyRows();
    const counted = rows.filter((row) => within(row).queryByText('Counted'));

    expect(counted.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(['Hill repeats', 'Tempo on the canal', 'Park 5K']);
    expect(within(rows[2]).getByText('Under 3 km, not used')).toBeInTheDocument();
    expect(within(rows[2]).queryByText('Counted')).not.toBeInTheDocument();
    expect(rows[0]).toHaveClass('is-counted');
    expect(rows[2]).toHaveClass('is-outside');
    expect(rows[4]).not.toHaveClass('is-counted');
  });

  it('links each run to its page, and every link is reachable by keyboard', async () => {
    renderPage();
    await ready();
    const link = screen.getByRole('link', { name: 'Hill repeats' });

    expect(link).toHaveAttribute('href', '/runs/3');
    link.focus();
    expect(link).toHaveFocus();
    expect(within(screen.getByRole('table', { name: RUNS_TABLE })).getAllByRole('link')).toHaveLength(6);
  });

  it('has no weather-adjusted column unless a run was adjusted, and then shows it', async () => {
    renderPage();
    await ready();
    expect(screen.queryByRole('columnheader', { name: t('vo2max_estimates.col_adjusted') })).not.toBeInTheDocument();

    cleanup();
    served = manyRuns();
    renderPage();
    await ready();
    expect(screen.getByRole('columnheader', { name: t('vo2max_estimates.col_adjusted') })).toBeInTheDocument();
  });

  it('keeps a name far too long for a row in the row, as a link with its whole text', async () => {
    served = manyRuns();
    renderPage();
    await ready();

    expect(screen.getByRole('link', { name: /An early morning progression run along the river/ })).toBeInTheDocument();
    expect(bodyRows().length).toBeGreaterThan(15);
  });
});

describe('the working', () => {
  it('shows the sum behind the number, so it can be checked by hand', async () => {
    renderPage();
    await ready();

    expect(screen.getByText('(46.23 + 45.61 + 44.54) ÷ 3 = 45.46, shown as 45.5.')).toBeInTheDocument();
  });

  it('says what the number would be without the best run', async () => {
    renderPage();
    await ready();

    expect(screen.getByText(/would be 44\.7, 0\.7 lower: the next run in line takes its place/)).toBeInTheDocument();
  });

  it('says how the estimates are taken, with a link to the rule', async () => {
    renderPage();
    await ready();
    const basis = screen.getByText(/Estimates are taken from the last 90 days/);

    expect(basis).toHaveTextContent('When any run is 3 km or longer, only runs that long are in the pool; otherwise every run of 1.5 km or more is.');
    expect(basis).toHaveTextContent('The number is the mean of the best 3 in the pool.');
    expect(within(basis).getByRole('link', { name: t('methods.link') })).toHaveAttribute('href', methodsDocUrl('vdot-and-vo2max'));
  });
});

describe('the chart', () => {
  it('draws a dot for each run, the number as a line, and says what it shows in words', async () => {
    const { container } = renderPage();
    await ready();
    const chart = screen.getByRole('img', { name: RUNS_CHART });

    expect(chart).toHaveAccessibleName(/A dot for each run of the last 90 days/);
    expect(container.querySelectorAll('.vo2max-estimates-v2__dot')).toHaveLength(6);
    expect(container.querySelectorAll('.vo2max-estimates-v2__dot.is-counted')).toHaveLength(3);
    expect(container.querySelectorAll('.vo2max-estimates-v2__dot.is-short')).toHaveLength(1);
    expect(container.querySelectorAll('.vo2max-estimates-v2__dot.is-other')).toHaveLength(2);
    expect(container.querySelector('.vo2max-estimates-v2__mean')).toBeInTheDocument();
    expect(within(chart).getByText('VO2max 45.5')).toBeInTheDocument();
    expect(container.querySelector('.vo2max-estimates-v2__dot.is-counted title')).toHaveTextContent(/Hill repeats|Tempo on the canal|Park 5K/);
  });

  it('names the three kinds of dot and the line in the legend, and the outside-the-pool one only when there is one', async () => {
    const { container } = renderPage();
    await ready();
    const legend = container.querySelector('.vo2max-estimates-v2__legend');

    expect(legend).toHaveTextContent('In your VO2max');
    expect(legend).toHaveTextContent('Not used');
    expect(legend).toHaveTextContent('Outside the pool');
    expect(legend).toHaveTextContent('Your VO2max');

    cleanup();
    served = shortRuns();
    const second = renderPage();
    await ready();
    expect(second.container.querySelector('.vo2max-estimates-v2__legend')).not.toHaveTextContent('Outside the pool');
  });
});

// Daniels and Gilbert's equations, written out again here, for the numbers the races table should show.
const cost = (velocity) => -4.6 + 0.182258 * velocity + 0.000104 * velocity * velocity;
const fraction = (minutes) => 0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes);
const vdotOf = (meters, minutes) => cost(meters / minutes) / fraction(minutes);
const round1 = (value) => Math.round(value * 10) / 10;
const signed = (value) => (value === 0 ? '0.0' : `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}`);

describe('your races against the number', () => {
  const racesHeading = () => screen.findByRole('heading', { level: 2, name: t('vo2max_estimates.races_title') });
  const racesTable = () => screen.getByRole('table', { name: t('vo2max_estimates.races_table_label') });
  const racesRows = () => within(racesTable()).getAllByRole('row').slice(1);
  const cells = (row) => within(row).getAllByRole('cell').map((cell) => cell.textContent);

  // What the table should say, from the equations: the three easy runs are 38.3; the 10K is set against that; the 5K against
  // the mean of the 10K and two of the easy runs.
  const easy = round1(vdotOf(5000, 25));
  const tenK = round1(vdotOf(10000, 45));
  const tenKGap = round1(tenK - easy);
  const clubBefore = round1((vdotOf(10000, 45) + 2 * vdotOf(5000, 25)) / 3);
  const club = round1(vdotOf(5000, 22));
  const clubGap = round1(club - clubBefore);

  it('has a row for each race, newest first, with the number the time gives, the number before it and the difference', async () => {
    served = racesRuns();
    renderPage();
    await racesHeading();
    const rows = racesRows();

    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByRole('rowheader')).toHaveTextContent('Oct 11, 2026');
    expect(cells(rows[0])).toEqual(['Club 5K', '5.0 km', '22:00', club.toFixed(1), clubBefore.toFixed(1), signed(clubGap)]);
    expect(within(rows[1]).getByRole('rowheader')).toHaveTextContent('Oct 8, 2026');
    expect(cells(rows[2])).toEqual(['Spring 10K', '10.0 km', '45:00', tenK.toFixed(1), easy.toFixed(1), signed(tenKGap)]);
    expect(within(rows[0]).getByRole('link', { name: 'Club 5K' })).toHaveAttribute('href', '/runs/45');
    // The easy runs are not races, and are in the table above, not here.
    expect(within(racesTable()).queryByText('Easy one')).not.toBeInTheDocument();
  });

  it('says in words how the races came out against the number, with the mean of the differences as printed', async () => {
    served = racesRuns();
    renderPage();
    await racesHeading();
    const mean = round1((clubGap + tenKGap) / 2);

    expect(mean).toBeGreaterThan(0);
    expect(screen.getByText(`On average your 2 races came out ${mean.toFixed(1)} above the VO2max you had before them: the times were better than the number said.`)).toBeInTheDocument();
    expect(screen.getByText('Of the 2: 2 above the number, 0 below it, 0 level.')).toBeInTheDocument();
    expect(screen.getByText(/One race says little/)).toBeInTheDocument();
  });

  it('lists a race too short for a number without one, and leaves it out of the average', async () => {
    served = racesRuns();
    renderPage();
    await racesHeading();
    const fun = racesRows()[1];

    expect(cells(fun)).toEqual(['Fun run', '1.2 km', '5:00', '–Under 1.5 km', '–', '–']);
    expect(screen.getByText(/On average your 2 races/)).toBeInTheDocument();
  });

  it('says so when a race has no run before it that gives an estimate', async () => {
    served = lonelyRaces();
    renderPage();
    await racesHeading();
    const [row] = racesRows();

    expect(cells(row)).toEqual(['First ever race', '5.0 km', '24:00', round1(vdotOf(5000, 24)).toFixed(1), 'No estimate', '–']);
    expect(screen.getByText(/None of these races can be set against the number/)).toBeInTheDocument();
    expect(screen.queryByText(/Of the \d+:/)).not.toBeInTheDocument();
  });

  it('says the one race it has in the singular, and which side of the number it came out', async () => {
    served = racesRuns().filter((run) => run.id !== 45 && run.id !== 46);
    renderPage();
    await racesHeading();

    expect(screen.getByText(`This race came out ${tenKGap.toFixed(1)} above the VO2max you had before it: the time was better than the number said.`)).toBeInTheDocument();
    expect(screen.queryByText(/^Of the/)).not.toBeInTheDocument();
  });

  it('says it came out below the number when the time was worse than the number said', async () => {
    served = [
      ...racesRuns().filter((run) => run.id < 44),
      { ...racesRuns()[3], id: 47, name: 'Slow day', movingTimeSeconds: 3600 },
    ];
    renderPage();
    await racesHeading();
    const gap = round1(round1(vdotOf(10000, 60)) - easy);

    expect(gap).toBeLessThan(0);
    expect(cells(racesRows()[0]).at(-1)).toBe(signed(gap));
    expect(screen.getByText(`This race came out ${Math.abs(gap).toFixed(1)} below the VO2max you had before it: the time was worse than the number said.`)).toBeInTheDocument();
  });

  it('tells a runner with no race flagged how to flag one, and draws no table for it', async () => {
    renderPage();
    await ready();

    expect(screen.getByRole('heading', { level: 2, name: t('vo2max_estimates.races_title') })).toBeInTheDocument();
    expect(screen.getByText(t('vo2max_estimates.races_empty'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('vo2max_estimates.races_empty_action') })).toHaveAttribute('href', '/runs');
    expect(screen.queryByRole('table', { name: t('vo2max_estimates.races_table_label') })).not.toBeInTheDocument();
  });

  it('is there for a runner whose window is empty, with the races of the time they did run', async () => {
    served = oldRaceRuns();
    renderPage();
    expect(await screen.findByRole('heading', { level: 2, name: t('vo2max_estimates.empty_title') })).toBeInTheDocument();
    await racesHeading();
    const [row] = racesRows();

    expect(cells(row)).toEqual(['Autumn 10K', '10.0 km', '46:00', round1(vdotOf(10000, 46)).toFixed(1), expect.stringMatching(/^\d+\.\d$/), expect.stringMatching(/^[+−]?\d+\.\d$/)]);
  });

  it('links to the rule, which says how the number before a race is worked out', async () => {
    served = racesRuns();
    renderPage();
    await racesHeading();
    const links = screen.getAllByRole('link', { name: t('methods.link') }).map((link) => link.getAttribute('href'));

    expect(links).toContain(methodsDocUrl('your-races-against-the-number'));
    expect(screen.getByText(/The difference is the first minus the second, as printed/)).toBeInTheDocument();
  });

  it('counts the distance in miles when the runner does, and the shortest race with it', async () => {
    state.unit = 'mile';
    served = racesRuns();
    renderPage();
    await racesHeading();

    expect(cells(racesRows()[0])[1]).toBe('3.1 mi');
    expect(within(racesRows()[1]).getByText('Under 0.9 mi')).toBeInTheDocument();
  });

  it('reads in Chinese, with the same numbers', async () => {
    state.lang = 'zh-CN';
    served = racesRuns();
    renderPage();
    expect(await screen.findByRole('heading', { level: 2, name: '你的比赛与这个数字的对照' })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: zh.vo2max_estimates.races_table_label });
    const first = within(table).getAllByRole('row')[1];

    expect(within(first).getAllByRole('cell').map((cell) => cell.textContent).slice(-3)).toEqual([club.toFixed(1), clubBefore.toFixed(1), signed(clubGap)]);
    expect(screen.getByText(/^你的 2 场比赛平均比赛前的 VO2max 高 /)).toBeInTheDocument();
    expect(screen.getByText('2 场中：2 场高于这个数字，0 场低于，0 场持平。')).toBeInTheDocument();
  });
});

describe('your VO2max over time', () => {
  const heading = () => screen.findByRole('heading', { level: 2, name: t('vo2max_estimates.history_title') });
  const reads = () => screen.getByRole('group', { name: t('vo2max_estimates.history_reads_label') });
  const readOf = (label) => within(reads()).getByText(label).closest('div');
  const chart = () => screen.queryByRole('slider', { name: /^Your VO2max after/ });
  const yearsTable = () => screen.getByRole('table', { name: t('vo2max_estimates.history_years_label') });
  const rangeButton = (key) => screen.getByRole('button', { name: t(`vo2max_estimates.history_range_${key}`) });

  // The number after run i of the long history, from the equations: the mean of the quickest three runs of the 90 days, which are
  // the latest three because each run is quicker than the one before it.
  const v = (index) => vdotOf(5000, longHistorySeconds(index) / 60);
  const after = (index) => round1((v(index) + v(index - 1) + v(index - 2)) / 3);
  const DAYS_AGO = (index) => 420 - index * 3;
  const last = LONG_HISTORY_RUNS - 1;
  const firstInYear = Array.from({ length: LONG_HISTORY_RUNS }, (_, index) => index).find((index) => DAYS_AGO(index) <= 365);

  // Every point of the long history stands three days (the runs are three days apart, and the last is three days from today), and the points of
  // today stands none: so the average of a stretch is the mean of the printed numbers of its runs, and its days are three for each.
  const averageOf = (from, to = last) => {
    const indexes = Array.from({ length: to - from + 1 }, (_, offset) => from + offset);
    return { value: indexes.reduce((sum, index) => sum + after(index), 0) / indexes.length, days: indexes.length * 3 };
  };

  it('shows the number now, the highest, the average and the lowest of the range, on a line with a point for each run', async () => {
    served = longHistory();
    renderPage();
    await heading();

    expect(rangeButton('1y')).toHaveAttribute('aria-pressed', 'true');
    expect(within(readOf('Now')).getByText(after(last).toFixed(1))).toBeInTheDocument();
    // Each run is quicker than the last, so the highest is the latest point (today's number) and the lowest the first of the range.
    expect(within(readOf('Highest')).getByText(after(last).toFixed(1))).toBeInTheDocument();
    expect(within(readOf('Lowest')).getByText(after(firstInYear).toFixed(1))).toBeInTheDocument();
    // The average is of the days each number stood, and lies between the two.
    const year = averageOf(firstInYear);
    expect(within(readOf('Average')).getByText(year.value.toFixed(1))).toBeInTheDocument();
    expect(within(readOf('Average')).getByText(`over ${year.days} days`)).toBeInTheDocument();
    expect(year.value).toBeGreaterThan(after(firstInYear));
    expect(year.value).toBeLessThan(after(last));
    // The number of the tile at the top is the same number.
    const tiles = screen.getByRole('region', { name: t('vo2max_estimates.tiles_label') });
    expect(within(tiles).getByText('Current VO2max').closest('article')).toHaveTextContent(after(last).toFixed(1));

    const inYear = LONG_HISTORY_RUNS - firstInYear + 1;                  // the runs of the year, and today
    expect(chart()).toHaveAccessibleName(new RegExp(`^Your VO2max after each run, ${inYear} points from `));
    expect(chart().querySelectorAll('circle.vo2max-estimates-v2__history-dot')).toHaveLength(inYear);
    expect(chart().querySelector('circle.is-now')).toBeInTheDocument();
    expect(chart().querySelector('path.vo2max-estimates-v2__history-line')).toBeInTheDocument();
  });

  it('draws the points before the third run hollow, and says what a hollow dot is only when there is one', async () => {
    served = longHistory();
    renderPage();
    await heading();
    expect(screen.queryByText(/A hollow dot/)).not.toBeInTheDocument();

    await userEvent.click(rangeButton('all'));
    expect(chart().querySelectorAll('circle.is-thin')).toHaveLength(2);
    expect(screen.getByText(/A hollow dot is a point where the number was the mean of fewer than 3 runs: it is drawn, and left out of the highest, the lowest and the average/)).toBeInTheDocument();
    // The lowest is taken from the points that are the mean of three runs: the first of them, after the third run.
    expect(within(readOf('Lowest')).getByText(after(2).toFixed(1))).toBeInTheDocument();
    // So is the average: the two hollow points stand for nothing, the 138 others for three days each.
    const everything = averageOf(2);
    expect(everything.days).toBe(138 * 3);
    expect(within(readOf('Average')).getByText(everything.value.toFixed(1))).toBeInTheDocument();
    expect(within(readOf('Average')).getByText(`over ${everything.days} days`)).toBeInTheDocument();
  });

  it('looks over six months, a year or all of it, and the highest, the lowest and the points follow', async () => {
    served = longHistory();
    renderPage();
    await heading();
    const pointsIn = () => chart().querySelectorAll('circle.vo2max-estimates-v2__history-dot').length;
    const year = pointsIn();

    await userEvent.click(rangeButton('6m'));
    expect(rangeButton('6m')).toHaveAttribute('aria-pressed', 'true');
    expect(rangeButton('1y')).toHaveAttribute('aria-pressed', 'false');
    const firstInHalfYear = Array.from({ length: LONG_HISTORY_RUNS }, (_, index) => index).find((index) => DAYS_AGO(index) <= 182);
    expect(pointsIn()).toBe(LONG_HISTORY_RUNS - firstInHalfYear + 1);
    expect(pointsIn()).toBeLessThan(year);
    expect(within(readOf('Lowest')).getByText(after(firstInHalfYear).toFixed(1))).toBeInTheDocument();
    // The average is of the points of the range only, and the days it is of are fewer.
    const half = averageOf(firstInHalfYear);
    expect(within(readOf('Average')).getByText(half.value.toFixed(1))).toBeInTheDocument();
    expect(within(readOf('Average')).getByText(`over ${half.days} days`)).toBeInTheDocument();

    await userEvent.click(rangeButton('all'));
    expect(pointsIn()).toBe(LONG_HISTORY_RUNS + 1);
    expect(pointsIn()).toBeGreaterThan(year);
  });

  it('has a row for each year, with the highest, the average, the lowest and the last number of it, and what was run', async () => {
    served = longHistory();
    renderPage();
    await heading();
    const rows = within(yearsTable()).getAllByRole('row').slice(1);
    const yearOf = (index) => new Date(NOW - DAYS_AGO(index) * 86400000).getFullYear();
    const indexes = Array.from({ length: LONG_HISTORY_RUNS }, (_, index) => index);

    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual(['2026', '2025']);
    for (const row of rows) {
      const year = Number(within(row).getByRole('rowheader').textContent);
      const mine = indexes.filter((index) => yearOf(index) === year);
      const firm = mine.filter((index) => index >= 2);
      const cells = within(row).getAllByRole('cell');

      expect(cells[0]).toHaveTextContent(after(Math.max(...firm)).toFixed(1));       // highest: the last, quickest, point of the year
      expect(cells[2]).toHaveTextContent(after(Math.min(...firm)).toFixed(1));       // lowest: the first
      expect(cells[4]).toHaveTextContent(String(mine.length));
      expect(cells[5]).toHaveTextContent(`${mine.length * 5} km`);
      // The average of the year: each of its points for the three days it stood, the last of the year only up to the end of the year.
      const yearEnd = new Date(year + 1, 0, 1).getTime();
      const stands = firm.map((index) => Math.min(3 * 86400000, yearEnd - (NOW - DAYS_AGO(index) * 86400000)) / 86400000);
      const sum = firm.reduce((total, index, position) => total + after(index) * stands[position], 0);
      const days = stands.reduce((total, stand) => total + stand, 0);
      expect(cells[1]).toHaveTextContent((sum / days).toFixed(1));
      expect(cells[1]).toHaveTextContent(`over ${Math.round(days)} days`);
    }
    // The current year ends where the number is today.
    const [thisYear, lastYear] = rows.map((row) => within(row).getAllByRole('cell'));
    expect(thisYear[3]).toHaveTextContent(after(last).toFixed(1));
    expect(thisYear[3]).toHaveTextContent(t('vo2max_estimates.history_year_now'));
    expect(lastYear[3]).not.toHaveTextContent(t('vo2max_estimates.history_year_now'));
    expect(lastYear[3]).toHaveTextContent(after(Math.max(...indexes.filter((index) => yearOf(index) === 2025))).toFixed(1));
  });

  it('says that no run in the range gave a number, and shows the years anyway, for a runner whose runs are all old', async () => {
    served = ancientRuns();
    renderPage();
    await heading();

    expect(screen.getByText(t('vo2max_estimates.history_empty_range'))).toBeInTheDocument();
    expect(chart()).not.toBeInTheDocument();
    expect(yearsTable()).toBeInTheDocument();
    await userEvent.click(rangeButton('all'));
    expect(chart()).toBeInTheDocument();
    expect(screen.queryByText(t('vo2max_estimates.history_empty_range'))).not.toBeInTheDocument();
    expect(within(readOf('Now')).getByText(t('vo2max_estimates.no_hr'))).toBeInTheDocument();
  });

  it('is not there for a runner with no run at all, and the page says what it said before', async () => {
    served = [];
    renderPage();
    expect(await screen.findByRole('heading', { level: 2, name: t('vo2max_estimates.empty_title') })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: t('vo2max_estimates.history_title') })).not.toBeInTheDocument();
  });

  it('counts the distance of a year in miles when the runner does', async () => {
    state.unit = 'mile';
    served = longHistory();
    renderPage();
    await heading();
    const [row] = within(yearsTable()).getAllByRole('row').slice(1);
    const runsThisYear = Number(within(row).getAllByRole('cell')[4].textContent);

    expect(within(row).getAllByRole('cell')[5]).toHaveTextContent(`${Math.round(runsThisYear * 5 * 0.621371)} mi`);
  });

  it('reads in Chinese, with the same numbers', async () => {
    state.lang = 'zh-CN';
    served = longHistory();
    renderPage();
    expect(await screen.findByRole('heading', { level: 2, name: '你的 VO2max 随时间的变化' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: '6 个月' })).toBeInTheDocument();
    const readsGroup = screen.getByRole('group', { name: zh.vo2max_estimates.history_reads_label });
    expect(within(readsGroup).getByText('现在').closest('div')).toHaveTextContent(after(last).toFixed(1));
    expect(within(readsGroup).getByText('平均').closest('div')).toHaveTextContent(averageOf(firstInYear).value.toFixed(1));
    expect(within(readsGroup).getByText('平均').closest('div')).toHaveTextContent(`共 ${averageOf(firstInYear).days} 天`);
    expect(screen.getByRole('table', { name: '按年份的 VO2max' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: zh.methods.link }).length).toBeGreaterThan(0);
  });

  it('links to the rule that says how a point is worked out', async () => {
    served = longHistory();
    renderPage();
    await heading();

    const links = screen.getAllByRole('link', { name: t('methods.link') }).map((link) => link.getAttribute('href'));
    expect(links).toContain(methodsDocUrl('the-number-over-time'));
    expect(screen.getByText(/at the moment its run ended/)).toBeInTheDocument();
  });

  describe('reading one point of the line', () => {
    const DAY_FORMAT = { year: 'numeric', month: 'short', day: 'numeric' };
    const dayText = (index, lang = 'en') => new Date(NOW - DAYS_AGO(index) * 86400000).toLocaleDateString(lang, DAY_FORMAT);
    // The number after run `index`: the mean of the runs there were in its 90 days, which are the latest three at most (each run is quicker than the one before).
    const pointValue = (index) => {
      const used = Math.min(index + 1, 3);
      let sum = 0;
      for (let step = 0; step < used; step += 1) sum += v(index - step);
      return round1(sum / used).toFixed(1);
    };
    const pointText = (index) => `${dayText(index)}: ${pointValue(index)}, after Long ${index + 1}`;
    const slider = () => chart();
    const readout = (container) => container.querySelector('.vo2max-estimates-v2__tooltip');
    const dotsInRange = () => LONG_HISTORY_RUNS - firstInYear + 1;
    const dotX = (position) => Number(slider().querySelectorAll('circle.vo2max-estimates-v2__history-dot')[position].getAttribute('cx'));
    /** The slider's box: the picture is 720 units wide in a test, and a pointer at x is at x in it. */
    const boxed = (element) => {
      element.getBoundingClientRect = () => ({ left: 0, top: 0, right: 720, bottom: 270, width: 720, height: 270, x: 0, y: 0, toJSON() {} });
    };

    it('is a slider that starts on the newest point, and the arrow keys, Home, End and Escape move it one point at a time', async () => {
      served = longHistory();
      const { container } = renderPage();
      await heading();
      const dots = dotsInRange();

      expect(slider()).toHaveAttribute('aria-valuemin', '0');
      expect(slider()).toHaveAttribute('aria-valuemax', String(dots - 1));
      expect(slider()).toHaveAttribute('aria-valuenow', String(dots - 1));
      expect(slider()).toHaveAttribute('aria-valuetext', `Now: ${after(last).toFixed(1)}`);
      expect(slider()).toHaveAttribute('tabindex', '0');
      expect(readout(container)).not.toBeInTheDocument();

      act(() => slider().focus());
      expect(readout(container).querySelector('time')).toHaveTextContent('Now');
      expect(readout(container).querySelector('strong')).toHaveTextContent(after(last).toFixed(1));

      fireEvent.keyDown(slider(), { key: 'ArrowLeft' });
      expect(slider()).toHaveAttribute('aria-valuenow', String(dots - 2));
      expect(slider()).toHaveAttribute('aria-valuetext', pointText(last));
      expect(readout(container).querySelector('time')).toHaveTextContent(dayText(last));
      expect(readout(container).querySelector('strong')).toHaveTextContent(pointValue(last));
      expect(readout(container).querySelector('span')).toHaveTextContent(`After Long ${last + 1}`);

      fireEvent.keyDown(slider(), { key: 'Home' });
      expect(slider()).toHaveAttribute('aria-valuenow', '0');
      expect(slider()).toHaveAttribute('aria-valuetext', pointText(firstInYear));
      fireEvent.keyDown(slider(), { key: 'ArrowLeft' });
      expect(slider()).toHaveAttribute('aria-valuenow', '0');

      fireEvent.keyDown(slider(), { key: 'End' });
      expect(slider()).toHaveAttribute('aria-valuenow', String(dots - 1));
      fireEvent.keyDown(slider(), { key: 'ArrowRight' });
      expect(slider()).toHaveAttribute('aria-valuenow', String(dots - 1));

      fireEvent.keyDown(slider(), { key: 'Escape' });
      expect(readout(container)).not.toBeInTheDocument();
      expect(slider()).toHaveAttribute('aria-valuenow', String(dots - 1));
    });

    it('marks the point with a ring and a thin line, at its place on the line', async () => {
      served = longHistory();
      const { container } = renderPage();
      await heading();
      expect(container.querySelector('circle.vo2max-estimates-v2__history-selected')).not.toBeInTheDocument();

      act(() => slider().focus());
      fireEvent.keyDown(slider(), { key: 'ArrowLeft' });
      const position = dotsInRange() - 2;
      const dot = slider().querySelectorAll('circle.vo2max-estimates-v2__history-dot')[position];
      const ring = container.querySelector('circle.vo2max-estimates-v2__history-selected');

      expect(ring.getAttribute('cx')).toBe(dot.getAttribute('cx'));
      expect(ring.getAttribute('cy')).toBe(dot.getAttribute('cy'));
      expect(container.querySelector('line.vo2max-estimates-v2__history-cross').getAttribute('x1')).toBe(dot.getAttribute('cx'));
      expect(slider().querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(readout(container)).toHaveAttribute('aria-hidden', 'true');
    });

    it('says what a hollow point is when it is read: the estimate of one run, the mean of two, and nothing for a firm one', async () => {
      served = longHistory();
      const { container } = renderPage();
      await heading();
      await userEvent.click(rangeButton('all'));
      act(() => slider().focus());

      fireEvent.keyDown(slider(), { key: 'Home' });
      expect(slider()).toHaveAttribute('aria-valuetext', `${pointText(0)}. ${t('vo2max_estimates.history_point_thin_one')}`);
      expect(readout(container).querySelector('small')).toHaveTextContent(t('vo2max_estimates.history_point_hollow_one'));

      fireEvent.keyDown(slider(), { key: 'ArrowRight' });
      expect(slider()).toHaveAttribute('aria-valuetext', `${pointText(1)}. ${t('vo2max_estimates.history_point_thin', { count: 2 })}`);
      expect(readout(container).querySelector('small')).toHaveTextContent(t('vo2max_estimates.history_point_hollow', { count: 2 }));

      fireEvent.keyDown(slider(), { key: 'ArrowRight' });
      expect(slider()).toHaveAttribute('aria-valuetext', pointText(2));
      expect(readout(container).querySelector('small')).not.toBeInTheDocument();
    });

    it('follows the pointer to the nearest point, and lets go when it leaves', async () => {
      served = longHistory();
      const { container } = renderPage();
      await heading();
      boxed(slider());

      fireEvent.pointerMove(slider(), { clientX: dotX(10) + 0.2 });
      expect(slider()).toHaveAttribute('aria-valuenow', '10');
      expect(readout(container).querySelector('time')).toHaveTextContent(dayText(firstInYear + 10));
      expect(Number(container.querySelector('circle.vo2max-estimates-v2__history-selected').getAttribute('cx'))).toBeCloseTo(dotX(10), 5);

      fireEvent.pointerMove(slider(), { clientX: 2000 });
      expect(slider()).toHaveAttribute('aria-valuenow', String(dotsInRange() - 1));
      fireEvent.pointerMove(slider(), { clientX: -50 });
      expect(slider()).toHaveAttribute('aria-valuenow', '0');

      fireEvent.pointerLeave(slider());
      expect(readout(container)).not.toBeInTheDocument();
      expect(container.querySelector('circle.vo2max-estimates-v2__history-selected')).not.toBeInTheDocument();
    });

    it('keeps the point a finger touched after the finger lifts, and lets go of it when something else is touched', async () => {
      served = longHistory();
      const { container } = renderPage();
      await heading();
      boxed(slider());

      fireEvent.pointerDown(slider(), { clientX: dotX(20), pointerType: 'touch' });
      expect(readout(container)).toBeInTheDocument();
      const touched = slider().getAttribute('aria-valuenow');
      expect(touched).toBe('20');

      fireEvent.pointerLeave(slider(), { pointerType: 'touch' });
      expect(readout(container)).toBeInTheDocument();
      expect(slider()).toHaveAttribute('aria-valuenow', touched);

      fireEvent.pointerDown(document.body, { pointerType: 'touch' });
      expect(readout(container)).not.toBeInTheDocument();
    });

    it('forgets the point when the range changes, and when the focus goes elsewhere', async () => {
      served = longHistory();
      const { container } = renderPage();
      await heading();

      act(() => slider().focus());
      expect(readout(container)).toBeInTheDocument();
      await userEvent.click(rangeButton('6m'));
      expect(readout(container)).not.toBeInTheDocument();
      expect(slider()).toHaveAttribute('aria-valuenow', String(slider().querySelectorAll('circle.vo2max-estimates-v2__history-dot').length - 1));

      act(() => slider().focus());
      expect(readout(container)).toBeInTheDocument();
      act(() => slider().blur());
      expect(readout(container)).not.toBeInTheDocument();
    });

    it('has every point as a list for a screen reader, in the same words as the slider, hollow points with their note', async () => {
      served = longHistory();
      renderPage();
      await heading();
      await userEvent.click(rangeButton('all'));

      const items = within(screen.getByRole('list', { name: t('vo2max_estimates.history_list_label') })).getAllByRole('listitem');
      expect(items).toHaveLength(LONG_HISTORY_RUNS + 1);
      expect(items[0].textContent).toBe(`${pointText(0)}. ${t('vo2max_estimates.history_point_thin_one')}`);
      expect(items[1].textContent).toBe(`${pointText(1)}. ${t('vo2max_estimates.history_point_thin', { count: 2 })}`);
      expect(items[2].textContent).toBe(pointText(2));
      expect(items[last].textContent).toBe(pointText(last));
      expect(items[items.length - 1].textContent).toBe(`Now: ${after(last).toFixed(1)}`);
    });

    it('tells under the line how to read a point', async () => {
      served = longHistory();
      renderPage();
      await heading();

      expect(screen.getByText(t('vo2max_estimates.history_hint'))).toBeInTheDocument();
      expect(chart().getAttribute('aria-label')).toContain('Use the arrow keys');
    });

    it('reads a run with no name, and the only point there is', async () => {
      served = [{ ...longHistory()[0], name: '', startTime: new Date(NOW).toISOString() }];
      const { container } = renderPage();
      await heading();
      const only = screen.getByRole('slider', { name: /^Your VO2max after your run on / });

      expect(only).toHaveAttribute('aria-valuemax', '0');
      act(() => only.focus());
      expect(only).toHaveAttribute('aria-valuetext', expect.stringMatching(/: \d+\.\d, after a run with no name\. One run's estimate/));
      expect(readout(container).querySelector('span')).toHaveTextContent('After a run with no name');
      fireEvent.keyDown(only, { key: 'ArrowRight' });
      fireEvent.keyDown(only, { key: 'ArrowLeft' });
      expect(only).toHaveAttribute('aria-valuenow', '0');
    });

    it('reads a hollow point in Chinese with Chinese punctuation, in the slider and in the list (BUG-052)', async () => {
      state.lang = 'zh-CN';
      served = longHistory();
      renderPage();
      await screen.findByRole('heading', { level: 2, name: '你的 VO2max 随时间的变化' });
      await userEvent.click(screen.getByRole('button', { name: '全部' }));
      const zhSlider = screen.getByRole('slider', { name: /^每次跑步之后的 VO2max/ });
      act(() => zhSlider.focus());
      fireEvent.keyDown(zhSlider, { key: 'Home' });

      const sentence = zhSlider.getAttribute('aria-valuetext');
      expect(sentence).toBe(`${dayText(0, 'zh-CN')}：${pointValue(0)}，在“Long 1”之后。${zh.vo2max_estimates.history_point_thin_one}`);
      expect(sentence).not.toMatch(/\. /);
      const first = within(screen.getByRole('list', { name: zh.vo2max_estimates.history_list_label })).getAllByRole('listitem')[0];
      expect(first.textContent).toBe(sentence);
    });

    it('reads in Chinese: the label, the hint and a point', async () => {
      state.lang = 'zh-CN';
      served = longHistory();
      renderPage();
      await screen.findByRole('heading', { level: 2, name: '你的 VO2max 随时间的变化' });
      const zhSlider = screen.getByRole('slider', { name: new RegExp(`^每次跑步之后的 VO2max，共 ${dotsInRange()} 个点`) });

      expect(screen.getByText(zh.vo2max_estimates.history_hint)).toBeInTheDocument();
      expect(zhSlider.getAttribute('aria-label')).toContain('用方向键');
      act(() => zhSlider.focus());
      fireEvent.keyDown(zhSlider, { key: 'ArrowLeft' });
      expect(zhSlider).toHaveAttribute('aria-valuetext', `${dayText(last, 'zh-CN')}：${pointValue(last)}，在“Long ${last + 1}”之后`);
    });
  });
});

describe('miles and the other language', () => {
  it('counts distances and paces in miles when the runner does', async () => {
    state.unit = 'mile';
    renderPage();
    await ready();
    const rows = bodyRows();
    const tempo = within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent);

    expect(tempo[1]).toBe('6.2 mi');
    expect(tempo[2]).toBe('8:03 /mi');
    expect(within(rows[2]).getByText('Under 1.9 mi, not used')).toBeInTheDocument();
    expect(screen.getByText(/runs of 1\.9 mi or more/)).toBeInTheDocument();
    expect(screen.getByText(/that is slower than 9:30 \/mi/)).toBeInTheDocument();
  });

  it('reads in Chinese, with the same numbers', async () => {
    state.lang = 'zh-CN';
    renderPage();
    await screen.findByRole('heading', { level: 2, name: 'VO2max 估算' });
    await screen.findByRole('table', { name: ZH_RUNS_TABLE });

    expect(screen.getByText('（46.23 + 45.61 + 44.54）÷ 3 = 45.46，显示为 45.5。')).toBeInTheDocument();
    expect(screen.getAllByText('比赛公式').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已计入', { selector: 'small' })).toHaveLength(3);
  });
});
