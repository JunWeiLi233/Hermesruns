import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { methodsDocUrl } from '../../../utils/methodsDoc';
import EnduranceCheck from '../EnduranceCheck';

const state = vi.hoisted(() => ({ lang: 'en', unit: 'km' }));
const t = (key, params = {}) => {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};

vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: state.lang, t }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: state.unit, isMile: state.unit === 'mile' }) }));

const NOW = Date.UTC(2026, 9, 13, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const run = (id, km, daysAgo) => ({ id, name: `Run ${id}`, distanceKm: km, startTime: new Date(NOW - daysAgo * DAY).toISOString() });
const MARATHON = 42195;
const HALF = 21097.5;

beforeEach(() => {
  state.lang = 'en';
  state.unit = 'km';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('EnduranceCheck', () => {
  it('says the longest run is under the rule, and what the rule asks for, when it is', () => {
    const { container } = render(<EnduranceCheck runs={[run(1, 8, 3), run(2, 14.2, 20), run(3, 10, 30)]} distanceMeters={MARATHON} />);
    const section = screen.getByRole('region', { name: 'Long run check' });

    expect(section).toHaveTextContent('Your longest run in the last 8 weeks was 14.2 km. The check looks for 31.6 km, three quarters of this distance.');
    expect(section).toHaveTextContent('not a sign that you have trained for it');
    expect(container.querySelector('.endurance-check')).toHaveClass('is-short');
    expect(section).toHaveTextContent('Runs in the last 8 weeks: 3. Average per week: 4.0 km.');
  });

  it('says the rule is met when the longest run reaches three quarters of the distance, with no warning', () => {
    const { container } = render(<EnduranceCheck runs={[run(1, 16.5, 9), run(2, 8, 2)]} distanceMeters={HALF} />);
    const section = screen.getByRole('region', { name: 'Long run check' });

    expect(section).toHaveTextContent('Your longest run in the last 8 weeks was 16.5 km, which reaches the 15.8 km the check looks for (three quarters of this distance).');
    expect(section).not.toHaveTextContent('not a sign that you have trained');
    expect(container.querySelector('.endurance-check')).not.toHaveClass('is-short');
  });

  it('says there is no long run to check when there is no run in the last eight weeks, and gives no figures', () => {
    render(<EnduranceCheck runs={[run(1, 30, 70)]} distanceMeters={MARATHON} />);
    const section = screen.getByRole('region', { name: 'Long run check' });

    expect(section).toHaveTextContent('You have no run in the last 8 weeks, so there is no long run to check.');
    expect(section).not.toHaveTextContent('Average per week');
  });

  it('says the same for a runner with no runs at all', () => {
    render(<EnduranceCheck runs={[]} distanceMeters={HALF} />);
    expect(screen.getByRole('region', { name: 'Long run check' })).toHaveTextContent('no long run to check');
  });

  it('draws nothing without a distance', () => {
    const { container } = render(<EnduranceCheck runs={[run(1, 12, 3)]} distanceMeters={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says what it is, a HermesRuns rule of thumb that does not change the time, with a link to the rule', () => {
    render(<EnduranceCheck runs={[run(1, 12, 3)]} distanceMeters={MARATHON} />);
    const section = screen.getByRole('region', { name: 'Long run check' });

    expect(section).toHaveTextContent('A HermesRuns rule of thumb, not a research result');
    expect(section).toHaveTextContent('It does not change the time.');
    expect(within(section).getByRole('link', { name: en.methods.link })).toHaveAttribute('href', methodsDocUrl('the-long-run-check'));
  });

  it('counts distances in miles when the runner does', () => {
    state.unit = 'mile';
    render(<EnduranceCheck runs={[run(1, 16, 9)]} distanceMeters={MARATHON} />);
    const section = screen.getByRole('region', { name: 'Long run check' });

    expect(section).toHaveTextContent('Your longest run in the last 8 weeks was 9.9 mi. The check looks for 19.7 mi');
    expect(section).toHaveTextContent('Average per week: 1.2 mi.');
  });

  it('reads in Chinese, with the same figures', () => {
    state.lang = 'zh-CN';
    render(<EnduranceCheck runs={[run(1, 14.2, 20)]} distanceMeters={MARATHON} />);
    const section = screen.getByRole('region', { name: '长距离跑检查' });

    expect(section).toHaveTextContent('你最近 8 周最长的一次跑步是 14.2 公里。检查看的是 31.6 公里，也就是这个距离的四分之三。');
    expect(section).toHaveTextContent('最近 8 周的跑步次数：1。平均每周：1.8 公里。');
  });
});
