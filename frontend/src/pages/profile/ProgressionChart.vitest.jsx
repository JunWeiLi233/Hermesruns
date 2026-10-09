import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProgressionChart from './ProgressionChart';
import { buildProgressionAtlas } from '../../utils/progressionAtlas';
import translations from '../../i18n/translations';

const tFor = (lang) => (key) => key.split('.').reduce((value, part) => value?.[part], translations[lang]) || key;
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
});
