import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import RecommendationEvidence from './RecommendationEvidence';
import en from '../i18n/locales/en';
import zh from '../i18n/locales/zh-CN';

const preferences = vi.hoisted(() => ({ unit: 'km', lang: 'en' }));
vi.mock('../contexts/I18nContext', () => ({ useI18n: () => ({ lang: preferences.lang, t: (key, values = {}) => {
  const dictionary = preferences.lang === 'en' ? en : zh;
  const text = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), text);
} }) }));
vi.mock('../contexts/UnitContext', () => ({ useUnit: () => preferences }));
afterEach(() => { cleanup(); preferences.lang = 'en'; preferences.unit = 'km'; });

const payload = { today: { scheduledDate: '2026-10-16', workoutType: 'REST', reasonCode: 'weekly_budget_exhausted' }, plan: {
  targetWeeklyKm: 24.9, timeZone: 'America/New_York',
  weeklyBudgets: [{ start: '2026-10-12', end: '2026-10-18', budgetKm: 24.9, completedKm: 35.345, remainingAllowanceKm: 0, scheduledRemainingKm: 0, projectedTotalKm: 35.345 },
    { start: '2026-10-19', end: '2026-10-25', budgetKm: 24.9, completedKm: 0, remainingAllowanceKm: 24.9, scheduledRemainingKm: 15, projectedTotalKm: 15 }],
  historyEvidence: { asOfDate: '2026-10-16', from7: '2026-10-10', from28: '2026-09-19', volume7Km: 46.4, volume28Km: 124.7,
    averageWeeklyKm: 31.175, distanceLoadRatio: 1.488, highLoadThreshold: 1.3, weeklyMultiplier: 0.8, minimumWeeklyKm: 12,
    maximumGrowthMultiplier: 1.1, runDays28: 15, averageRunKm: 5.2, longestRunKm28: 11, averagePaceSecondsPerKm: 340,
    highIntensityRatio7d: 0.1, hoursSinceHardRun: 29, injuryRisk: 'LOW', dailyDistances: [{ date: '2026-10-15', km: 10.0072 }] },
  recoveryEvidence: { date: '2026-10-16', availability: { trainingLoad: true }, readings: {}, sources: {},
    result: { score: 76, verdict: 'EASY', loadScore: 80, confidence: 20 }, trainingLoad: { ewmaLoadRatio: 1.098, weeklyMonotony: 1.465, hoursSinceHardAtEndOfDay: 32, score: 80 },
    sleepWeight: 0.28, hrvWeight: 0.24, restingHrWeight: 0.14, stressWeight: 0.14, trainingLoadWeight: 0.2, neutralScore: 75 },
} };

it('shows the authoritative budget and zero remaining mileage without raising the target to completed mileage', () => {
  render(<RecommendationEvidence payload={payload} />);
  expect(screen.getByTestId('recommendation-budget')).toHaveTextContent('24.9 km');
  expect(screen.getByTestId('recommendation-completed')).toHaveTextContent('35.3 km');
  expect(screen.getByTestId('recommendation-remaining')).toHaveTextContent('0.0 km');
  expect(screen.getByText(/remaining automatic runs are rest days/i)).toBeInTheDocument();
  const steps = screen.getAllByRole('listitem', { hidden: true });
  expect(steps).toHaveLength(5);
  expect(steps[0]).toHaveTextContent('124.7 km ÷ 4');
  expect(steps[0]).toHaveTextContent('31.175 km');
  expect(steps[1]).toHaveTextContent('46.4 km ÷ 31.175 km');
  expect(steps[1]).toHaveTextContent('1.49');
  expect(screen.getByRole('img')).toHaveAccessibleName('35.3 km completed of a 24.9 km weekly budget; 10.4 km over budget.');
  expect(screen.getByText('Over budget').nextElementSibling).toHaveTextContent('10.4 km');
});
it('discloses missing wellness readings and the neutral contribution to readiness', async () => {
  render(<RecommendationEvidence payload={payload} />);
  await userEvent.click(screen.getByText('History & recovery details'));
  expect(screen.getAllByText('Not recorded')).toHaveLength(4);
  expect(screen.getByText(/80 × 20%/)).toHaveTextContent('75 × 80% = 76');
  expect(screen.getByText(/1.098/)).toBeInTheDocument();
});
it('uses the selected week instead of reusing this weeks completed mileage', () => {
  render(<RecommendationEvidence payload={payload} weekStart="2026-10-19" />);
  expect(screen.getByTestId('recommendation-completed')).toHaveTextContent('0.0 km');
  expect(screen.getByTestId('recommendation-remaining')).toHaveTextContent('24.9 km');
  expect(screen.getByText('Within budget')).toBeInTheDocument();
  expect(screen.getByText('Still scheduled').nextElementSibling).toHaveTextContent('15.0 km');
  expect(screen.queryByText('Over budget')).not.toBeInTheDocument();
  expect(screen.getAllByRole('listitem', { hidden: true })[4]).toHaveTextContent('15.0 km');
});
it('renders both languages and changes distance units without changing the prescription', () => {
  preferences.lang = 'zh-CN'; preferences.unit = 'mile';
  render(<RecommendationEvidence payload={payload} />);
  expect(screen.getByTestId('recommendation-budget')).not.toHaveTextContent('24.9');
  expect(screen.getByText('推荐依据')).toBeInTheDocument();
  expect(screen.getByText('预算已用完')).toBeInTheDocument();
  expect(screen.getByRole('img')).toHaveAccessibleName(/周预算 15.5 英里/);
  expect(screen.queryByText(/recommendation_evidence\./)).not.toBeInTheDocument();
});
it('shows the calculation and keeps the calculation and supporting evidence independently expandable', async () => {
  render(<RecommendationEvidence payload={payload} />);
  const calculation = screen.getByText('How this is calculated').closest('details');
  const supporting = screen.getByText('History & recovery details').closest('details');
  expect(calculation).toHaveAttribute('open');
  expect(supporting).not.toHaveAttribute('open');
  await userEvent.click(within(supporting).getByText('History & recovery details'));
  expect(supporting).toHaveAttribute('open');
  expect(calculation).toHaveAttribute('open');
  await userEvent.click(within(calculation).getByText('How this is calculated'));
  expect(calculation).not.toHaveAttribute('open');
  expect(screen.getByText('10.007 km')).toBeInTheDocument();
});
it('keeps an empty week progress scale finite without fabricating mileage', () => {
  const empty = { ...payload, plan: { ...payload.plan, weeklyBudgets: [{ ...payload.plan.weeklyBudgets[0], budgetKm: 0, completedKm: 0, remainingAllowanceKm: 0 }] } };
  const { container } = render(<RecommendationEvidence payload={empty} />);
  expect(screen.getByRole('img')).toHaveAccessibleName('0.0 km completed of a 0.0 km weekly budget; 0.0 km over budget.');
  expect(container.querySelector('.recommendation-evidence__progress').getAttribute('style')).not.toMatch(/NaN|Infinity/);
  expect(screen.queryByText('Over budget')).not.toBeInTheDocument();
});
it('does not invent evidence for an old or unavailable payload', () => {
  const { container } = render(<RecommendationEvidence payload={{ plan: { targetWeeklyKm: 10 } }} />);
  expect(container).toBeEmptyDOMElement();
});
