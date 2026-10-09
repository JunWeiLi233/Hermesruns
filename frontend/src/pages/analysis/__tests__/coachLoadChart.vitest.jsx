import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CoachLoadChart from '../CoachLoadChart';
import { buildCoachLoadChartGeometry, getCoachLoadTooltipPosition } from '../coachLoadChartGeometry';
import en from '../../../i18n/locales/en';

const t = (key) => key.split('.').reduce((value, part) => value?.[part], en) || key;
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ t }) }));
const entries = Array.from({ length: 7 }, (_, index) => ({ day: `2026-10-0${index + 2}`, label: `Oct ${index + 2}`, acute: 16 + index * 3, chronic: 32 + index / 3 }));
const dashboard = { chartWindow: entries, chartLegendAcute: 'Acute (7d)', chartLegendChronic: 'Chronic (28d)' };
let measuredWidth;
let resize;
let disconnect;

beforeEach(() => {
  measuredWidth = 360;
  disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class { constructor(callback) { resize = callback; } observe() {} disconnect = disconnect; });
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => measuredWidth);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ left: 20, right: 20 + measuredWidth, top: 0, width: measuredWidth, height: 240 }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('uses readable scale increments, retains real values, and reduces date labels on phones', () => {
  const phone = buildCoachLoadChartGeometry(entries, 360);
  const desktop = buildCoachLoadChartGeometry(entries, 960);
  expect(phone.points.map(({ acute, chronic }) => [acute, chronic])).toEqual(entries.map(({ acute, chronic }) => [acute, chronic]));
  expect(phone.yTicks.map(({ value }) => value)).toEqual([0, 10, 20, 30, 40]);
  expect(phone.xTicks).toHaveLength(3);
  expect(desktop.xTicks).toHaveLength(5);
  expect(phone.xTicks.at(-1).day).toBe(entries.at(-1).day);
  expect(phone.points.every(({ x }) => x >= 0 && x <= 360)).toBe(true);
});

it('keeps tooltips inside the plot at both edges and at low and high values', () => {
  for (const width of [220, 360, 960]) {
    const geometry = buildCoachLoadChartGeometry(entries, width);
    for (const point of [geometry.points[0], geometry.points.at(-1), { x: width / 2, acuteY: geometry.baseline, chronicY: geometry.baseline }]) {
      const position = getCoachLoadTooltipPosition(point, geometry);
      expect(position.left).toBeGreaterThanOrEqual(8);
      expect(position.left + position.width).toBeLessThanOrEqual(width - 8);
      expect(position.top).toBeGreaterThanOrEqual(8);
      expect(position.top + 110).toBeLessThanOrEqual(geometry.baseline - 8);
    }
  }
});

it('handles zero load, a single day, and empty history without invalid geometry', () => {
  expect(buildCoachLoadChartGeometry([], 360)).toBeNull();
  const geometry = buildCoachLoadChartGeometry([{ ...entries[0], acute: 0, chronic: 0 }], 360);
  expect(geometry.xTicks).toHaveLength(1);
  expect(geometry.points[0].acuteY).toBe(geometry.baseline);
  expect(geometry.acutePath).not.toMatch(/NaN|Infinity/);
  const { container } = render(<CoachLoadChart dashboard={{ ...dashboard, chartWindow: [] }} />);
  expect(screen.getByText(t('analysisInsight.load_no_data'))).toBeInTheDocument();
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  expect(container.querySelector('svg')).toBeNull();
});

it('inspects the closest day with a pointer and restores latest values on leaving', () => {
  const { container } = render(<CoachLoadChart dashboard={dashboard} />);
  const plot = screen.getByRole('slider');
  fireEvent.pointerMove(plot, { clientX: 20 + 36 });
  expect(plot).toHaveAttribute('aria-valuetext', 'Oct 2, Acute (7d): 16, Chronic (28d): 32');
  expect(container.querySelector('.coach-load-chart__tooltip')).toHaveTextContent('Oct 2');
  expect(container.querySelectorAll('[data-analysis-history="coach"] li')).toHaveLength(7);
  fireEvent.pointerLeave(plot);
  expect(container.querySelector('.coach-load-chart__tooltip')).toBeNull();
  expect(plot).toHaveAttribute('aria-valuenow', '6');
});

it('supports keyboard inspection with bounded arrow keys, Home, End, and Escape', () => {
  const { container } = render(<CoachLoadChart dashboard={dashboard} />);
  const plot = screen.getByRole('slider');
  fireEvent.focus(plot);
  fireEvent.keyDown(plot, { key: 'ArrowLeft' });
  expect(plot).toHaveAttribute('aria-valuenow', '5');
  fireEvent.keyDown(plot, { key: 'Home' });
  fireEvent.keyDown(plot, { key: 'ArrowLeft' });
  expect(plot).toHaveAttribute('aria-valuenow', '0');
  fireEvent.keyDown(plot, { key: 'End' });
  fireEvent.keyDown(plot, { key: 'ArrowRight' });
  expect(plot).toHaveAttribute('aria-valuenow', '6');
  fireEvent.keyDown(plot, { key: 'Escape' });
  expect(container.querySelector('.coach-load-chart__tooltip')).toBeNull();
});

it('remeasures after resizing and clears the selected day when the date window switches', () => {
  const { container, rerender } = render(<CoachLoadChart key={7} dashboard={dashboard} />);
  fireEvent.focus(screen.getByRole('slider'));
  measuredWidth = 960;
  fireEvent(window, new Event('resize'));
  // ResizeObserver drives the component independently of viewport event handlers.
  resize();
  rerender(<CoachLoadChart key={28} dashboard={{ ...dashboard, chartWindow: [entries[0]] }} />);
  expect(disconnect).toHaveBeenCalled();
  expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 960 280');
  expect(container.querySelector('.coach-load-chart__tooltip')).toBeNull();
  expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Oct 2, Acute (7d): 16, Chronic (28d): 32');
});
