import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Schedule from '../Schedule';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { apiJson } from '../../../api';
import { cachedApiJson } from '../../../api/resourceCache';

const preferences = vi.hoisted(() => ({ unit: 'km', lang: 'en' }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'runner@example.test' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: preferences.lang, t: (key, values = {}) => {
  const dictionary = preferences.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
} }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => preferences }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

let today;
let upcoming;
let schedule;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T16:00:00Z'));
  localStorage.clear();
  preferences.unit = 'km';
  preferences.lang = 'en';
  today = {
    scheduledDate: '2026-10-10', workoutType: 'REST', plannedDistanceKm: null, plannedDurationMinutes: null,
    notes: null, intent: 'rest', reasonCode: 'scheduled_rest', phase: 'build', readinessAdjusted: false,
  };
  upcoming = {
    scheduledDate: '2026-10-11', workoutType: 'LONG_RUN', plannedDistanceKm: 11, plannedDurationMinutes: 72,
    notes: null, intent: 'long_run', reasonCode: 'aerobic_progression', phase: 'build', readinessAdjusted: false,
    targetPaceMinSecondsPerKm: 375, targetPaceMaxSecondsPerKm: 410,
  };
  schedule = [today, upcoming];
  const state = { readinessScore: 77, currentReadinessScore: 77, readinessLoad: 85, readinessAvailability: { trainingLoad: true } };
  cachedApiJson.mockImplementation(async url => {
    if (url === '/api/profile/me') return { displayName: 'Runner' };
    if (url === '/api/activities') return [7, 5, 6, 6, 10, 6, 6, 10, 6, 6, 10, 6, 6, 10].map((distanceKm, index) => ({
      id: index + 1, startTime: new Date(Date.UTC(2026, 9, 9 - index * 2, 12)).toISOString(),
      distanceKm, movingTimeSeconds: distanceKm * 360,
    }));
    return [];
  });
  apiJson.mockImplementation(async url => {
    if (url === '/api/coach/state') return state;
    if (url === '/api/coach/today') return { today, state };
    if (url === '/api/coach/schedule?days=14') return schedule;
    return [];
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openPage() {
  const result = render(<MemoryRouter initialEntries={['/schedule']}><Routes>
    <Route path="/schedule" element={<Schedule />} />
    <Route path="/today-run" element={<h1>Today's run destination</h1>} />
  </Routes></MemoryRouter>);
  const dictionary = preferences.lang === 'zh-CN' ? zh : en;
  await screen.findByRole('heading', { level: 1, name: dictionary.schedule.hero_title });
  return result;
}

it.each(['en', 'zh-CN'])('explains the upcoming long run without replacing today\'s rest session in %s', async lang => {
  preferences.lang = lang;
  const dictionary = lang === 'en' ? en : zh;
  const { container } = await openPage();
  expect(container.querySelector('.schedule-plan-day.is-today')).toHaveTextContent(dictionary.profile.dashboard_workout_rest);
  const longRunDay = screen.getByRole('button', { name: new RegExp(dictionary.profile.dashboard_workout_long_run) });
  expect(longRunDay.closest('article')).toHaveTextContent(/11\.0\s*(km|公里)/);

  const nextCard = container.querySelector('.schedule-plan-next-card');
  expect(within(nextCard).getByRole('heading')).toHaveTextContent(dictionary.profile.dashboard_workout_long_run);
  expect(nextCard).toHaveTextContent(dictionary.today_run.personalized_reason_aerobic_progression);
  expect(nextCard).not.toHaveTextContent(dictionary.today_run.personalized_reason_scheduled_rest);
  fireEvent.click(within(nextCard).getByRole('button', { name: dictionary.schedule.open_session }));
  expect(within(nextCard).getByRole('button', { name: dictionary.training_plan.details })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.queryByRole('heading', { name: "Today's run destination" })).not.toBeInTheDocument();
});

it('keeps an explicit upcoming-session note', async () => {
  upcoming.notes = 'Keep this long run relaxed on the familiar loop.';
  const { container } = await openPage();
  expect(container.querySelector('.schedule-plan-next-card')).toHaveTextContent(upcoming.notes);
});

it.each(['en', 'zh-CN'].flatMap(lang => [
  'comeback', 'onboarding', 'build_consistency', 'load_data', 'goal_specific', 'quality_window',
].map(code => [lang, code])))('retains the already-neutral %s %s reason from the future session', async (lang, code) => {
  preferences.lang = lang;
  upcoming.reasonCode = code;
  upcoming.workoutType = code === 'quality_window' ? 'TEMPO' : 'EASY';
  const dictionary = lang === 'en' ? en : zh;
  const { container } = await openPage();
  const nextCard = container.querySelector('.schedule-plan-next-card');
  expect(nextCard.querySelector('.schedule-plan-next-content > p'))
    .toHaveTextContent(dictionary.today_run[`personalized_reason_${code}`]);
  expect(nextCard.querySelector('.schedule-plan-next-content > p')).not.toHaveTextContent(/\btoday\b|今天/i);
  expect(nextCard).not.toHaveTextContent(dictionary.today_run.personalized_reason_scheduled_rest);
});

it.each(['en', 'zh-CN'].flatMap(lang => [
  ['injury_protect', 'RECOVERY', 'Soreness and injury-risk signals call for a protective planned session.', '酸痛和伤病风险信号提示这次计划训练应以保护为主。'],
  ['readiness_protect', 'RECOVERY', 'Available readiness evidence calls for reduced intensity in this planned session.', '已有准备度数据提示这次计划训练应降低强度。'],
  ['readiness_limited', 'EASY', 'Wellness readings are incomplete. This planned session uses running history and conservative intensity; missing readings are not poor scores.', '健康数据不完整。这次计划训练参考跑步历史并保守安排强度；缺少数据不代表状态差。'],
  ['race_taper', 'EASY', 'This planned session supports the race taper by preserving sharpness while reducing fatigue.', '这次计划训练通过保留状态、减少疲劳来配合赛前减量。'],
  ['race_day', 'LONG_RUN', 'This planned session matches the race distance and goal saved in your plan.', '这次计划训练的目标与计划中保存的比赛距离和目标一致。'],
  ['high_load', 'RECOVERY', 'Recent load is above your established baseline, so this planned session helps you absorb it.', '近期负荷高于稳定基线，这次计划训练优先帮助吸收已有训练刺激。'],
  ['intensity_rebalance', 'EASY', 'Recent hard running is above the weekly target, so this planned session restores an easier intensity balance.', '近期高强度跑步已超过每周目标，这次计划训练会恢复更轻松的强度分布。'],
  ['readiness_data', 'EASY', 'Available wellness data was included when planning this session.', '这次训练的安排已纳入已有恢复与健康数据。'],
  ['recovery_after_hard', 'EASY', 'A hard session was completed recently, so this planned session stays easy to protect recovery spacing.', '距离上一次高强度训练时间较短，这次计划训练保持轻松以保证恢复间隔。'],
].map(([code, workoutType, english, chinese]) => [lang, code, workoutType, lang === 'en' ? english : chinese])))('uses neutral %s %s rationale for the future session', async (lang, code, workoutType, copy) => {
  preferences.lang = lang;
  upcoming.reasonCode = code;
  upcoming.workoutType = workoutType;
  const dictionary = lang === 'en' ? en : zh;
  const { container } = await openPage();
  expect(container.querySelector('.schedule-plan-day.is-today')).toHaveTextContent(dictionary.profile.dashboard_workout_rest);
  const nextCard = container.querySelector('.schedule-plan-next-card');
  expect(nextCard.querySelector('.schedule-plan-next-content > p')).toHaveTextContent(copy);
  expect(nextCard.querySelector('.schedule-plan-next-content > p')).not.toHaveTextContent(/\btoday\b|今天/i);
  expect(nextCard).not.toHaveTextContent(dictionary.today_run.personalized_reason_scheduled_rest);
});

it.each(['en', 'zh-CN'])('keeps the %s today-specific reason for a same-day upcoming session', async lang => {
  preferences.lang = lang;
  today.workoutType = 'EASY';
  today.reasonCode = 'readiness_protect';
  const dictionary = lang === 'en' ? en : zh;
  const { container } = await openPage();
  expect(container.querySelector('.schedule-plan-next-content > p')).toHaveTextContent(dictionary.today_run.personalized_reason_readiness_protect);
});

it.each(['en', 'zh-CN'].flatMap(lang => [undefined, null, 27, 'future_reason', 'invalid reason', ''].map(code => [lang, code])))('does not borrow today\'s reason for unknown upcoming %s %s', async (lang, code) => {
  preferences.lang = lang;
  upcoming.reasonCode = code;
  const dictionary = lang === 'en' ? en : zh;
  const { container } = await openPage();
  const nextCard = container.querySelector('.schedule-plan-next-card');
  expect(nextCard).toHaveTextContent(dictionary.today_run.reason_unavailable);
  expect(nextCard).not.toHaveTextContent(dictionary.today_run.personalized_reason_scheduled_rest);
  expect(nextCard).not.toHaveTextContent(/future_reason|invalid reason|personalized_reason_/);
});

it('keeps today\'s fallback when there is no upcoming session', async () => {
  schedule = [today];
  const { container } = await openPage();
  const nextCard = container.querySelector('.schedule-plan-next-card');
  expect(within(nextCard).getByRole('heading')).toHaveTextContent(en.today_run.personalized_title_rest);
  expect(nextCard).toHaveTextContent(en.today_run.personalized_reason_scheduled_rest);
});

it('selects a calendar day and opens today rather than the upcoming session', async () => {
  const { container } = await openPage();
  const todayDay = container.querySelector('.schedule-plan-day.is-today button');
  fireEvent.click(todayDay);
  expect(todayDay).toHaveAttribute('aria-pressed', 'true');
  const card = container.querySelector('.schedule-plan-next-card');
  expect(within(card).getByRole('heading')).toHaveTextContent(en.profile.dashboard_workout_rest);
  fireEvent.click(within(card).getByRole('button', { name: en.schedule.view_drills }));
  expect(screen.getByRole('heading', { name: "Today's run destination" })).toBeInTheDocument();
});

it('browses weeks, updates completion, and returns to the account current week', async () => {
  const { container } = await openPage();
  const originalWeek = container.querySelector('.schedule-plan-week-nav h2').textContent;
  fireEvent.click(screen.getByRole('button', { name: en.training_plan.nextWeek }));
  expect(container.querySelector('.schedule-plan-week-nav h2').textContent).not.toBe(originalWeek);
  expect(container.querySelector('.schedule-plan-day')).toHaveAttribute('aria-label', '2026-10-12');
  expect(container.querySelector('.schedule-plan-volume')).toHaveTextContent(/0\.0\s*km/);
  expect(container.querySelector('.schedule-plan-next-card')).toHaveTextContent(en.schedule.open_slot_copy);
  fireEvent.click(screen.getByRole('button', { name: en.schedule.this_week }));
  expect(container.querySelector('.schedule-plan-week-nav h2').textContent).toBe(originalWeek);
  expect(container.querySelector('.schedule-plan-day.is-today')).toHaveAttribute('aria-label', '2026-10-10');
});

it('keeps an upcoming session outside the visible week on its own date', async () => {
  upcoming.scheduledDate = '2026-10-12';
  const { container } = await openPage();
  const card = container.querySelector('.schedule-plan-next-card');
  expect(card.querySelector('.schedule-plan-next-content > span')).toHaveTextContent('Monday, Oct 12');
  expect(within(card).queryByRole('button', { name: en.schedule.view_drills })).not.toBeInTheDocument();
  fireEvent.click(within(card).getByRole('button', { name: en.schedule.open_session }));
  expect(container.querySelector('#schedule-session-details')).toHaveTextContent('Monday, October 12, 2026');
});
