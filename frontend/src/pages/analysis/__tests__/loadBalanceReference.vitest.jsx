import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnalysisInsightDetail from '../AnalysisInsightDetail';
import en from '../../../i18n/locales/en/pages';
import { cachedApiJson } from '../../../api/resourceCache';
import { addDaysToKey } from '../../../utils/calendarDays';

const preferences = vi.hoisted(() => ({ unit: 'km' }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'runner@example.test' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: 'en', formatNumber: (value, options) => new Intl.NumberFormat('en-US', options).format(value), t: (key, values = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], en) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
} }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => preferences }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

let activities;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-07T16:00:00Z'));
  preferences.unit = 'km';
  activities = Array.from({ length: 90 }, (_, index) => {
    const date = new Date('2026-10-07T12:00:00Z');
    date.setUTCDate(date.getUTCDate() - index);
    return { id: index + 1, name: `Run ${index + 1}`, startTime: date.toISOString(), distanceKm: 8 + index % 3, movingTimeSeconds: (8 + index % 3) * 320, averageHeartRate: 140, maxHeartRate: 185 };
  });
  cachedApiJson.mockImplementation(async (url) => url === '/api/activities/analysis' ? activities : { displayName: 'Runner' });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function renderPage(address = '/analysis/load-balance') {
  return render(<MemoryRouter initialEntries={[address]}><Routes>
    <Route path="/analysis/:insightKey" element={<AnalysisInsightDetail />} />
    <Route path="/today-run" element={<h1>Today's plan</h1>} />
    <Route path="/runs/:runId" element={<h1>Run detail</h1>} />
  </Routes></MemoryRouter>);
}

async function openPage() {
  const result = renderPage();
  await screen.findByRole('heading', { level: 2, name: 'Acute vs. chronic load' });
  return result;
}

it('keeps the shell, projects seven days, and changes the actual chart window', async () => {
  const { container } = await openPage();
  expect(container.querySelector('.runner-shell-topbar')).toBeInTheDocument();
  expect(container.querySelector('.runner-shell-sidebar')).toBeInTheDocument();
  expect(container.querySelectorAll('.analysis-load-v2-budget li')).toHaveLength(7);
  const history = () => container.querySelectorAll('[data-analysis-history="load"] li');
  expect(history()).toHaveLength(56);
  expect(container.querySelector('.analysis-load-v2-band')).toHaveAttribute('d', expect.stringContaining(' Z'));
  fireEvent.click(screen.getByRole('button', { name: '4 wk' }));
  expect(history()).toHaveLength(28);
  expect(screen.getByRole('button', { name: '4 wk' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: '12 wk' }));
  expect(history()).toHaveLength(84);
  expect(container.querySelectorAll('.analysis-load-v2-metrics.is-load-row > .analysis-load-v2-metric')).toHaveLength(5);
  expect(container.querySelector('.analysis-load-v2-metrics')).toHaveTextContent('Weekly volume');
  expect(container.querySelector('.analysis-load-v2-metrics')).toHaveTextContent('Monotony');
  expect(container.querySelector('.analysis-load-v2-metrics')).toHaveTextContent('Strain');
  expect(container.querySelectorAll('.analysis-load-v2-driver')).toHaveLength(7);
  fireEvent.click(screen.getByRole('button', { name: "Open today's run" }));
  expect(screen.getByRole('heading', { name: "Today's plan" })).toBeInTheDocument();
});

/** The card of the main row that carries this label. */
function cardOf(container, label) {
  return [...container.querySelectorAll('.analysis-load-v2-metrics.is-load-row > .analysis-load-v2-metric')]
    .find((card) => card.querySelector(':scope > span')?.textContent === label);
}
const numberIn = (text) => Number(String(text).replace(/,/g, ''));

it('prints the strain as the week load times the monotony, shows the working and links to the rule', async () => {
  const { container } = await openPage();
  const strain = cardOf(container, 'Strain');
  const monotony = cardOf(container, 'Monotony');
  const [, load, factor] = /Week load ([\d,]+) × monotony (\d+\.\d\d)\./.exec(strain.querySelector(':scope > small').textContent);

  // What is printed multiplies out (to the rounding of the printed parts) and the monotony is the Monotony card's own.
  const value = numberIn(strain.querySelector(':scope > strong').textContent);
  expect(value).toBeGreaterThan(0);
  expect(Math.abs(value - numberIn(load) * Number(factor))).toBeLessThanOrEqual(0.005 * value + 1);
  expect(Math.abs(Number(monotony.querySelector(':scope > strong').textContent) - Number(factor))).toBeLessThanOrEqual(0.051);
  expect(strain.querySelector(':scope > em')).toHaveTextContent(/^[+-]?\d+% vs\. last week$/);
  expect(strain).toHaveClass('is-neutral');

  for (const card of [strain, monotony]) {
    expect(within(card).getByRole('link')).toHaveAttribute('href', expect.stringMatching(/README-ANALYSIS\.md#monotony-and-training-strain$/));
  }
});

it('says so when every day of the week had the same load: the strain has no end', async () => {
  activities = activities.map((run) => ({ ...run, distanceKm: 8, movingTimeSeconds: 2560 }));
  const { container } = await openPage();
  const strain = cardOf(container, 'Strain');

  expect(strain.querySelector(':scope > strong')).toHaveTextContent('∞');
  expect(strain.querySelector(':scope > em')).toHaveTextContent('Every day had the same load');
  expect(cardOf(container, 'Monotony').querySelector(':scope > strong')).toHaveTextContent('∞');
});

it('has no strain for a week with no run in it, and says why', async () => {
  activities = activities.filter((run) => run.id > 9);
  const { container } = await openPage();
  const strain = cardOf(container, 'Strain');

  expect(strain.querySelector(':scope > strong')).toHaveTextContent('--');
  expect(strain.querySelector(':scope > em')).toHaveTextContent('No recent load');
});

it('has nothing to compare with before the second week of history', async () => {
  activities = activities.slice(0, 9);
  const { container } = await openPage();
  const strain = cardOf(container, 'Strain');

  expect(numberIn(strain.querySelector(':scope > strong').textContent)).toBeGreaterThan(0);
  expect(strain.querySelector(':scope > em')).toHaveTextContent('No prior week to compare');
});

it('uses the selected distance unit and opens the contributing run', async () => {
  preferences.unit = 'mile';
  const { container } = await openPage();
  const metrics = container.querySelector('.analysis-load-v2-metrics');
  expect(metrics).toHaveTextContent('38.5 mi');
  const run = container.querySelector('.analysis-load-v2-driver');
  expect(within(run).getByLabelText('Distance')).toHaveTextContent('mi');
  fireEvent.click(run);
  expect(screen.getByRole('heading', { name: 'Run detail' })).toBeInTheDocument();
});

it('shows unavailable load data without inventing a budget or baseline', async () => {
  activities = [];
  const { container } = await openPage();
  expect(container.querySelectorAll('.analysis-load-v2-budget li')).toHaveLength(0);
  expect(container.querySelector('.analysis-load-v2-window')).toHaveTextContent('Not enough data');
  expect(container.querySelector('.analysis-load-v2-ratio > strong')).toHaveTextContent('--');
  expect(container.querySelector('.analysis-load-v2-band')).not.toBeInTheDocument();
  expect(container.querySelector('.analysis-load-v2-metrics')).toHaveTextContent('Baseline forming');
  expect(cardOf(container, 'Strain').querySelector(':scope > strong')).toHaveTextContent('--');
});

// BUG-031: any one failed request replaced the whole page with a sentence and nothing to press.
it('still shows the load numbers when only the profile request fails', async () => {
  cachedApiJson.mockImplementation(async (url) => {
    if (url === '/api/profile/me') throw new Error('Unavailable');
    return activities;
  });
  const { container } = await openPage();
  expect(container.querySelector('.analysis-load-v2-metrics')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('says the runs could not be loaded, and loads them again when asked', async () => {
  let failures = 1;
  cachedApiJson.mockImplementation(async (url) => {
    if (url === '/api/activities/analysis') {
      if (failures-- > 0) throw new Error('Unavailable');
      return activities;
    }
    return { displayName: 'Runner' };
  });
  renderPage();
  expect(await screen.findByRole('alert')).toHaveTextContent('analysis.stitch_load_error');
  expect(screen.queryByRole('heading', { level: 2, name: 'Acute vs. chronic load' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'analysis.stitch_load_retry' }));
  await screen.findByRole('heading', { level: 2, name: 'Acute vs. chronic load' });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

// BUG-043: a run is on the day on the runner's own clock, and that clock can be a day ahead of this device's (the zone in Settings is east
// of the device's, or a file's UTC time was moved into it). The week stopped on the device's date and left the run out of everything.
it('counts a run dated a day after the device\'s date: it is in the week, in the load and in the list of the week\'s runs', async () => {
  vi.setSystemTime(new Date(2026, 9, 7, 16, 0));
  const onDay = (daysBack, km) => ({ startTime: `${addDaysToKey('2026-10-07', -daysBack)}T07:00:00`, distanceKm: km, movingTimeSeconds: km * 330, averageHeartRate: 140, maxHeartRate: 185 });
  activities = [
    { id: 99, name: 'Evening in the east', ...onDay(-1, 12) },
    ...Array.from({ length: 14 }, (_, index) => ({ id: index + 1, name: `Run ${index + 1}`, ...onDay(index, 8) })),
  ];
  const { container } = await openPage();

  // The week is 2 to 8 October: six runs of 8 km and the one of 12 km.
  expect(cardOf(container, 'Weekly volume').querySelector(':scope > strong')).toHaveTextContent('60 km');
  expect(cardOf(container, 'Weekly volume').querySelector(':scope > em')).toHaveTextContent('+7% vs. last week');
  expect(screen.getByText('Evening in the east')).toBeInTheDocument();
  expect(container.querySelectorAll('.analysis-load-v2-driver')).toHaveLength(7);
});

// BUG-044: a week before that was a rest week, or the same every day, was called "no prior week" although there was one.
describe('the line under the weekly volume and the strain when the week before has nothing to compare with', () => {
  const wallRun = (daysBack, km = 8, id = 100 + daysBack) => ({
    id, name: `Run ${daysBack}`, startTime: `${addDaysToKey('2026-10-07', -daysBack)}T07:00:00`, distanceKm: km, movingTimeSeconds: km * 330, averageHeartRate: 140, maxHeartRate: 185,
  });
  const line = (container, label) => cardOf(container, label).querySelector(':scope > em');

  beforeEach(() => vi.setSystemTime(new Date(2026, 9, 7, 16, 0)));

  it('says there was no running, and no load, when the week before was a rest week', async () => {
    activities = [0, 1, 2, 4, 5, ...Array.from({ length: 12 }, (_, index) => 16 + index)].map((daysBack) => wallRun(daysBack, 8 + (daysBack % 3)));
    const { container } = await openPage();

    expect(numberIn(cardOf(container, 'Strain').querySelector(':scope > strong').textContent)).toBeGreaterThan(0);
    expect(line(container, 'Strain')).toHaveTextContent('No load the week before');
    expect(line(container, 'Weekly volume')).toHaveTextContent('No runs the week before');
  });

  it('says the week before was the same every day when it was, and still compares the volume', async () => {
    activities = [0, 1, 2, 4, 5, 6].map((daysBack) => wallRun(daysBack, 6 + daysBack))
      .concat([7, 8, 9, 10, 11, 12, 13, 14, 15].map((daysBack) => wallRun(daysBack, 8)));
    const { container } = await openPage();

    expect(line(container, 'Strain')).toHaveTextContent('The week before was the same every day');
    expect(line(container, 'Weekly volume')).toHaveTextContent(/^[+-]?\d+% vs\. last week$/);
  });

  it('still says there is no prior week when the history is under two weeks long', async () => {
    activities = [0, 1, 2, 4, 5, 6, 8].map((daysBack) => wallRun(daysBack, 6 + daysBack));
    const { container } = await openPage();

    expect(line(container, 'Strain')).toHaveTextContent('No prior week to compare');
  });
});

// The parts of the page: a list at the top that takes the reader to one, and an address with a fragment that goes to it (BUG-046: the Training log's link to the
// fitness card landed at the top of the page, 1,252 px above the card).
describe('the parts of the page', () => {
  const PARTS = [
    ['#load-chart', en.analysisInsight.load_v3_chart_title],
    ['#load-fitness', en.training_series.fitness_title],
    ['#load-weekly-effort', en.training_series.weekly_title],
    ['#load-distance', en.weekly_distance.title],
    ['#load-intensity', en.training_intensity.title],
    ['#load-drivers', en.analysisInsight.load_v3_drivers_title],
  ];
  beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
  afterEach(() => { delete Element.prototype.scrollIntoView; });

  it('lists them, each a link to the part, which exists on the page and can take the focus', async () => {
    const { container } = await openPage();
    const links = within(screen.getByRole('navigation', { name: 'On this page' })).getAllByRole('link');

    expect(links.map((link) => [link.getAttribute('href'), link.textContent])).toEqual(PARTS);
    for (const [selector] of PARTS) {
      const part = container.querySelector(selector);
      expect(part, selector).toBeInTheDocument();
      expect(part).toHaveAttribute('tabindex', '-1');
    }
  });

  it('has a name for every part the focus can be taken to, so that a screen reader says where the reader is (BUG-049)', async () => {
    const { container } = await openPage();

    for (const [selector, name] of PARTS) {
      const part = container.querySelector(selector);
      expect(within(container).getByRole('region', { name }), name).toBe(part);
    }
  });

  it('takes the reader to the part chosen, and the focus with them, and leaves the address as it is', async () => {
    const { container } = await openPage();
    const links = within(screen.getByRole('navigation', { name: 'On this page' })).getAllByRole('link');

    expect(fireEvent.click(links[1]), 'the click is not followed as a move to another address').toBe(false);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
    expect(Element.prototype.scrollIntoView.mock.contexts[0]).toBe(container.querySelector('#load-fitness'));
    expect(document.activeElement).toBe(container.querySelector('#load-fitness'));
  });

  it('goes to the part named in the address once the page has been drawn', async () => {
    const { container } = renderPage('/analysis/load-balance#load-weekly-effort');
    await screen.findByRole('heading', { level: 2, name: 'Acute vs. chronic load' });

    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' });
    expect(Element.prototype.scrollIntoView.mock.contexts.at(-1)).toBe(container.querySelector('#load-weekly-effort'));
    expect(document.activeElement).toBe(container.querySelector('#load-weekly-effort'));
  });

  it('stays where it is for an address whose fragment is not a part of the page, or has no meaning', async () => {
    for (const address of ['/analysis/load-balance#nothing-here', '/analysis/load-balance#', '/analysis/load-balance#%E0%A4%A']) {
      const { unmount } = renderPage(address);
      await screen.findByRole('heading', { level: 2, name: 'Acute vs. chronic load' });
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(Element.prototype.scrollIntoView, address).not.toHaveBeenCalled();
      unmount();
    }
  });
});

// BUG-031: any one failed request replaced the whole page with a sentence and nothing to press.
it('still shows the load numbers when only the profile request fails', async () => {
  cachedApiJson.mockImplementation(async (url) => {
    if (url === '/api/profile/me') throw new Error('Unavailable');
    return activities;
  });
  const { container } = await openPage();
  expect(container.querySelector('.analysis-load-v2-metrics')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('says the runs could not be loaded, and loads them again when asked', async () => {
  let failures = 1;
  cachedApiJson.mockImplementation(async (url) => {
    if (url === '/api/activities/analysis') {
      if (failures-- > 0) throw new Error('Unavailable');
      return activities;
    }
    return { displayName: 'Runner' };
  });
  renderPage();
  expect(await screen.findByRole('alert')).toHaveTextContent('analysis.stitch_load_error');
  expect(screen.queryByRole('heading', { level: 2, name: 'Acute vs. chronic load' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'analysis.stitch_load_retry' }));
  await screen.findByRole('heading', { level: 2, name: 'Acute vs. chronic load' });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
