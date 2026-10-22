// How well the marks of a chart show against what is behind them, worked out from what the browser paints: for the specs that check a chart in every theme.
import type { Page } from '@playwright/test';

export type Mark = { selector: string; paint: 'fill' | 'stroke'; what: string };

/**
 * How well a mark of a chart shows against what is behind it (WCAG 1.4.11 asks 3 to 1 for a graphic you need to read the chart): the
 * colour it is painted in, at its own opacity and its parents', over the first solid background behind it, as a ratio of luminances.
 */
export async function markRatios(page: Page, marks: Mark[]): Promise<Array<{ what: string; ratio: number; mark: string; behind: string }>> {
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'), undefined, { timeout: 5000 }).catch(() => undefined);
  return page.evaluate((list) => {
    type Rgba = [number, number, number, number];
    const parse = (value: string): Rgba | null => {
      const legacy = /^rgba?\(([^)]+)\)$/.exec(value);
      if (legacy) {
        const parts = legacy[1].split(/[\s,/]+/).filter(Boolean).map(Number);
        return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
      }
      const modern = /^color\(srgb ([^)]+)\)$/.exec(value);
      if (modern) {
        const parts = modern[1].split(/[\s/]+/).filter(Boolean).map(Number);
        return [parts[0] * 255, parts[1] * 255, parts[2] * 255, parts.length > 3 ? parts[3] : 1];
      }
      return null;
    };
    const over = (top: Rgba, bottom: Rgba): Rgba => [top[0] * top[3] + bottom[0] * (1 - top[3]), top[1] * top[3] + bottom[1] * (1 - top[3]), top[2] * top[3] + bottom[2] * (1 - top[3]), 1];
    const light = (c: number): number => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (c: Rgba): number => 0.2126 * light(c[0]) + 0.7152 * light(c[1]) + 0.0722 * light(c[2]);
    const hex = (c: Rgba): string => `#${[c[0], c[1], c[2]].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
    return list.flatMap((mark) => {
      const el = document.querySelector(mark.selector);
      if (!el) return [{ what: `${mark.what} (not on the page)`, ratio: 0, mark: '', behind: '' }];
      const style = getComputedStyle(el);
      const paint = parse(style.getPropertyValue(mark.paint));
      if (!paint) return [{ what: `${mark.what} (no ${mark.paint} colour)`, ratio: 0, mark: style.getPropertyValue(mark.paint), behind: '' }];
      let opacity = Number(style.getPropertyValue(`${mark.paint}-opacity`) || 1);
      const layers: Rgba[] = [];
      for (let node: Element | null = el; node; node = node.parentElement) {
        const cs = getComputedStyle(node);
        opacity *= Number(cs.opacity);
        const bg = parse(cs.backgroundColor);
        if (bg && bg[3] > 0) layers.push(bg);
        if (bg && bg[3] >= 1) break;
      }
      const dark = document.body.classList.contains('theme-midnight') || document.body.classList.contains('theme-high-contrast');
      let behind: Rgba = dark ? [18, 18, 18, 1] : [255, 255, 255, 1];
      for (const layer of layers.reverse()) behind = over(layer, behind);
      const shown = over([paint[0], paint[1], paint[2], paint[3] * opacity], behind);
      const [hi, lo] = [luminance(shown), luminance(behind)].sort((a, b) => b - a);
      return [{ what: mark.what, ratio: (hi + 0.05) / (lo + 0.05), mark: hex(shown), behind: hex(behind) }];
    });
  }, marks);
}
