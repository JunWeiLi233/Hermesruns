import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProgressionChart from './ProgressionChart';
import { buildProgressionAtlas } from '../../utils/progressionAtlas';
import translations from '../../i18n/translations';

const tFor = (lang) => (key, params = {}) => Object.entries(params).reduce(
  (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
  key.split('.').reduce((value, part) => value?.[part], translations[lang]) || key,
);
const runs = [{ startTime: new Date(2026, 0, 8, 9).toISOString(), distanceKm: 10 }];
const now = new Date(2026, 0, 20, 12);

describe('progression chart', () => {
  it('lets keyboard users inspect dates and distance without needing a pointer', () => {
    render(<ProgressionChart atlas={buildProgressionAtlas(runs, 'month', 'en', now)} lang="en" unit="km" t={tFor('en')} />);
    const scrubber = screen.getByRole('slider');
    fireEvent.focus(scrubber);
    fireEvent.change(scrubber, { target: { value: '8' } });
    expect(scrubber.getAttribute('aria-valuetext')).toContain('Jan 8, 2026');
    expect(scrubber.getAttribute('aria-valuetext')).toContain('Cumulative distance: 10.0 km');
    expect(scrubber.getAttribute('aria-valuetext')).toContain('That day: 10.0 km');
    fireEvent.change(scrubber, { target: { value: '9' } });
    expect(scrubber.getAttribute('aria-valuetext')).toContain('That day: 0.0 km');
    fireEvent.blur(scrubber);
    expect(screen.getByText(/Steeper =/, { selector: 'span' })).toBeInTheDocument();
  });

  it('uses miles for the trend, readout, and weekly volume', () => {
    render(<ProgressionChart atlas={buildProgressionAtlas(runs, 'month', 'en', now)} lang="en" unit="mile" t={tFor('en')} />);
    expect(screen.getByRole('img', { name: /Cumulative distance: 6.2 mi/ })).toBeInTheDocument();
    fireEvent.focus(screen.getByRole('slider'));
    fireEvent.change(screen.getByRole('slider'), { target: { value: '8' } });
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toContain('That day: 6.2 mi');
    expect(screen.getByText(/Jan 5 - Jan 11, 2026 · 6.2 mi/)).toBeInTheDocument();
  });

  it('shows an honest empty state with no sample curve or interactive data', () => {
    const { container } = render(<ProgressionChart atlas={buildProgressionAtlas([], 'month', 'zh-CN', now)} lang="zh-CN" unit="km" t={tFor('zh-CN')} />);
    expect(screen.getByText('此时段暂无跑步记录')).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(container.querySelector('.hd-progression-line')).toBeNull();
    expect(container.querySelector('.hd-progression-volume-bar')).toBeNull();
  });

  describe('beside the stretch before', () => {
    const when = (month, date) => new Date(2026, month, date, 9).toISOString();
    const compareRuns = [
      { startTime: when(1, 10), distanceKm: 10 },   // 10 Feb: the 3 months before (20 Jan - 19 Apr)
      { startTime: when(2, 20), distanceKm: 12 },
      { startTime: when(5, 1), distanceKm: 20 },    // 1 Jun: the last 3 months (20 Apr - 20 Jul)
    ];
    const julyNow = new Date(2026, 6, 20, 12);

    it('draws the stretch before as a dashed line, names it in the legend and describes it for a screen reader', () => {
      const { container } = render(<ProgressionChart atlas={buildProgressionAtlas(compareRuns, '3m', 'en', julyNow, { compare: true })} lang="en" unit="km" t={tFor('en')} />);

      expect(container.querySelector('.hd-progression-line.is-previous')).toHaveAttribute('stroke-dasharray');
      expect(container.querySelector('.hd-progression-legend.is-compare')).toHaveTextContent('Before: Jan 2026 - Apr 2026');
      expect(screen.getByRole('img', { name: /Cumulative distance: 20.0 km/ }).querySelector('desc')).toHaveTextContent('The period before, Jan 2026 - Apr 2026, added up to 22.0 km.');
    });

    it('reads out what the stretch before had added up to by the same day', () => {
      render(<ProgressionChart atlas={buildProgressionAtlas(compareRuns, '3m', 'en', julyNow, { compare: true })} lang="en" unit="km" t={tFor('en')} />);
      const scrubber = screen.getByRole('slider');
      fireEvent.focus(scrubber);
      fireEvent.change(scrubber, { target: { value: '90' } });

      expect(scrubber.getAttribute('aria-valuetext')).toContain('Before: 22.0 km');
      expect(screen.getByText('Before: 22.0 km', { selector: '.hd-progression-readout-previous' })).toBeInTheDocument();
    });

    it('draws no second line and says nothing about a stretch before when it is not asked for', () => {
      const { container } = render(<ProgressionChart atlas={buildProgressionAtlas(compareRuns, '3m', 'en', julyNow)} lang="en" unit="km" t={tFor('en')} />);

      expect(container.querySelector('.hd-progression-line.is-previous')).toBeNull();
      expect(container.querySelector('.hd-progression-legend.is-compare')).toBeNull();
      expect(screen.getByRole('slider').getAttribute('aria-valuetext')).not.toContain('Before');
    });

    it('still draws the stretch before when the current one has no run in it', () => {
      const { container } = render(<ProgressionChart atlas={buildProgressionAtlas([compareRuns[0]], '3m', 'en', julyNow, { compare: true })} lang="en" unit="km" t={tFor('en')} />);

      expect(container.querySelector('.hd-progression-line.is-previous')).not.toBeNull();
      expect(screen.getByText(/No runs recorded in this period/)).toBeInTheDocument();
    });

    it('speaks Chinese and writes the figures in miles', () => {
      render(<ProgressionChart atlas={buildProgressionAtlas(compareRuns, '3m', 'zh-CN', julyNow, { compare: true })} lang="zh-CN" unit="mile" t={tFor('zh-CN')} />);

      expect(screen.getByText(/^之前：/, { selector: '.hd-progression-legend' })).toBeInTheDocument();
      const scrubber = screen.getByRole('slider');
      fireEvent.focus(scrubber);
      fireEvent.change(scrubber, { target: { value: '90' } });
      expect(scrubber.getAttribute('aria-valuetext')).toContain('之前：13.7 英里');
    });
  });
});
