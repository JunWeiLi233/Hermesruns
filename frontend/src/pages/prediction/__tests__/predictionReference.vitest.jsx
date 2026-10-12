import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PredictionDetail from '../PredictionDetail';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { apiJson } from '../../../api';
import { estimateCurrentVdot, predictRaceTimeCalibrated, RACE_DISTANCES } from '../../../utils/vdot';

const state = vi.hoisted(() => ({ lang: 'en', chartData: null }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'runner@example.test' }) }));
vi.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: state.lang, t: (key, values = {}) => {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
} }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: ({ initials }) => <span data-testid="avatar">{initials}</span> }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));
vi.mock('react-chartjs-2', () => ({ Line: ({ data, ...props }) => { state.chartData = data; return <div data-testid="forecast-chart" aria-label={props['aria-label']} />; } }));

let activities;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-08T16:00:00Z'));
  state.lang = 'en';
  state.chartData = null;
  activities = Array.from({ length: 35 }, (_, index) => {
    const date = new Date('2026-10-07T12:00:00Z');
    date.setUTCDate(date.getUTCDate() - index);
    return { id: index + 1, startTime: date.toISOString(), name: 'Morning Run', distanceKm: 10,
      movingTimeSeconds: 2800 + index * 12, averageHeartRate: 150, maxHeartRate: 190 };
  });
  apiJson.mockImplementation(async (path) => (path === '/api/profile/me' ? { displayName: 'Zed Runner', email: 'runner@example.test' } : activities));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

function ChangeDistance() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/prediction/marathon')}>Switch distance</button>;
}

function renderPage(key = 'marathon') {
  return render(<MemoryRouter initialEntries={[`/prediction/${key}`]}><Routes>
    <Route path="/prediction/:distKey" element={<><PredictionDetail /><ChangeDistance /></>} />
    <Route path="/today-run" element={<h1>Today destination</h1>} />
    <Route path="/analysis" element={<h1>Analysis destination</h1>} />
  </Routes></MemoryRouter>);
}

async function openPage(key = 'marathon') {
  const result = renderPage(key);
  await screen.findByRole('heading', { level: 1, name: state.lang === 'zh-CN' ? zh.analysis.pred_cockpit_title : en.analysis.pred_cockpit_title });
  return result;
}

function displayedTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = String(Math.round(seconds % 60)).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}` : `${minutes}:${remainder}`;
}

it.each(RACE_DISTANCES)('uses the real forecast for $key and preserves the shell', async (distance) => {
  const { container } = await openPage(distance.key);
  const current = estimateCurrentVdot(activities);
  const expectedTime = predictRaceTimeCalibrated(current.representativeVdot, distance.meters, activities) * 60;
  expect(container.querySelector('.prediction-forecast-time')).toHaveTextContent(displayedTime(expectedTime));
  expect(container.querySelector('.runner-shell-topbar')).toBeInTheDocument();
  expect(container.querySelector('.runner-shell-sidebar')).toBeInTheDocument();
  expect(container.querySelector('.prediction-v2-kicker')).toHaveTextContent(distance.labelEn);
  expect(container.querySelector('.prediction-v2-confidence')).not.toBeInTheDocument();
  expect(container.querySelectorAll('.prediction-v2-ladder li')).toHaveLength(4);
  expect(state.chartData.datasets).toHaveLength(1);
  expect(state.chartData.datasets[0].data.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
  expect(apiJson).toHaveBeenCalledWith('/api/activities', {});
});

it('updates the forecast and chart when the route distance changes', async () => {
  const { container } = await openPage('5k');
  const priorTime = container.querySelector('.prediction-forecast-time').textContent;
  const priorTrend = state.chartData.datasets[0].data.at(-1);
  fireEvent.click(screen.getByRole('button', { name: 'Switch distance' }));
  await screen.findByRole('heading', { level: 1, name: en.analysis.pred_cockpit_title });
  expect(container.querySelector('.prediction-v2-kicker')).toHaveTextContent('Marathon');
  expect(container.querySelector('.prediction-forecast-time').textContent).not.toBe(priorTime);
  expect(state.chartData.datasets[0].data.at(-1)).toBeGreaterThan(priorTrend);
});

it.each([
  ['.prediction-v2-primary', 'Today destination'],
  ['.prediction-v2-link', 'Analysis destination'],
])('keeps the action at %s working', async (selector, destination) => {
  const { container } = await openPage();
  fireEvent.click(container.querySelector(selector));
  expect(screen.getByRole('heading', { name: destination })).toBeInTheDocument();
});

it('shows the automatic weather correction in the forecast and trend', async () => {
  activities = activities.map((run) => ({ ...run, pacePenaltySecPerKm: 20, weatherAdjustedMovingTimeSeconds: run.movingTimeSeconds - 200 }));
  const { container } = await openPage();
  const current = estimateCurrentVdot(activities);
  const expected = predictRaceTimeCalibrated(current.adjustedVdot, 42195, activities, { weatherAdjustedAnchors: true }) * 60;
  expect(container.querySelector('.prediction-forecast-time')).toHaveTextContent(displayedTime(expected));
  expect(container.querySelector('.prediction-v2-weather')).toHaveTextContent(en.analysis.vdot_raw);
  expect(container.querySelector('.prediction-v2-weather')).toHaveTextContent(en.analysis.vdot_weather_adjusted);
  expect(state.chartData.datasets).toHaveLength(2);
});

// BUG-014: the Race row was a fixed share of VO2max, the same pace for every distance, so the marathon page offered 3:24 under a
// prediction of 3:58. The race row is the prediction.
it.each(RACE_DISTANCES)('makes the Race row of Pace by effort the predicted $key time and its pace', async (distance) => {
  const { container } = await openPage(distance.key);
  const rows = Array.from(container.querySelectorAll('.prediction-v2-ladder li'));
  expect(rows).toHaveLength(4);
  const headline = container.querySelector('.prediction-forecast-time').textContent;
  const race = rows.find((row) => row.classList.contains('is-race'));
  expect(race.querySelector('.prediction-v2-ladder-time')).toHaveTextContent(headline);
  const seconds = headline.split(':').map(Number).reduce((total, part) => total * 60 + part, 0);
  const pace = Math.round(seconds / (distance.meters / 1000));
  expect(race.querySelector('.prediction-v2-ladder-copy span').textContent).toContain(`${Math.floor(pace / 60)}:${String(pace % 60).padStart(2, '0')}`);
  // The ladder steps up: every row after the first is a faster pace, so a shorter time over the same distance.
  const times = rows.map((row) => row.querySelector('.prediction-v2-ladder-time').textContent.split(':').map(Number).reduce((total, part) => total * 60 + part, 0));
  expect(times).toEqual([...times].sort((a, b) => b - a));
  expect(new Set(times).size).toBe(4);
});

// BUG-015: the prediction also leaned on the best run of the last 180 days, which the page (90 days) does not list.
it('is not moved by a fast run older than the 90 days the page talks about', async () => {
  const { container } = await openPage('5k');
  const before = container.querySelector('.prediction-forecast-time').textContent;
  cleanup();
  const old = new Date('2026-10-07T12:00:00Z');
  old.setUTCDate(old.getUTCDate() - 130);
  activities = [...activities, { id: 999, startTime: old.toISOString(), name: 'Old race', distanceKm: 5, movingTimeSeconds: 1000,
    averageHeartRate: 175, maxHeartRate: 190 }];
  const second = await openPage('5k');
  expect(second.container.querySelector('.prediction-forecast-time').textContent).toBe(before);
});

describe('the prediction history range', () => {
  const pill = (container) => container.querySelector('.prediction-trend-pills');

  beforeEach(() => window.localStorage.clear());

  it('offers 1, 3 and 6 months, starts on 3, and says which range and how many points', async () => {
    const { container } = await openPage('10k');
    const group = screen.getByRole('group', { name: en.analysis.pred_trend_range_label });
    expect(Array.from(group.querySelectorAll('button')).map((button) => button.textContent)).toEqual(['1 month', '3 months', '6 months']);
    expect(screen.getByRole('button', { name: '3 months' })).toHaveAttribute('aria-pressed', 'true');
    expect(pill(container)).toHaveTextContent('Last 90 days');
    // 35 daily runs: all 35 fall in 90 days.
    expect(pill(container)).toHaveTextContent('35 data points');
    expect(state.chartData.labels).toHaveLength(35);
  });

  it('shows only the last month when asked, remembers the choice and says it in the chart label', async () => {
    const { container } = await openPage('10k');
    fireEvent.click(screen.getByRole('button', { name: '1 month' }));
    expect(screen.getByRole('button', { name: '1 month' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '3 months' })).toHaveAttribute('aria-pressed', 'false');
    expect(pill(container)).toHaveTextContent('Last 30 days');
    expect(state.chartData.labels.length).toBeLessThan(35);
    expect(state.chartData.labels.length).toBeGreaterThanOrEqual(28);
    expect(window.localStorage.getItem('hermes_prediction_history_range')).toBe('1m');
    expect(screen.getByLabelText(/predicted time over the last 30 days/)).toBeInTheDocument();
  });

  it('reads the remembered choice when the page opens', async () => {
    window.localStorage.setItem('hermes_prediction_history_range', '6m');
    const { container } = await openPage('10k');
    expect(screen.getByRole('button', { name: '6 months' })).toHaveAttribute('aria-pressed', 'true');
    expect(pill(container)).toHaveTextContent('Last 180 days');
  });

  it('falls back to 3 months for a choice it does not know', async () => {
    window.localStorage.setItem('hermes_prediction_history_range', '9m');
    await openPage('10k');
    expect(screen.getByRole('button', { name: '3 months' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('says so, and offers a longer range, when the chosen one holds no runs', async () => {
    activities = activities.map((run) => ({ ...run, startTime: new Date(new Date(run.startTime).getTime() - 100 * 86_400_000).toISOString() }));
    const { container } = await openPage('10k');
    fireEvent.click(screen.getByRole('button', { name: '1 month' }));
    expect(container.querySelector('.prediction-trend-chart')).toHaveTextContent('No predictions in the last 30 days');
    expect(screen.queryByTestId('forecast-chart')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '6 months' }));
    expect(screen.getByTestId('forecast-chart')).toBeInTheDocument();
  });

  it('leaves the change shown in the hero where it was whatever the card shows', async () => {
    const { container } = await openPage('10k');
    const hero = container.querySelector('.prediction-v2-delta')?.textContent;
    fireEvent.click(screen.getByRole('button', { name: '1 month' }));
    expect(container.querySelector('.prediction-v2-delta')?.textContent).toBe(hero);
  });
});

it('avoids invented forecasts when there are no activities', async () => {
  activities = [];
  const { container } = await openPage();
  expect(container.querySelector('.prediction-forecast-time')).toHaveTextContent('--');
  expect(container.querySelector('.prediction-v2-hero')).toHaveTextContent(en.analysis.pred_cockpit_basis_empty);
  expect(container.querySelectorAll('.prediction-v2-ladder li')).toHaveLength(0);
  expect(screen.queryByTestId('forecast-chart')).not.toBeInTheDocument();
  expect(container.querySelector('.prediction-v2-weather')).not.toBeInTheDocument();
});

// BUG-032: a failed request used to be drawn as the page of a runner with no runs ("not enough data yet", 0 samples).
it('says the runs could not be loaded when the request fails, invents no forecast, and asks again on request', async () => {
  const answerAsBefore = apiJson.getMockImplementation();
  let refused = false;
  apiJson.mockImplementation(async (path, ...rest) => {
    if (path === '/api/activities' && !refused) {
      refused = true;
      throw new Error('Unavailable');
    }
    return answerAsBefore(path, ...rest);
  });
  const { container } = renderPage();
  expect(await screen.findByRole('alert')).toHaveTextContent(en.analysis.stitch_load_error);
  expect(container.querySelector('.prediction-v2-hero')).not.toBeInTheDocument();
  expect(container.querySelector('.prediction-forecast-time')).not.toBeInTheDocument();
  expect(screen.queryByTestId('forecast-chart')).not.toBeInTheDocument();
  expect(container.querySelector('.runner-shell-topbar')).toBeInTheDocument();
  expect(container.querySelector('.runner-shell-sidebar')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: en.analysis.stitch_load_retry }));
  await screen.findByRole('heading', { level: 1, name: en.analysis.pred_cockpit_title });
  expect(container.querySelector('.prediction-forecast-time')).not.toHaveTextContent('--');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

// BUG-028: the circle at the top right took its letter from the address ("R" for runner@...) here and from the display name
// everywhere else.
it('shows the initial of the profile display name in the circle at the top right, not the start of the address', async () => {
  await openPage('10k');
  await waitFor(() => expect(screen.getByTestId('avatar')).toHaveTextContent('Z'));
});

it('renders Chinese copy without unresolved placeholders', async () => {
  state.lang = 'zh-CN';
  const { container } = await openPage('half');
  expect(container.querySelector('.prediction-v2-kicker')).toHaveTextContent('半程马拉松');
  expect(container.querySelector('.prediction-v2-ladder')).toHaveTextContent(zh.analysis.pred_effort_title);
  expect(container.querySelector('.prediction-v2').textContent).not.toMatch(/\{(?:count|date|dist|value)\}/);
});
