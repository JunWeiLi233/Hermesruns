import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TodayRun from '../TodayRun';
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
vi.mock('../../../api', () => ({ apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

let payload;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-07T16:00:00Z'));
  localStorage.clear();
  preferences.unit = 'km';
  preferences.lang = 'en';
  payload = {
    profile: { displayName: 'Runner' },
    activities: Array.from({ length: 35 }, (_, index) => {
      const date = new Date('2026-10-06T12:00:00Z');
      date.setUTCDate(date.getUTCDate() - index);
      return { id: index + 1, startTime: date.toISOString(), distanceKm: 8, movingTimeSeconds: 2400, averageHeartRate: 140, shoeId: 1 };
    }),
    coachPayload: {
      today: { scheduledDate: '2026-10-07', workoutType: 'TEMPO', plannedDistanceKm: 10, plannedDurationMinutes: 50, targetPaceMinSecondsPerKm: 288, targetPaceMaxSecondsPerKm: 290, reasonCode: 'build_consistency' },
      state: { currentReadinessScore: 78, readinessVerdict: 'GO', readinessSleep: 82, readinessHrv: 74, readinessRhr: 66, readinessStress: 80, readinessLoad: 78,
        readinessAvailability: { sleep: true, hrv: true, restingHeartRate: true, stress: true, trainingLoad: true }, lastHrvStatus: 'BALANCED' },
    },
    weatherContext: { available: true, pacePenaltySecPerKm: 15 },
    races: [{ name: 'Chicago', distanceKm: 42.195, eventDate: '2026-10-11' }],
    shoes: [{ id: 1, brand: 'Saucony', model: 'Endorphin Speed 4', currentDistanceKm: 312, maxDistanceKm: 500, status: 'ACTIVE' }],
  };
  const original = { ...payload.coachPayload.today };
  apiJson.mockImplementation(async (url, options) => {
    if (url === '/api/coach/today/ease') {
      const enabled = JSON.parse(options.body).enabled;
      payload.coachPayload = { ...payload.coachPayload, today: enabled
        ? { ...original, workoutType: 'RECOVERY', plannedDistanceKm: 7.5, plannedDurationMinutes: 37, reasonCode: 'manual_ease' }
        : { ...original } };
      return payload.coachPayload;
    }
    return url === '/api/today/dashboard' ? payload : [];
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openPage() {
  // Real coach responses carry the account date; keep partial fixtures on this test's fixed day.
  if (payload.coachPayload?.today && !('scheduledDate' in payload.coachPayload.today)) {
    payload.coachPayload.today.scheduledDate = '2026-10-07';
  }
  const result = render(<MemoryRouter initialEntries={['/today-run']}><Routes>
    <Route path="/today-run" element={<TodayRun />} />
    <Route path="/schedule" element={<h1>Schedule destination</h1>} />
    <Route path="/shoes" element={<h1>Shoes destination</h1>} />
    <Route path="/races" element={<h1>Races destination</h1>} />
    <Route path="/runs" element={<h1>Runs destination</h1>} />
  </Routes></MemoryRouter>);
  await screen.findByRole('heading', { name: preferences.lang === 'zh-CN' ? zh.today_run.v2_coach_briefing : en.today_run.v2_coach_briefing });
  return result;
}

it('keeps the shell and actual data, and resets the entire easier session', async () => {
  const { container } = await openPage();
  expect(container.querySelector('.runner-shell-topbar')).toBeInTheDocument();
  expect(container.querySelector('.runner-shell-sidebar')).toBeInTheDocument();
  expect(container.querySelector('.tr-v2-gate-score')).toHaveTextContent('78/100');
  expect(container.querySelector('.tr-v2-race')).toHaveTextContent('4 days');
  expect(screen.getAllByRole('meter')).toHaveLength(4);
  expect(screen.getByRole('meter', { name: en.today_run.readiness_signal_sleep })).toHaveAttribute('aria-valuenow', '82');
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('10.0km');
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('50 min');
  const structure = screen.getByRole('group', { name: en.today_run.plan_title });
  expect(within(structure).getAllByRole('listitem')).toHaveLength(3);
  const bars = container.querySelectorAll('.tr-v2-structure-bar > span');
  expect(bars).toHaveLength(3);
  [...bars].forEach((bar) => expect(Number(bar.style.flexGrow)).toBe(1));
  expect(container.querySelectorAll('.tr-v2-structure-steps li')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: /Not feeling 100/ }));
  expect(apiJson).toHaveBeenCalledWith('/api/coach/today/ease', expect.objectContaining({ method: 'POST' }));
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Recovery'));
  expect(container.querySelector('.tr-v2-targets')).not.toHaveTextContent('10.0km');
  expect(container.querySelector('.tr-v2-targets')).not.toHaveTextContent('50 min');
  expect(screen.getByRole('button', { name: /Reset/ })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
  await waitFor(() => expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('10.0km'));
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('50 min');
});

it.each([
  ['.tr-v2-primary', 'Schedule destination'],
  ['.tr-v2-link', 'Schedule destination'],
  ['.tr-v2-shoe', 'Shoes destination'],
  ['.tr-v2-race', 'Races destination'],
])('preserves navigation from %s', async (selector, destination) => {
  const { container } = await openPage();
  fireEvent.click(container.querySelector(selector));
  expect(screen.getByRole('heading', { name: destination })).toBeInTheDocument();
});

it('keeps weather dismissal and expanded coaching context', async () => {
  const { container } = await openPage();
  const weather = container.querySelector('.tr-v2-weather');
  expect(weather).toHaveTextContent('+15');
  fireEvent.click(within(weather).getByRole('button'));
  expect(container.querySelector('.tr-v2-weather')).not.toBeInTheDocument();
  fireEvent.click(container.querySelector('.tr-v2-coach summary'));
  expect(container.querySelector('.tr-v2-coach details')).toHaveAttribute('open');
  expect(container.querySelector('.tr-v2-context dl')).toHaveTextContent(en.today_run.coach_polarization);
});

it('does not invent readiness or a load marker for a new runner', async () => {
  payload.activities = [];
  payload.coachPayload = null;
  payload.shoes = [];
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-gate-score')).toHaveTextContent('—');
  expect(screen.queryAllByRole('meter')).toHaveLength(0);
  expect(container.querySelector('.tr-v2-gate-verdict')).not.toBeInTheDocument();
  expect(container.querySelector('.tr-v2-acwr-scale i')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(en.today_run.new_runner_title);
});

it('keeps a rest day free of a stale run distance', async () => {
  payload.coachPayload.today.workoutType = 'REST';
  const { container } = await openPage();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Rest');
  expect(container.querySelector('.tr-v2-targets')).not.toHaveTextContent('10.0km');
  expect(container.querySelectorAll('.tr-v2-structure-steps li')).toHaveLength(1);
});

it.each(['en', 'zh-CN'])('keeps expanded rest context consistent while retaining weekly plan reasons in %s', async lang => {
  preferences.lang = lang;
  vi.setSystemTime(new Date('2026-10-10T16:00:00Z'));
  payload.coachPayload.today = {
    scheduledDate: '2026-10-10', workoutType: 'REST', reasonCode: 'scheduled_rest', intent: 'rest',
    plannedDistanceKm: null, plannedDurationMinutes: null,
  };
  payload.coachPayload.plan = {
    reasonCodes: ['build_consistency', 'load_data', 'goal_specific'],
    targetWeeklyKm: 23.6, sessionsPerWeek: 3,
  };
  const dictionary = lang === 'en' ? en : zh;
  const { container } = await openPage();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(dictionary.profile.dashboard_workout_rest);
  expect(container.querySelector('.tr-v2-purpose')).toHaveTextContent(dictionary.today_run.personalized_reason_scheduled_rest);
  expect(container.querySelector('.tr-v2-targets')).not.toHaveTextContent(/10\.0\s*(km|公里)/);
  expect(container.querySelectorAll('.tr-v2-structure-steps li')).toHaveLength(1);

  const context = container.querySelector('.tr-v2-coach details');
  fireEvent.click(within(context).getByText(dictionary.today_run.training_context));
  expect(context).toHaveAttribute('open');
  expect(context).toHaveTextContent(dictionary.today_run.personalized_reason_scheduled_rest);
  expect(context).not.toHaveTextContent(dictionary.today_run.personalized_reason_build_consistency);
  for (const code of payload.coachPayload.plan.reasonCodes) {
    const copy = dictionary.today_run[`personalized_plan_reason_${code}`];
    expect(copy).toEqual(expect.any(String));
    expect(context).toHaveTextContent(copy);
  }
});

it.each(['en', 'zh-CN'].flatMap(lang => [
  'injury_protect', 'readiness_protect', 'comeback', 'onboarding', 'race_taper',
  'race_day', 'high_load', 'intensity_rebalance', 'readiness_data',
].map(code => [lang, code])))('renders %s %s as plan context beside a scheduled rest session', async (lang, code) => {
  preferences.lang = lang;
  payload.coachPayload.today = { workoutType: 'REST', reasonCode: 'scheduled_rest', intent: 'rest' };
  payload.coachPayload.plan = { reasonCodes: [code] };
  payload.coachPayload.state = {};
  const dictionary = lang === 'en' ? en : zh;
  const { container } = await openPage();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(dictionary.profile.dashboard_workout_rest);
  expect(container.querySelector('.tr-v2-purpose')).toHaveTextContent(dictionary.today_run.personalized_reason_scheduled_rest);
  expect(container.querySelectorAll('.tr-v2-structure-steps li')).toHaveLength(1);
  const context = container.querySelector('.tr-v2-coach details');
  fireEvent.click(within(context).getByText(dictionary.today_run.training_context));
  expect(context).toHaveAttribute('open');
  expect(context).not.toHaveTextContent(dictionary.today_run[`personalized_reason_${code}`]);
  const copy = dictionary.today_run[`personalized_plan_reason_${code}`];
  expect(copy).toEqual(expect.any(String));
  expect(context).toHaveTextContent(copy);
});

it('uses miles for the distance and retains the batch endpoint fallback', async () => {
  preferences.unit = 'mile';
  apiJson.mockImplementation(async (url) => {
    if (url === '/api/today/dashboard') throw new Error('Unavailable');
    if (url === '/api/coach/today') return payload.coachPayload;
    if (url === '/api/v1/weather/context') return payload.weatherContext;
    if (url === '/api/races') return payload.races;
    if (url === '/api/shoes') return payload.shoes;
  });
  cachedApiJson.mockImplementation(async (url) => url === '/api/activities' ? payload.activities : payload.profile);
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('6.2mi');
  expect(cachedApiJson).toHaveBeenCalledWith('/api/activities');
});

it('renders the new labels and numeric stage weights in Chinese', async () => {
  preferences.lang = 'zh-CN';
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('距离');
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('50 分钟');
  expect(Number(container.querySelectorAll('.tr-v2-structure-bar > span')[1].style.flexGrow)).toBe(1);
});

it.each(['en', 'zh-CN'])('labels an existing reason beside the workout before expanding metrics in %s', async lang => {
  preferences.lang = lang;
  const { container } = await openPage();
  const reason = container.querySelector('.tr-v2-purpose');
  expect(reason).toHaveTextContent(lang === 'en' ? 'Why this workout' : '为什么这样练');
  expect(reason).toHaveTextContent((lang === 'en' ? en : zh).today_run.personalized_reason_build_consistency);
  expect(reason.closest('details')).toBeNull();
  expect(container.querySelector('.tr-v2-coach details')).not.toHaveAttribute('open');
});

it.each([undefined, 'unknown_future_reason', 'invalid reason'])('does not invent a reason for %s', async reasonCode => {
  payload.coachPayload.today.reasonCode = reasonCode;
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-purpose')).toHaveTextContent('The reason for this workout is unavailable.');
  expect(container.querySelector('.tr-v2-purpose')).not.toHaveTextContent(en.today_run.personalized_reason_build_consistency);
  expect(container.textContent).not.toMatch(/personalized_reason_unknown|personalized_reason_invalid/);
});

it('keeps insufficient wellness evidence explicit beside the recommendation', async () => {
  payload.coachPayload.today.reasonCode = 'readiness_protect';
  payload.coachPayload.state = { readinessSleep: 20, readinessScore: 20, readinessAvailability: {} };
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-purpose')).toHaveTextContent(en.today_run.personalized_reason_readiness_limited);
  expect(container.querySelector('.tr-v2-purpose')).not.toHaveTextContent('Sleep');
});

it('keeps detailed readiness factors expandable while summarizing the recorded reason', async () => {
  payload.coachPayload.today.reasonCode = 'readiness_protect';
  payload.coachPayload.state.readinessScore = 48;
  payload.coachPayload.state.readinessSleep = 35;
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-purpose')).toHaveTextContent(en.today_run.personalized_reason_readiness_protect);
  expect(container.querySelector('.tr-v2-purpose')).not.toHaveTextContent('35/100');
  fireEvent.click(container.querySelector('.tr-v2-coach summary'));
  expect(container.querySelector('.tr-v2-coach details')).toHaveTextContent('35/100');
});

it.each(['en', 'zh-CN'].flatMap(lang => [
  'injury_protect', 'readiness_protect', 'scheduled_rest', 'readiness_limited',
  'comeback', 'onboarding', 'race_taper', 'race_day', 'high_load', 'intensity_rebalance',
  'build_consistency', 'readiness_data', 'load_data', 'goal_specific', 'aerobic_progression',
  'quality_window', 'recovery_after_hard',
].map(code => [lang, code])))('translates the recorded %s %s explanation', async (lang, reasonCode) => {
  preferences.lang = lang;
  payload.coachPayload.today.reasonCode = reasonCode;
  payload.coachPayload.state.readinessScore = 78;
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-purpose')).toHaveTextContent((lang === 'en' ? en : zh).today_run[`personalized_reason_${reasonCode}`]);
});

it('does not use yesterday\'s structured workout or reason as today\'s recommendation', async () => {
  payload.coachPayload.today.scheduledDate = '2026-10-06';
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-purpose')).toHaveTextContent('2026-10-06');
  expect(container.querySelector('.tr-v2-purpose')).toHaveTextContent("refresh to check today's plan");
  expect(container.querySelector('.tr-v2-targets')).not.toHaveTextContent('10.0km');
});

it('keeps the empty-data explanation when an outdated plan arrives without running history', async () => {
  payload.activities = [];
  payload.races = [];
  payload.coachPayload.today.scheduledDate = '2026-10-06';
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-purpose')).toHaveTextContent(en.today_run.shared_plan_unavailable);
  expect(container.querySelector('.tr-v2-purpose')).toHaveTextContent('2026-10-06');
  expect(container.querySelector('.tr-v2-purpose')).not.toHaveTextContent(en.today_run.personalized_reason_build_consistency);
});

it('keeps empty-data and manual recovery explanations beside the workout', async () => {
  payload.activities = [];
  payload.races = [];
  payload.coachPayload = null;
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-purpose')).toHaveTextContent(en.today_run.shared_plan_unavailable);
  expect(screen.getByRole('button', { name: /Not feeling 100/ })).toBeDisabled();
});

it.each([
  ['en', 'Today is a rest day in your current training schedule.'],
  ['zh-CN', '当前训练计划将今天安排为休息日。'],
])('explains an empty account\'s scheduled rest without claiming observed running frequency in %s', async (lang, reason) => {
  preferences.lang = lang;
  payload.activities = [];
  payload.races = [];
  payload.coachPayload = { today: { workoutType: 'REST', reasonCode: 'scheduled_rest' }, state: {} };
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-purpose')).toHaveTextContent(reason);
});

it.each(['en', 'zh-CN'])('does not present a catalogue suggestion as an owned shoe after first import in %s', async lang => {
  preferences.lang = lang;
  payload.shoes = [];
  payload.activities = [{ id: 1, startTime: '2026-10-06T12:00:00Z', startDate: '2026-10-06T12:00:00Z', distanceKm: 8, movingTimeSeconds: 2400 }];
  const { container } = await openPage();
  const dictionary = lang === 'en' ? en : zh;
  const card = container.querySelector('.tr-v2-shoe');
  expect(card).toHaveTextContent(dictionary.today_run.shoe_empty_title);
  expect(card).toHaveTextContent(dictionary.today_run.shoe_empty_copy);
  expect(card).not.toHaveTextContent(dictionary.today_run.shoe_health_healthy);
  expect(card).not.toHaveTextContent('Endorphin');
  fireEvent.click(card);
  expect(screen.getByRole('heading', { name: 'Shoes destination' })).toBeInTheDocument();
});

it('uses the account day instead of the device day when checking the saved workout', async () => {
  vi.setSystemTime(new Date('2026-10-07T01:00:00Z'));
  payload.profile.timeZone = 'America/Los_Angeles';
  payload.coachPayload.today.scheduledDate = '2026-10-06';
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('10.0km');
  expect(container.querySelector('.tr-v2-purpose')).toHaveTextContent(en.today_run.personalized_reason_build_consistency);
  expect(container.querySelector('.tr-v2-reason-note')).toBeNull();
});

it('does not present tomorrow\'s workout as today\'s recommendation', async () => {
  payload.profile.timeZone = 'UTC';
  payload.coachPayload.today.scheduledDate = '2026-10-08';
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-targets')).not.toHaveTextContent('10.0km');
  expect(container.querySelector('.tr-v2-purpose')).toHaveTextContent('2026-10-08');
});

it.each(['en', 'zh-CN'])('offers a working retry after dashboard and history requests fail in %s', async lang => {
  preferences.lang = lang;
  const dictionary = lang === 'en' ? en : zh;
  apiJson.mockRejectedValue(new Error('Temporary outage'));
  cachedApiJson.mockRejectedValue(new Error('Temporary outage'));
  render(<MemoryRouter><TodayRun /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent(dictionary.today_run.load_error);
  apiJson.mockImplementation(async url => url === '/api/today/dashboard' ? payload : []);
  fireEvent.click(screen.getByRole('button', { name: dictionary.today_run.retry }));
  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('TEMPO');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(document.querySelector('.tr-v2-purpose')).toHaveTextContent(dictionary.today_run.personalized_reason_build_consistency);
});

it.each(['en', 'zh-CN'])('shows logged owned-shoe mileage and its configured limit without claiming physical wear in %s', async lang => {
  preferences.lang = lang;
  payload.shoes = [{ id: 1, brand: 'ASICS', model: 'Novablast 4', currentDistanceKm: 120, maxDistanceKm: 650 }];
  const { container } = await openPage();
  const card = container.querySelector('.tr-v2-shoe');
  expect(card).toHaveTextContent(lang === 'en' ? 'Current mileage: 120 km' : '当前里程：120 公里');
  expect(card).toHaveTextContent(lang === 'en' ? 'Until mileage limit: 530 km' : '距里程上限：530 公里');
  expect(card).not.toHaveTextContent(/Remaining life|Healthy|Wear noted|Replace soon|剩余寿命|健康|建议更换|轮换/);
});

it('does not manufacture a remaining distance when an owned shoe has no mileage limit', async () => {
  payload.shoes = [{ id: 1, brand: 'ASICS', model: 'Novablast 4', currentDistanceKm: 120, maxDistanceKm: null }];
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-shoe')).toHaveTextContent('Current mileage: 120 km');
  expect(container.querySelector('.tr-v2-shoe')).not.toHaveTextContent(/Until mileage limit|Replace soon|Remaining life/);
});

it.each(['en', 'zh-CN'])('uses a single-pair mileage next step rather than a rotation prompt for an empty locker in %s', async lang => {
  preferences.lang = lang;
  payload.shoes = [];
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-shoe')).toHaveTextContent(lang === 'en'
    ? 'Add a pair you own to track its mileage.' : '添加一双你拥有的跑鞋，记录它的里程。');
  expect(container.querySelector('.tr-v2-shoe')).not.toHaveTextContent(/rotation advice|轮换建议/);
});

it.each(['en', 'zh-CN'])('acknowledges imported history without prescribing a run over a beginner rest day in %s', async lang => {
  preferences.lang = lang;
  payload.activities = payload.activities.slice(0, 1);
  payload.coachPayload.runnerState = 'new';
  payload.coachPayload.today = { workoutType: 'REST', reasonCode: 'scheduled_rest' };
  const { container } = await openPage();
  const notice = screen.getByRole('status');
  expect(notice).toHaveTextContent(lang === 'en' ? 'Building your running history' : '逐步积累跑步记录');
  expect(notice).not.toHaveTextContent(/first run|30–40|第一次|30–40/);
  expect(screen.queryByRole('button', { name: (lang === 'en' ? en : zh).today_run.new_runner_cta })).toBeNull();
  expect(container.querySelector('.tr-v2-purpose')).toHaveTextContent((lang === 'en' ? en : zh).today_run.personalized_reason_scheduled_rest);
});

it.each(['en', 'zh-CN'])('keeps empty-history guidance distinct from today\'s conservative session in %s', async lang => {
  preferences.lang = lang;
  payload.activities = [];
  payload.coachPayload.runnerState = 'new';
  payload.coachPayload.today = { workoutType: 'REST', reasonCode: 'scheduled_rest' };
  await openPage();
  const notice = screen.getByRole('status');
  expect(notice).toHaveTextContent(lang === 'en' ? 'Import or log a run to add your running history.' : '导入或记录一次跑步，补充你的跑步历史。');
  expect(notice).not.toHaveTextContent(/30–40|calibrate your VDOT|决定了一切/);
  expect(within(notice).getByRole('button')).toHaveTextContent((lang === 'en' ? en : zh).today_run.new_runner_cta);
});

it.each(['en', 'zh-CN'])('keeps return-from-gap guidance consistent with a scheduled rest day in %s', async lang => {
  preferences.lang = lang;
  payload.coachPayload.runnerState = 'comeback';
  payload.coachPayload.today = { workoutType: 'REST', reasonCode: 'scheduled_rest' };
  await openPage();
  const notice = screen.getByRole('status');
  expect(notice).not.toHaveTextContent(/60–70%|first week|第一周/);
  expect(notice).toHaveTextContent(lang === 'en' ? 'Follow today\'s session above' : '请按上方的今日安排训练或休息');
});
