import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import WeeklyLoadCard from '../WeeklyLoadCard';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';

function props(lang = 'en', unit = 'km') {
  const days = lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return {
    lang, unit,
    t: (key, replacements = {}) => {
      const copy = key.split('.').reduce((value, part) => value[part], lang === 'en' ? en : zh);
      return Object.entries(replacements).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, replacement), copy);
    },
    bars: [[10.2, 10], [10.4, 10.4], [5.1, 6], [10.3, 11], [0, 6], [0, 24], [0, 8]]
      .map(([actual, projected], index) => ({ key: days[index], label: days[index], index, actual, projected, projectedKnown: true, isToday: index === 4 })),
  };
}

describe('Profile weekly training load', () => {
  it.each(['en', 'zh-CN'])('explains the seven-day sum, removed Saturday target and remaining allowance in %s', (lang) => {
    const input = props(lang);
    const targets = [0, 5.2, 5.1, 5.1, 0, 0, 0];
    input.bars = input.bars.map((bar, index) => ({ ...bar, projected: targets[index],
      originalProjected: index === 5 ? 10.4 : targets[index], workoutType: targets[index] ? 'EASY' : 'REST', isToday: index === 5 }));
    render(<WeeklyLoadCard {...input} plannedDistanceKm={25.8} />);
    fireEvent.click(screen.getByText(lang === 'en' ? 'How this is calculated' : '查看计划计算'));
    const table = screen.getByRole('table', { name: lang === 'en' ? 'Daily training distances' : '每日训练距离' });
    expect(within(table).getAllByRole('row')).toHaveLength(8);
    expect(screen.getByText(lang === 'en' ? '25.8 km − 10.4 km = 15.4 km' : '25.8 公里 − 10.4 公里 = 15.4 公里')).toBeVisible();
    expect(screen.getByText(lang === 'en'
      ? '0.0 + 5.2 + 5.1 + 5.1 + 0.0 + 0.0 + 0.0 = 15.4 km'
      : '0.0 + 5.2 + 5.1 + 5.1 + 0.0 + 0.0 + 0.0 = 15.4 公里')).toBeVisible();
    expect(within(table).getAllByRole('row')[6]).toHaveTextContent(lang === 'en' ? 'Rest' : '休息');
    expect(within(table).getAllByRole('row')[6]).toHaveTextContent(lang === 'en' ? '10.4 km' : '10.4 公里');
    expect(screen.getByText(/max\(/)).toHaveTextContent('0.0');
  });

  it('marks converted rounded equations as approximate when their displayed operands differ', () => {
    const input = props('en', 'mile');
    const targets = [0, 5.2, 5.1, 5.1, 0, 0, 0];
    input.bars = input.bars.map((bar, index) => ({ ...bar, projected: targets[index], originalProjected: index === 5 ? 10.4 : targets[index] }));
    render(<WeeklyLoadCard {...input} plannedDistanceKm={25.8} />);
    fireEvent.click(screen.getByText('How this is calculated'));
    expect(screen.getByText('16.0 mi − 6.5 mi ≈ 9.6 mi')).toBeVisible();
  });

  it('shows the sum of displayed prescriptions separately from the weekly budget', () => {
    render(<WeeklyLoadCard {...props()} plannedDistanceKm={25.8} />);
    expect(screen.getByText('/ 75.4 km planned')).toBeInTheDocument();
    expect(screen.getByText('Weekly budget 25.8 km')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '36.0 km / 25.8 km');
  });
  it('uses the API weekly budget when remaining prescriptions contain only rest days', () => {
    const input = props();
    input.bars = input.bars.map((bar) => ({ ...bar, projected: 0, projectedKnown: bar.index >= 4 }));
    render(<WeeklyLoadCard {...input} plannedDistanceKm={24.9} />);
    expect(screen.getByText('/ Known plan 0.0 km')).toBeInTheDocument();
    expect(screen.getByText('Weekly budget 24.9 km')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByRole('status')).toHaveTextContent('Today: Rest · Weekly budget reached');
    expect(screen.getByRole('button', { name: 'Mon: Actual 10.2 km; Planned —' })).toBeInTheDocument();
  });

  it('labels both distances when the actual distance exceeds the daily plan', () => {
    const input = props();
    input.bars[0] = { ...input.bars[0], actual: 10, projected: 4.5 };
    render(<WeeklyLoadCard {...input} />);
    const monday = screen.getByRole('button', { name: 'Mon: Actual 10.0 km; Planned 4.5 km' });
    expect(monday.querySelector('.hd-bar-value.has-actual')).toHaveTextContent('10.0');
    expect(monday.querySelector('.hd-bar-value.is-projected')).toHaveTextContent('4.5');
  });

  it('shows the account distances, completion, today and remaining distance', () => {
    render(<WeeklyLoadCard {...props()} />);
    expect(screen.getByText('36.0 km')).toBeInTheDocument();
    expect(screen.getByText('/ 75.4 km planned')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '48');
    expect(screen.getByRole('status')).toHaveTextContent('Today: 6.0 km planned · 39.4 km left this week');
    expect(screen.getAllByRole('button')).toHaveLength(7);
  });

  it('shows daily details on hover, focus and touch-style click; Escape restores the summary', () => {
    render(<WeeklyLoadCard {...props()} />);
    const saturday = screen.getByRole('button', { name: 'Sat: Actual 0.0 km; Planned 24.0 km' });
    fireEvent.mouseEnter(saturday);
    expect(screen.getByRole('status')).toHaveTextContent('Sat · Actual 0.0 km / Planned 24.0 km');
    fireEvent.mouseLeave(saturday);
    expect(screen.getByRole('status')).toHaveTextContent('Today:');
    fireEvent.focus(saturday);
    expect(screen.getByRole('status')).toHaveTextContent('Sat ·');
    fireEvent.blur(saturday);
    fireEvent.click(saturday);
    expect(screen.getByRole('status')).toHaveTextContent('Sat ·');
    fireEvent.keyDown(saturday, { key: 'Escape' });
    expect(screen.getByRole('status')).toHaveTextContent('Today:');
  });

  it('does not paint a completed bar for zero distance or invent an unknown plan', () => {
    const input = props();
    input.bars = input.bars.map((bar) => ({ ...bar, actual: 0, projected: 0, projectedKnown: false }));
    const { container } = render(<WeeklyLoadCard {...input} />);
    expect(container.querySelector('.hd-bar.actual')).toBeNull();
    expect(container.querySelector('.hd-bar.projected')).toBeNull();
    expect(screen.getByText('/ No planned distance')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Today: No planned distance');
    fireEvent.focus(screen.getAllByRole('button')[0]);
    expect(screen.getByRole('status')).toHaveTextContent('Planned —');
  });

  it('caps completion and never reports negative remaining distance', () => {
    const input = props();
    input.bars[0].actual = 100;
    render(<WeeklyLoadCard {...input} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByRole('status')).toHaveTextContent('Weekly distance complete');
    expect(screen.getByRole('status')).not.toHaveTextContent('left this week');
  });

  it('converts totals, daily values and details to miles', () => {
    render(<WeeklyLoadCard {...props('en', 'mile')} />);
    expect(screen.getByText('22.4 mi')).toBeInTheDocument();
    expect(screen.getByText('/ 46.9 mi planned')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Today: 3.7 mi planned · 24.5 mi left this week');
    expect(screen.getByRole('button', { name: 'Mon: Actual 6.3 mi; Planned 6.2 mi' })).toHaveTextContent('6.3');
  });

  it('uses Chinese copy and distinguishes a planned rest day', () => {
    const input = props('zh-CN');
    input.bars[4].projected = 0;
    render(<WeeklyLoadCard {...input} />);
    expect(screen.getByRole('heading', { name: '本周' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('今天休息 · 本周还剩 33.4 公里');
  });

  it('refreshes selected-day details when account data changes', () => {
    const input = props();
    const { rerender } = render(<WeeklyLoadCard {...input} />);
    fireEvent.focus(screen.getAllByRole('button')[4]);
    rerender(<WeeklyLoadCard {...input} bars={input.bars.map((bar) => bar.isToday ? { ...bar, actual: 6.2 } : bar)} />);
    expect(screen.getByRole('status')).toHaveTextContent('Fri · Actual 6.2 km / Planned 6.0 km');
    expect(screen.getByText('42.2 km')).toBeInTheDocument();
  });
});
