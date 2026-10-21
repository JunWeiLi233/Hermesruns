import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { methodsDocUrl } from '../../../utils/methodsDoc';
import PaceCurve from '../PaceCurve';
import { noPoints, paceCurve, roughFit, twoPoints } from './paceCurveFixtures';

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
const reads = () => apiJson.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/api/training/pace-curve'));

function Where() {
  const location = useLocation();
  return <span data-testid="where">{`${location.pathname}${location.search}`}</span>;
}

function renderPage(entry = '/analysis') {
  return render(<MemoryRouter initialEntries={[entry]}><Where /><PaceCurve /></MemoryRouter>);
}

async function ready() {
  await screen.findByRole('heading', { level: 2, name: t('pace_curve.title') });
  await screen.findByRole('img');
}

beforeEach(() => {
  state.lang = 'en';
  state.unit = 'km';
  served = paceCurve();
  apiJson.mockReset();
  apiJson.mockImplementation(async (url) => {
    if (String(url).startsWith('/api/training/pace-curve')) {
      if (served instanceof Error) throw served;
      return typeof served === 'function' ? served(String(url)) : served;
    }
    return {};
  });
});
afterEach(() => cleanup());

describe('loading and failing', () => {
  it('is busy with a skeleton until the curve is there, asks for six months, and sits under Analysis', async () => {
    const { container } = renderPage();
    expect(container.querySelector('.pace-curve-v2')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(t('pace_curve.loading'));
    expect(container.querySelector('.page-skeleton__block')).toBeInTheDocument();

    await ready();
    expect(container.querySelector('.pace-curve-v2')).not.toHaveAttribute('aria-busy');
    expect(reads()).toEqual(['/api/training/pace-curve?days=180']);
    expect(screen.queryByTestId('chrome')).not.toBeInTheDocument();
    expect(container.querySelector('h1')).not.toBeInTheDocument();
  });

  it('says so, with a way to try again, when the curve cannot be loaded', async () => {
    served = new Error('down');
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(t('pace_curve.error'));

    served = paceCurve();
    await userEvent.click(screen.getByRole('button', { name: t('pace_curve.retry') }));
    await ready();
  });

  it('treats an answer without the parts it draws as a failed load', async () => {
    served = { today: '2026-10-10', points: [] };
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(t('pace_curve.error'));
  });

  it('says there is nothing here for a window with no effort, and for all time', async () => {
    served = noPoints();
    renderPage();
    expect(await screen.findByRole('heading', { level: 2, name: t('pace_curve.empty_title') })).toBeInTheDocument();
    expect(screen.getByText(/Try a longer window/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();

    cleanup();
    renderPage('/analysis?days=all');
    expect(await screen.findByText(/None of your runs has a best effort yet/)).toBeInTheDocument();
  });
});

describe('the window', () => {
  it('offers three months, six, twelve and all time, with six pressed to begin with', async () => {
    renderPage();
    await ready();
    const group = screen.getByRole('group', { name: t('pace_curve.window_label') });
    const buttons = within(group).getAllByRole('button');

    expect(buttons.map((button) => button.textContent)).toEqual(['3 months', '6 months', '12 months', 'All time']);
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false']);
  });

  it('asks for another window and keeps it in the address, and takes the address back to the default for six months', async () => {
    renderPage();
    await ready();

    await userEvent.click(screen.getByRole('button', { name: '12 months' }));
    await waitFor(() => expect(reads()).toContain('/api/training/pace-curve?days=365'));
    expect(screen.getByTestId('where')).toHaveTextContent('/analysis?days=365');
    expect(screen.getByRole('button', { name: '12 months' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'All time' }));
    await waitFor(() => expect(reads()).toContain('/api/training/pace-curve?days=all'));
    expect(screen.getByTestId('where')).toHaveTextContent('?days=all');

    await userEvent.click(screen.getByRole('button', { name: '6 months' }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/analysis$/);
  });

  it('starts from the window in the address, and takes anything it does not offer for six months', async () => {
    renderPage('/analysis?days=90');
    await ready();
    expect(reads()).toEqual(['/api/training/pace-curve?days=90']);
    expect(screen.getByRole('button', { name: '3 months' })).toHaveAttribute('aria-pressed', 'true');

    cleanup();
    apiJson.mockClear();
    renderPage('/analysis?days=7');
    await ready();
    expect(reads()).toEqual(['/api/training/pace-curve?days=180']);
  });
});

describe('the critical pace', () => {
  it('shows the critical pace, D prime and how well the line fits, in the unit the runner reads', async () => {
    renderPage();
    await ready();
    const tiles = screen.getByLabelText(t('pace_curve.tiles_label')).querySelectorAll('article');

    expect(tiles).toHaveLength(3);
    expect(tiles[0]).toHaveTextContent('Critical pace');
    expect(tiles[0]).toHaveTextContent('4:10 /km');
    expect(tiles[1]).toHaveTextContent('D′');
    expect(tiles[1]).toHaveTextContent('200 m');
    expect(tiles[2]).toHaveTextContent('Within 0.0%');
    expect(tiles[2]).toHaveTextContent('The worst of 4 efforts is this far from the line, in time.');
    expect(screen.queryByText(/read these numbers loosely/)).not.toBeInTheDocument();
  });

  it('counts miles for a runner who reads miles', async () => {
    state.unit = 'mile';
    renderPage();
    await ready();
    const tiles = screen.getByLabelText(t('pace_curve.tiles_label')).querySelectorAll('article');

    expect(tiles[0]).toHaveTextContent('6:42 /mi');                        // 250 s a kilometre x 1.609344
    const table = screen.getByRole('table');
    expect(within(table).getByRole('row', { name: /5 km/ })).toHaveTextContent('6:26 /mi');   // 240 s a kilometre
  });

  it('warns, and marks the fit, when the efforts do not line up well', async () => {
    served = roughFit();
    renderPage();
    await ready();

    expect(screen.getByText(/The efforts do not line up well \(the worst is 7\.4% off\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(t('pace_curve.tiles_label')).querySelectorAll('article')[2]).toHaveClass('is-watch');
    expect(screen.getByLabelText(t('pace_curve.tiles_label'))).toHaveTextContent('4:16 /km');
  });

  it.each([
    ['too_few_points', 2, /A line needs at least 3 best efforts that lasted 3 to 40 minutes\. This window has 2\./],
    ['narrow_range', 3, /too close in length for a line: the longest has to last at least 2\.5 times the shortest/],
    ['negative_d_prime', 4, /the longer ones are too fast for the shorter ones/],
    ['no_fit', 4, /more than 10% off\), so there is no critical pace to show/],
  ])('says why there is no line when the status is %s, and still draws the efforts', async (status, pointsUsed, words) => {
    const base = twoPoints();
    served = { ...base, model: { status, criticalSpeedMps: null, criticalPaceSecondsPerKm: null, dPrimeMeters: null, pointsUsed, maxErrorPercent: null } };
    const { container } = renderPage();
    await ready();

    expect(screen.getByText(words)).toBeInTheDocument();
    expect(screen.queryByLabelText(t('pace_curve.tiles_label'))).not.toBeInTheDocument();
    expect(container.querySelectorAll('.pace-curve-v2__dot')).toHaveLength(2);
    expect(container.querySelector('.pace-curve-v2__line')).not.toBeInTheDocument();
    expect(container.querySelector('.pace-curve-v2__critical')).not.toBeInTheDocument();
  });
});

describe('the chart', () => {
  it('is a picture with a name, a dot for each effort and the line through those it was fitted to', async () => {
    const { container } = renderPage();
    await ready();
    const picture = screen.getByRole('img');

    expect(picture).toHaveAccessibleName(/Pace \(\/km\) against how long each effort lasted/);
    expect(container.querySelectorAll('.pace-curve-v2__dot')).toHaveLength(6);
    expect(container.querySelectorAll('.pace-curve-v2__dot.is-in-line')).toHaveLength(4);
    expect(container.querySelectorAll('.pace-curve-v2__line')).toHaveLength(2);       // the dashed stretch and the solid one
    expect(container.querySelector('.pace-curve-v2__critical')).toBeInTheDocument();
    expect(container.querySelector('.pace-curve-v2__critical-label')).toHaveTextContent('Critical pace 4:10');
    expect(container.querySelector('.pace-curve-v2__legend')).toHaveAttribute('aria-hidden', 'true');
  });

  it('says what each dot is when the pointer rests on it', async () => {
    const { container } = renderPage();
    await ready();
    const titles = [...container.querySelectorAll('.pace-curve-v2__dot title')].map((node) => node.textContent);

    expect(titles).toHaveLength(6);
    expect(titles[1]).toBe('1 km: 3:20, 3:20 /km, Sep 11, 2026');
    expect(titles[4]).toBe('5 km: 20:00, 4:00 /km, Sep 14, 2026');
  });

  it('labels the time axis in seconds, minutes and hours, and the pace axis in minutes and seconds', async () => {
    const { container } = renderPage();
    await ready();
    const labels = [...container.querySelectorAll('.pace-curve-v2__svg text')].map((node) => node.textContent);

    expect(labels.some((label) => /^\d+ min$/.test(label))).toBe(true);
    expect(labels.some((label) => /^\d+:\d\d$/.test(label))).toBe(true);
  });
});

describe('the table', () => {
  it('lists each effort with its time, pace, day and run, and says which of them the line was fitted through', async () => {
    renderPage();
    await ready();
    const table = screen.getByRole('table', { name: t('pace_curve.table_label') });
    const rows = within(table).getAllByRole('row').slice(1);

    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent))
      .toEqual(['Distance', 'Time', 'Pace', 'Day', 'Run', 'In the line']);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveTextContent('½ mile');
    expect(rows[0]).toHaveTextContent('2:31');
    expect(rows[0]).toHaveTextContent('No, under 3 min');
    expect(rows[1]).toHaveTextContent('1 km');
    expect(rows[1]).toHaveTextContent('3:20');
    expect(rows[1]).toHaveTextContent('Yes');
    expect(rows[4]).toHaveTextContent('5 km');
    expect(rows[4]).toHaveTextContent('20:00');
    expect(rows[5]).toHaveTextContent('10 km');
    expect(rows[5]).toHaveTextContent('40:50');
    expect(rows[5]).toHaveTextContent('No, over 40 min');
    expect(within(rows[1]).getByRole('link', { name: 'Run 2' })).toHaveAttribute('href', '/runs/101');
  });

  it('marks a time the runner typed in', async () => {
    const answer = paceCurve();
    answer.points[4] = { ...answer.points[4], edited: true };
    served = answer;
    renderPage();
    await ready();

    expect(within(screen.getAllByRole('row')[5]).getByText('typed')).toBeInTheDocument();
  });

  it('has no word about the line for efforts when there is none', async () => {
    served = twoPoints();
    renderPage();
    await ready();

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    rows.forEach((row) => expect(row.lastElementChild).toHaveTextContent('–'));
  });
});

describe('what is not yet counted and the rule', () => {
  it('says some runs are still being analysed, and loads again on request', async () => {
    served = paceCurve({ overrides: { complete: false } });
    renderPage();
    await ready();
    expect(screen.getByText(/Some of your runs are still being analysed/)).toBeInTheDocument();

    served = paceCurve();
    await userEvent.click(screen.getByRole('button', { name: t('pace_curve.refresh') }));
    await waitFor(() => expect(screen.queryByText(/still being analysed/)).not.toBeInTheDocument());
    expect(reads().length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the curve on screen and says it may be out of date when a reload fails', async () => {
    served = paceCurve({ overrides: { complete: false } });
    renderPage();
    await ready();

    served = new Error('down');
    await userEvent.click(screen.getByRole('button', { name: t('pace_curve.refresh') }));
    expect(await screen.findByText(t('pace_curve.stale'), { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('ends with how it is worked out and a link to the section that holds the rule', async () => {
    renderPage();
    await ready();

    expect(screen.getByText(/The line is distance = D′ \+ critical speed × time, fitted by least squares through the efforts that lasted 3 to 40 minutes/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('methods.link') })).toHaveAttribute('href', methodsDocUrl('pace-curve-and-critical-pace'));
    expect(screen.getByRole('link', { name: 'Analysis' })).toHaveAttribute('href', '/analysis');
    expect(screen.getByRole('link', { name: 'Race predictions' })).toHaveAttribute('href', '/prediction/10k');
  });
});

describe('in Chinese', () => {
  it('speaks Chinese: the title, the windows, the critical pace and the table', async () => {
    state.lang = 'zh-CN';
    renderPage();
    await screen.findByRole('heading', { level: 2, name: '配速曲线' });
    await screen.findByRole('img');

    expect(screen.getByRole('button', { name: '6 个月' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('临界配速、D′ 和拟合程度')).toHaveTextContent('4:10 /km');
    expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((cell) => cell.textContent))
      .toEqual(['距离', '用时', '配速', '日期', '跑步', '用于拟合']);
    expect(screen.getByRole('link', { name: '计算方式' })).toBeInTheDocument();
  });
});
