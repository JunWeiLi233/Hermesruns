import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AnalysisInsightDetail from '../AnalysisInsightDetail';
import enPages from '../../../i18n/locales/en/pages';
import enComponents from '../../../i18n/locales/en/components';
import zhPages from '../../../i18n/locales/zh-CN/pages';
import zhComponents from '../../../i18n/locales/zh-CN/components';
import { cachedApiJson } from '../../../api/resourceCache';

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'timeline@example.test' }) }));
const preferences = vi.hoisted(() => ({ unit: 'km', lang: 'en' }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => preferences }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: preferences.lang, t: (key, values = {}) => {
  const [section, name] = key.split('.');
  const components = preferences.lang === 'en' ? enComponents : zhComponents;
  const pages = preferences.lang === 'en' ? enPages : zhPages;
  const copy = components[section]?.[name] ?? pages[section]?.[name] ?? key;
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), copy);
} }) }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../api', async importOriginal => ({ ...await importOriginal(), apiJson: vi.fn(async () => ({ recentLogs: [] })) }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

let activities;
let profile;
const run = (id, startTime, averageCadence = 170) => ({ id, name: `Run ${id}`, startTime, distanceKm: 8, movingTimeSeconds: 2400, averageCadence, averageHeartRate: 140, maxHeartRate: 185 });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T16:00:00Z'));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  preferences.unit = 'km';
  preferences.lang = 'en';
  profile = { displayName: 'Timeline', timeZone: 'UTC' };
  activities = [run(1, '2026-10-01T12:00:00Z'), run(2, '2026-10-02T12:00:00Z'), run(3, '2026-10-14T12:00:00Z')];
  cachedApiJson.mockImplementation(async url => url === '/api/activities/analysis' ? activities : profile);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function openPage() {
  const page = () => <MemoryRouter initialEntries={['/analysis/injury-risk']}><Routes>
    <Route path="/analysis/:insightKey" element={<AnalysisInsightDetail />} />
  </Routes></MemoryRouter>;
  const rendered = render(page());
  await screen.findByRole('heading', { name: 'Load vs. cadence', level: 2 });
  return { ...rendered, rerenderPage: () => rendered.rerender(page()) };
}

function chart(container) {
  const svg = container.querySelector('.analysis-injury-v2-chart svg');
  // Exercise the real handler with a scaled/translated SVG screen transform.
  svg.getScreenCTM = () => ({ inverse: () => ({}) });
  svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: (this.x - 40) * 2, y: (this.y - 20) * 2 }; } });
  return svg;
}
function pointer(svg, type, x, y, pointerType = 'mouse') {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { clientX: x / 2 + 40, clientY: y / 2 + 20, pointerType, pointerId: 1 });
  fireEvent(svg, event);
}

it('mounts the true sparse path, date-aligned axis and complete numeric selector', async () => {
  const { container } = await openPage();
  const path = container.querySelector('.analysis-cinematic-primary-line').getAttribute('d');
  expect(path).toMatch(/L92\.15384615384616,/);
  const axis = container.querySelector('[data-injury-date-axis]');
  expect(axis.querySelectorAll('[data-date-key]')).toHaveLength(3);
  expect(axis.querySelector('[data-date-key="2026-10-02"]').style.left).toBe('9.215384615384616%');
  const selector = screen.getByRole('combobox', { name: 'Load vs. cadence' });
  expect(selector.options).toHaveLength(3);
  expect(selector.options[1].textContent).toContain('2026-10-02');
  expect(selector.options[1].textContent).toContain('Run 2');
  expect(selector.options[1].textContent).toMatch(/Load: \d+/);
});

it('hover selects the actual nearest date in transformed SVG coordinates', async () => {
  const { container } = await openPage();
  const svg = chart(container);
  pointer(svg, 'pointermove', 100, 100);
  expect(container.querySelector('.analysis-injury-chart-tooltip')).toHaveTextContent('2026-10-02');
  expect(container.querySelector('.analysis-injury-chart-tooltip')).toHaveTextContent('Run 2');
  expect(Number(container.querySelector('.analysis-cinematic-scrubber-line').getAttribute('x1'))).toBeCloseTo(92.153846);
});

it('touch and keyboard reach both same-day values and preserve a pinned selection', async () => {
  activities.push(run(4, '2026-10-02T18:00:00Z', 190));
  const { container } = await openPage();
  const selector = screen.getByRole('combobox', { name: 'Load vs. cadence' });
  const option2 = [...selector.options].find(option => option.textContent.includes('Run 2'));
  const option4 = [...selector.options].find(option => option.textContent.includes('Run 4'));
  expect(option2.value).not.toBe(option4.value);
  const svg = chart(container);
  pointer(svg, 'pointerdown', 92.153846, 100, 'touch');
  pointer(svg, 'pointerleave', 92.153846, 100, 'touch');
  expect(container.querySelector('.analysis-injury-chart-tooltip.is-scrubbing')).not.toBeNull();
  fireEvent.change(selector, { target: { value: option2.value } });
  expect(container.querySelector('.analysis-injury-chart-tooltip')).toHaveTextContent('Run 2');
  fireEvent.keyDown(selector, { key: 'ArrowRight' });
  expect(container.querySelector('.analysis-injury-chart-tooltip')).toHaveTextContent('Run 4');
  expect(container.querySelector('.analysis-injury-chart-tooltip')).toHaveTextContent('190 spm');
  fireEvent.keyDown(selector, { key: 'Home' });
  expect(container.querySelector('.analysis-injury-chart-tooltip')).toHaveTextContent('Run 1');
  fireEvent.keyDown(selector, { key: 'End' });
  expect(container.querySelector('.analysis-injury-chart-tooltip')).toHaveTextContent('Run 3');
  fireEvent.change(selector, { target: { value: option4.value } });
  pointer(svg, 'pointerleave', 982, 100);
  expect(selector.value).toBe(option4.value);
  expect(container.querySelector('.analysis-injury-chart-tooltip')).toHaveTextContent('Run 4');
});

it('honors the applied account zone and keeps unknown legacy wall dates', async () => {
  activities = [
    { ...run(1, '2026-10-03T01:00:00'), activityInstant: '2026-10-03T01:00:00Z', accountLocalDate: '2026-10-02', accountLocalTime: '21:00:00', accountTimeZone: 'America/New_York' },
    { ...run(2, '2026-10-03T01:00:00'), activityInstant: null, accountLocalDate: '2026-10-03', accountTimeZone: 'America/New_York', timeRepresentation: 'STRAVA_LOCAL_WALL_TIME' },
    run(3, '2026-10-14T12:00:00Z'),
  ];
  const original = structuredClone(activities);
  const { container } = await openPage();
  const selector = screen.getByRole('combobox', { name: 'Load vs. cadence' });
  expect([...selector.options].find(option => option.textContent.includes('Run 1')).textContent).toContain('2026-10-02');
  expect([...selector.options].find(option => option.textContent.includes('Run 2')).textContent).toContain('2026-10-03');
  // The detail adapter must preserve both cached ordering and individual fields.
  expect(activities).toEqual(original);
  expect(container.querySelector('.analysis-cinematic-primary-line').getAttribute('d')).toMatch(/L98\.33333333333333,/);
});

it('uses account-local days at both six-week boundaries', async () => {
  // Just before Los Angeles midnight: the last completed run is in the past,
  // while the next calendar day's fixture is still future history.
  vi.setSystemTime(new Date('2026-10-15T06:59:30Z'));
  profile.timeZone = 'America/Los_Angeles';
  activities = [run(1, '2026-09-03T06:59:00Z'), run(2, '2026-09-03T07:00:00Z'), run(3, '2026-10-15T06:59:00Z'), run(4, '2026-10-15T07:00:00Z')];
  await openPage();
  const selector = screen.getByRole('combobox', { name: 'Load vs. cadence' });
  expect([...selector.options].map(option => option.textContent)).toEqual([
    expect.stringContaining('2026-09-03'), expect.stringContaining('2026-10-14'),
  ]);
});

it.each([
  ['America/New_York', 'Pacific/Honolulu', '2026-08-30', '2026-10-10'],
  ['Pacific/Honolulu', 'America/New_York', '2026-08-31', '2026-10-11'],
])('uses the applied response calendar throughout when cached %s differs from %s', async (cachedZone, appliedZone, start, end) => {
  vi.setSystemTime(new Date('2026-10-11T04:30:00Z'));
  profile.timeZone = cachedZone;
  // The endpoint supplies one current account zone for the whole response.
  activities = [
    run(1, '2026-08-30T16:00:00Z'), run(2, '2026-08-31T16:00:00Z'),
    run(3, '2026-10-10T16:00:00Z'), run(4, '2026-10-11T04:15:00Z'),
  ].map(activity => ({ ...activity, accountTimeZone: appliedZone, activityInstant: activity.startTime }));
  await openPage();
  const options = [...screen.getByRole('combobox', { name: 'Load vs. cadence' }).options];
  expect(options[0].textContent).toContain(start);
  expect(options.at(-1).textContent).toContain(end);
  expect(options).toHaveLength(appliedZone === 'Pacific/Honolulu' ? 4 : 3);
  expect(options.some(option => option.textContent.includes('#1'))).toBe(appliedZone === 'Pacific/Honolulu');
});

it('keeps missing cadence gaps and handles unavailable SVG transforms safely', async () => {
  activities[1].averageCadence = null;
  const { container } = await openPage();
  const svg = chart(container);
  svg.getScreenCTM = () => null;
  pointer(svg, 'pointermove', 100, 100);
  const selector = screen.getByRole('combobox', { name: 'Load vs. cadence' });
  fireEvent.change(selector, { target: { value: selector.options[1].value } });
  await waitFor(() => expect(container.querySelector('.analysis-injury-chart-tooltip')).toHaveTextContent('Cadence--'));
  const path = container.querySelector('.analysis-cinematic-comparison-line').getAttribute('d');
  expect(path.match(/M/g)).toHaveLength(2);
  expect(path).not.toContain('L');
});

it('distinguishes otherwise identical same-day sessions by activity ID', async () => {
  activities = [run(11, '2026-10-02T12:00:00Z'), run(12, '2026-10-02T18:00:00Z')].map(activity => ({ ...activity, name: 'Easy run' }));
  const { container } = await openPage();
  const selector = screen.getByRole('combobox', { name: 'Load vs. cadence' });
  expect(selector.options[0].textContent).not.toBe(selector.options[1].textContent);
  expect(selector.options[0].textContent).toContain('#11');
  fireEvent.change(selector, { target: { value: selector.options[1].value } });
  expect(container.querySelector('.analysis-injury-chart-tooltip')).toHaveTextContent('#12');
  expect(container.querySelector('[data-injury-selected-values]')).toHaveTextContent('Load: 45');
});

it('preserves a same-day activity selection when locale and units change', async () => {
  activities.push(run(4, '2026-10-02T18:00:00Z', 190));
  const { container, rerenderPage } = await openPage();
  const selector = screen.getByRole('combobox', { name: 'Load vs. cadence' });
  const selectedKey = [...selector.options].find(option => option.textContent.includes('Run 4')).value;
  fireEvent.change(selector, { target: { value: selectedKey } });
  preferences.unit = 'mile';
  preferences.lang = 'zh-CN';
  rerenderPage();
  expect(container.querySelector('.analysis-injury-v2-chart select').value).toBe(selectedKey);
  expect(container.querySelector('.analysis-injury-chart-tooltip')).toHaveTextContent('Run 4');
  expect(container.querySelector('.analysis-injury-chart-tooltip')).toHaveTextContent('190 spm');
  expect(container.querySelector('[data-injury-selected-values]')).toHaveTextContent('2026-10-02');
});

it('renders a single observation visibly at the centered calendar coordinate', async () => {
  activities = [run(1, '2026-10-02T12:00:00Z')];
  const { container } = await openPage();
  const dots = container.querySelectorAll('.analysis-injury-observation-dot');
  expect(dots).toHaveLength(1);
  expect(dots[0]).toHaveAttribute('cx', '500');
});
