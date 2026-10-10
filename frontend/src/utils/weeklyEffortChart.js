/**
 * The geometry of the weekly effort chart: a bar for the effort of each week, and behind each bar a lighter block for
 * the range the week was compared with (the mean of the three weeks before it, give or take a band). Pure, like the
 * fitness chart's.
 */

import { niceCeiling } from './fitnessChart';

/** The tone each status the server sends is shown in (a class on the chip); the words are in the locale files. */
export const WEEK_STATUS_TONE = {
  within: 'good',
  above: 'high',
  below: 'low',
  building: 'neutral',
  none: 'neutral',
};

/**
 * @param weeks the weeks as the server sends them, oldest first: `start`, `total`, `runs`, `complete`, `range`
 *              (`{ low, high, average }` or null) and `status`
 * @returns null when there are no weeks, else every bar with its box, the range block behind it, and the ticks
 */
export function buildWeeklyChart(weeks, { width = 640, height = 220 } = {}) {
  const rows = Array.isArray(weeks) ? weeks.filter((week) => week && Number.isFinite(week.total)) : [];
  if (rows.length === 0) return null;

  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = width - padL - padR;
  const baseline = height - padB;
  const top = padT;
  const tallest = Math.max(...rows.map((week) => Math.max(week.total, week.range?.high ?? 0)));
  const step = Math.max(5, niceCeiling((tallest * 1.1) / 4));
  const yMax = step * 4;
  const yOf = (value) => baseline - (Math.max(0, value) / yMax) * (baseline - top);

  const slot = plotW / rows.length;
  const barW = Math.max(6, Math.min(44, slot * 0.56));
  const bars = rows.map((week, index) => {
    const centre = padL + slot * (index + 0.5);
    const barTop = yOf(week.total);
    return {
      index,
      week,
      x: centre - barW / 2,
      centre,
      width: barW,
      y: barTop,
      height: Math.max(week.total > 0 ? 2 : 0, baseline - barTop),
      slotX: padL + slot * index,
      slotWidth: slot,
      range: week.range
        ? { y: yOf(week.range.high), height: Math.max(2, yOf(week.range.low) - yOf(week.range.high)) }
        : null,
    };
  });

  // A label under every n-th week counted back from the current one, so the gaps between them are the same and the newest week is named.
  const maxTicks = width < 480 ? 3 : width < 720 ? 5 : 7;
  const every = Math.max(1, Math.ceil(bars.length / maxTicks));
  const xTicks = bars.filter((bar) => (bars.length - 1 - bar.index) % every === 0);
  const yTicks = [0, 1, 2, 3, 4].map((index) => ({ value: step * index, y: yOf(step * index) }));

  return { width, height, padL, padR, padT: top, baseline, yMax, bars, xTicks, yTicks, slot, barW };
}

/** Where the readout for a week goes: over the bar, on whichever side of the chart has room. */
export function weeklyTooltipPosition(bar, geometry, { width = 188, height = 112 } = {}) {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const boxWidth = Math.min(width, geometry.width - 16);
  const preferred = bar.centre + 18;
  const left = clamp(preferred + boxWidth <= geometry.width - 8 ? preferred : bar.centre - boxWidth - 18, 8, geometry.width - boxWidth - 8);
  const top = clamp(bar.y - height / 2, 8, geometry.baseline - height + 24);
  return { width: boxWidth, left, top };
}
