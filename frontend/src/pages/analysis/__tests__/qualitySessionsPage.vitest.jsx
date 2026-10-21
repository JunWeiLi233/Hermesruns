import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedApiJson } from '../../../api/resourceCache';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { methodsDocUrl } from '../../../utils/methodsDoc';
import QualitySessions from '../QualitySessions';
import { NOW, runs, runsWithNoTypes } from './qualitySessionsFixtures';

const state = vi.hoisted(() => ({ lang: 'en', unit: 'km' }));
const t = (key, params = {}) => {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};

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

function Search() {
  return <span data-testid="search">{useLocation().search}</span>;
}

function renderPage(path = '/analysis/intensity', props = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/analysis/intensity" element={<><QualitySessions {...props} /><Search /></>} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function ready() {
  await screen.findByRole('heading', { level: 2, name: t('quality_sessions.title') });
  // The link to how it is worked out comes with the choices, whether or not there is a session to list.
  await screen.findByRole('link', { name: t('methods.link') });
}

/** The four readings as [name, value, hint] for each. */
function readings() {
  const group = screen.getByRole('group', { name: t('quality_sessions.reads_label') });
  return Array.from(group.children).map((tile) => [tile.querySelector('span').textContent, tile.querySelector('strong').textContent, tile.querySelector('small').textContent]);
}

const rows = () => within(screen.getByRole('table', { name: t('quality_sessions.table_label') })).getAllByRole('row').slice(1);
const cells = (row) => Array.from(row.children).map((cell) => cell.textContent);
const pressed = (name) => screen.getByRole('button', { name, pressed: true });
const search = () => screen.getByTestId('search').textContent;

beforeEach(() => {
  state.lang = 'en';
  state.unit = 'km';
  served = runs();
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
    expect(container.querySelector('.quality-sessions-v2')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(t('quality_sessions.loading'));
    expect(container.querySelector('.page-skeleton__block')).toBeInTheDocument();

    await ready();
    expect(container.querySelector('.quality-sessions-v2')).not.toHaveAttribute('aria-busy');
    expect(cachedApiJson).toHaveBeenCalledTimes(1);
    expect(cachedApiJson.mock.calls[0][0]).toBe('/api/activities/analysis');
    expect(screen.queryByTestId('chrome')).not.toBeInTheDocument();
    expect(container.querySelector('h1')).not.toBeInTheDocument();
  });

  it('says so when the runs cannot be loaded, offers another try, and the try works', async () => {
    served = new Error('network');
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(t('quality_sessions.error'));
    served = runs();
    await userEvent.click(screen.getByRole('button', { name: t('quality_sessions.retry') }));
    await ready();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('takes an answer that is not a list for a failed load', async () => {
    served = { runs: [] };
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(t('quality_sessions.error'));
  });
});

describe('compact intensity card', () => {
  it.each(['en', 'zh-CN'])('keeps filters, actual latest session, and units in %s', async lang => {
    state.lang = lang;
    state.unit = 'mile';
    const { container } = renderPage('/analysis/intensity', { compact: true });
    await screen.findByRole('list', { name: t('quality_sessions.table_label') });
    expect(readings()[0][1]).toBe('3');
    expect(readings()[3][1]).toBe('Run 1');
    expect(readings()[1][1]).toContain(lang === 'en' ? 'mi' : '英里');
    expect(container.querySelector('.intensity-quality-list')).toHaveTextContent(t('quality_sessions.unit_pace_mile'));
    expect(container.textContent).not.toMatch(/analysis\.intensity_redesign_|run_labels\./);
    await userEvent.click(screen.getByRole('button', { name: t('quality_sessions.type_long') }));
    expect(search()).toBe('?types=workout%2Crace%2Clong');
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(container.querySelector('.is-long')).toBeInTheDocument();
    expect(container.querySelector('.is-race')).toBeInTheDocument();
  });

  it('expands beyond five sessions and resets the list after a filter change', async () => {
    served = [...runs(), ...Array.from({ length: 4 }, (_, index) => ({ ...runs()[0], id: 100 + index, name: `Extra ${index}` }))];
    renderPage('/analysis/intensity', { compact: true });
    await screen.findByRole('list', { name: t('quality_sessions.table_label') });
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    await userEvent.click(screen.getByRole('button', { name: 'Show all 7' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    await userEvent.click(screen.getByRole('button', { name: '6 months' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Show all 8' })).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Workouts' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});

describe('the first view: workouts and races over 3 months', () => {
  it('has the workouts and the races on, the long runs off, 3 months chosen and an address with nothing in it', async () => {
    renderPage();
    await ready();
    expect(pressed('Workouts')).toBeInTheDocument();
    expect(pressed('Races')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Long runs', pressed: false })).toBeInTheDocument();
    expect(pressed('3 months')).toBeInTheDocument();
    expect(search()).toBe('');
    expect(screen.getByText(t('quality_sessions.types_hint'))).toBeInTheDocument();
  });

  it('reads out the sessions, their distance, their middle pace and how the count stands against the 3 months before, worked out by hand', async () => {
    renderPage();
    await ready();
    // 3 sessions in 93 days (13.29 weeks): 0.23 a week. 24 km of the 69 km run in the period is 35%. The middle of 290, 295 and 300 is 295 (4:55); the other runs'
    // middle is 330 (5:30). The 3 months before have 1 session in 2 runs: 2 more.
    expect(readings()).toEqual([
      ['Sessions', '3', 'About 0.2 a week'],
      ['Distance in them', '24.0 km', '35% of everything you ran in the period'],
      ['Middle pace', '4:55 /km', 'Your other runs: 5:30 /km'],
      ['Against the 3 months before', '2 more', 'That stretch had 1 in 2 runs.'],
    ]);
  });

  it('says "Under 0.1 a week" for a rate that would be written 0.0, and keeps "About 0.1 a week" from 0.05', async () => {
    // One session (the workout of 10 October) and an ordinary run on 10 May. Over all time, 159 days (22.7 weeks), that is 0.044 a week; over the 3 months, 93 days (13.3 weeks), 0.075.
    served = runs().filter((item) => item.id === 1 || item.id === 21);
    renderPage('/analysis/intensity?range=all');
    await ready();
    expect(readings()[0]).toEqual(['Sessions', '1', 'Under 0.1 a week']);
    cleanup();
    renderPage();
    await ready();
    expect(readings()[0]).toEqual(['Sessions', '1', 'About 0.1 a week']);
  });

  it('says "1 run", not "1 runs", when the stretch before had a single run', async () => {
    // Without the workout of 1 June the 3 months before hold the ordinary run of 10 May and nothing else.
    served = runs().filter((item) => item.id !== 20);
    renderPage();
    await ready();
    expect(readings()[3]).toEqual(['Against the 3 months before', '3 more', 'That stretch had 0 in 1 run.']);
  });

  it('lists the sessions newest first with the day, the run (a link to its page), the type, the distance, the time, the pace and the heart rate', async () => {
    renderPage();
    await ready();
    expect(rows()).toHaveLength(3);
    expect(cells(rows()[0])).toEqual(['Oct 10, 2026', 'Run 1', 'Workout', '8.0 km', '38:40', '4:50 /km', '165 / 178 bpm']);
    expect(cells(rows()[1])).toEqual(['Sep 20, 2026', 'Run 2', 'Workout', '6.0 km', '30:00', '5:00 /km', '160 / 175 bpm']);
    expect(cells(rows()[2])).toEqual(['Aug 30, 2026', 'Run 3', 'Race', '10.0 km', '49:10', '4:55 /km', '172 / 186 bpm']);
    expect(within(rows()[0]).getByRole('link', { name: 'Run 1' })).toHaveAttribute('href', '/runs/1');
    expect(screen.getByText(t('quality_sessions.table_hint'))).toBeInTheDocument();
  });

  it('gives the formula and links to it', async () => {
    renderPage();
    await ready();
    expect(screen.getByRole('link', { name: t('methods.link') })).toHaveAttribute('href', methodsDocUrl('quality-sessions'));
    expect(screen.getByText(/Manual types take priority\./)).toBeInTheDocument();
  });
});

describe('choosing', () => {
  it('counts the long runs when they are turned on, in the address, and takes them off again with the address back to nothing', async () => {
    renderPage();
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Long runs' }));
    expect(search()).toBe('?types=workout%2Crace%2Clong');
    expect(rows()).toHaveLength(4);
    // Newest first: the two workouts, then the long run of 1 September, then the race of 30 August.
    expect(rows().map((row) => cells(row)[2])).toEqual(['Workout', 'Workout', 'Long run', 'Race']);
    expect(readings()[0][1]).toBe('4');
    expect(readings()[1][1]).toBe('44.0 km');
    await userEvent.click(screen.getByRole('button', { name: 'Long runs' }));
    expect(search()).toBe('');
    expect(rows()).toHaveLength(3);
  });

  it('counts one type only when the others are turned off', async () => {
    renderPage();
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Workouts' }));
    expect(search()).toBe('?types=race');
    expect(rows()).toHaveLength(1);
    expect(cells(rows()[0])[2]).toBe('Race');
  });

  it('says to turn a type on when none is, and keeps the choices to change it', async () => {
    renderPage('/analysis/intensity?types=none');
    await screen.findByRole('heading', { name: t('quality_sessions.empty_no_types_title') });
    expect(screen.getByText(t('quality_sessions.empty_no_types_body'))).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Workouts', pressed: false })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Workouts' }));
    expect(search()).toBe('?types=workout');
  });

  it('follows the period: 6 months holds the workout of June too, 1 year and all time say what they have before them', async () => {
    renderPage('/analysis/intensity?range=6m');
    await ready();
    expect(pressed('6 months')).toBeInTheDocument();
    expect(rows()).toHaveLength(4);
    // The 6 months before, from 15 October 2025, hold no run at all: nothing to compare with.
    expect(readings()[3]).toEqual(['Against the 6 months before', '--', 'You did not run in that stretch, so there is nothing to compare with.']);
    cleanup();
    renderPage('/analysis/intensity?range=all');
    await ready();
    expect(readings()[3][0]).toBe('Latest session');
    expect(readings()[3][1]).toBe('Oct 10, 2026');
    expect(readings()[3][2]).toBe('Run 1');
    expect(search()).toBe('?range=all');
  });

  it('opens on what the address says, and takes a value that is none of the choices for the default', async () => {
    renderPage('/analysis/intensity?types=race&range=1y');
    await ready();
    expect(pressed('Races')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Workouts', pressed: false })).toBeInTheDocument();
    expect(pressed('1 year')).toBeInTheDocument();
    cleanup();
    renderPage('/analysis/intensity?types=sprint&range=forever');
    await ready();
    expect(pressed('Workouts')).toBeInTheDocument();
    expect(pressed('Races')).toBeInTheDocument();
    expect(pressed('3 months')).toBeInTheDocument();
  });

  it('keeps the period in the address, and drops it when it is the default again', async () => {
    renderPage();
    await ready();
    await userEvent.click(screen.getByRole('button', { name: '1 year' }));
    expect(search()).toBe('?range=1y');
    await userEvent.click(screen.getByRole('button', { name: '3 months' }));
    expect(search()).toBe('');
  });
});

describe('with nothing to show, and runs that say little', () => {
  it.each(['en', 'zh-CN'])('automatically lists unlabelled sessions with a translated reason in %s', async (lang) => {
    state.lang = lang;
    served = runsWithNoTypes();
    const { container } = renderPage();
    await ready();
    await screen.findByRole('table', { name: t('quality_sessions.table_label') });
    expect(rows().length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.quality-sessions-v2__automatic').length).toBeGreaterThan(0);
    expect(container.textContent).toContain(t('quality_sessions.automatic'));
    expect(container.textContent).not.toMatch(/quality_sessions\.|run_labels\./);
    await userEvent.click(screen.getByRole('button', { name: t('quality_sessions.type_workout') }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('explains detection when the unlabelled runs have no quality-session evidence', async () => {
    served = runsWithNoTypes().filter(run => run.distanceKm < 16).map(run => ({ ...run, movingTimeSeconds: run.distanceKm * 330 }));
    renderPage();
    expect(await screen.findByRole('heading', { name: t('quality_sessions.empty_title') })).toBeInTheDocument();
    expect(screen.getByText(t('quality_sessions.empty_body'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('quality_sessions.empty_action') })).toHaveAttribute('href', '/runs');
    expect(screen.getByRole('link', { name: t('quality_sessions.empty_log') })).toHaveAttribute('href', '/runs#training-log');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('is the same for a runner with no run at all', async () => {
    served = [];
    renderPage();
    expect(await screen.findByRole('heading', { name: t('quality_sessions.empty_title') })).toBeInTheDocument();
  });

  it('gives the whole name of a run as the title of its link, so a name the column cuts short can still be read, and no title for a run with no name', async () => {
    const longName = 'Séance de fractionné très longue au bord du canal Saint-Martin avec Zoë et les amis du club 🏃 — 10 × 400 m';
    served = runs().map((item) => (item.id === 1 ? { ...item, name: longName } : item.id === 2 ? { ...item, name: '' } : item));
    renderPage();
    await ready();
    expect(within(rows()[0]).getByRole('link', { name: longName })).toHaveAttribute('title', longName);
    expect(within(rows()[1]).getByRole('link', { name: 'A run with no name' })).not.toHaveAttribute('title');
  });

  it('writes a dash for a heart rate that is not there, one figure when only one is, and says "a run with no name" for a run with none', async () => {
    served = runs().map((item) => {
      if (item.id === 1) return { ...item, name: '', averageHeartRate: null, maxHeartRate: null };
      if (item.id === 2) return { ...item, maxHeartRate: null };
      if (item.id === 3) return { ...item, averageHeartRate: 0 };
      return item;
    });
    renderPage();
    await ready();
    expect(cells(rows()[0]).slice(1, 2)).toEqual(['A run with no name']);
    expect(cells(rows()[0])[6]).toBe('--');
    expect(cells(rows()[1])[6]).toBe('160 bpm average');
    expect(cells(rows()[2])[6]).toBe('186 bpm highest');
  });
});

describe('miles', () => {
  it('writes the distance and the pace in the runner\'s unit', async () => {
    state.unit = 'mile';
    renderPage();
    await ready();
    // 24 km is 14.9 mi; 295 s/km is 475 s a mile (7:55); the other runs' 330 s/km is 531 (8:51); the first session, 290 s/km, is 467 s a mile (7:47).
    expect(readings()[1][1]).toBe('14.9 mi');
    expect(readings()[2]).toEqual(['Middle pace', '7:55 /mi', 'Your other runs: 8:51 /mi']);
    expect(cells(rows()[0])[3]).toBe('5.0 mi');
    expect(cells(rows()[0])[5]).toBe('7:47 /mi');
  });
});

describe('in Chinese', () => {
  it('is translated all through, and no key shows', async () => {
    state.lang = 'zh-CN';
    const { container } = renderPage();
    await screen.findByRole('heading', { level: 2, name: '质量训练课' });
    await screen.findByRole('table', { name: t('quality_sessions.table_label') });
    expect(container.textContent).not.toMatch(/quality_sessions\.|run_labels\./);
    expect(screen.getByRole('button', { name: '训练课', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3 个月', pressed: true })).toBeInTheDocument();
    expect(readings()[0]).toEqual(['训练课次数', '3', '平均每周约 0.2 次']);
    expect(readings()[3][1]).toBe('多 2 次');
    expect(readings()[3][2]).toBe('那段时间有 1 次，共 2 次跑步。');
    expect(cells(rows()[0])).toEqual(['2026年10月10日', 'Run 1', '训练课', '8.0 公里', '38:40', '4:50 /公里', '165 / 178 次/分']);
  });

  it('says that a session is rare in Chinese too, with no number written 0.0', async () => {
    state.lang = 'zh-CN';
    served = runs().filter((item) => item.id === 1 || item.id === 21);
    renderPage('/analysis/intensity?range=all');
    await screen.findByRole('table', { name: t('quality_sessions.table_label') });
    expect(readings()[0]).toEqual(['训练课次数', '1', '平均每周不到 0.1 次']);
  });

  it('writes the empty state in Chinese with Chinese punctuation', async () => {
    state.lang = 'zh-CN';
    served = runsWithNoTypes().filter(run => run.distanceKm < 16).map(run => ({ ...run, movingTimeSeconds: run.distanceKm * 330 }));
    renderPage();
    expect(await screen.findByRole('heading', { name: '这段时间没有质量训练课' })).toBeInTheDocument();
    const body = screen.getByText(t('quality_sessions.empty_body')).textContent;
    expect(body.replace(/\d+:\d+/g, '')).not.toMatch(/[,:;]|\.(?!\d)/);
  });
});
