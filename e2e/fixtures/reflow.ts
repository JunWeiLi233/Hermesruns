// What a page does when the text is made larger (a browser set to a big font, WCAG 1.4.4) on a small screen (1.4.10): what runs out of the screen, and what runs into what.
import type { Locator, Page } from '@playwright/test';

/** Makes the text of the page `percent` of its size: the root font size, which everything in rem follows. */
export async function enlargeText(page: Page, percent: number): Promise<void> {
  await page.addStyleTag({ content: `html { font-size: ${percent}% !important; }` });
}

/**
 * The readings (a name, a number, a line under them) of the cards that are rows of one card on a phone, and whose name is wider than the box it is in
 * (it runs out of it, into the number) or whose box crosses the box of the number. Each is described by its name; an empty list is a page that reflows.
 */
export async function readingsThatCollide(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((rowSelector) => {
    const found: string[] = [];
    document.querySelectorAll(rowSelector).forEach((row, index) => {
      const label = row.querySelector('span') as HTMLElement | null;
      const number = row.querySelector('strong') as HTMLElement | null;
      if (!label || !number) return;
      const a = label.getBoundingClientRect();
      const b = number.getBoundingClientRect();
      const crosses = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
      const runsOut = label.scrollWidth > label.clientWidth + 1;
      if (crosses || runsOut) found.push(`${index + 1}: "${(label.textContent ?? '').trim().slice(0, 24)}" ${crosses ? 'crosses its number' : 'runs out of its box'}`);
    });
    return found;
  }, selector);
}

/**
 * What is cut off at the edge of the screen. The page hides what is beyond its right edge (html has overflow-x: hidden), so a document that does not scroll sideways says
 * nothing: every element is looked at, except what lives inside a frame that scrolls on its own, a drawing, or text for a screen reader.
 */
export async function elementsBeyondTheEdge(page: Page): Promise<string[]> {
  return page.evaluate(() => Array.from(document.querySelectorAll('#root *'))
    .filter((node) => !node.closest('svg, table, .sr-only, .vo2max-estimates-v2__table-wrap'))
    .filter((node) => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && (box.right > window.innerWidth + 1 || box.left < -1);
    })
    .map((node) => `${node.tagName.toLowerCase()}.${String(node.className).split(' ')[0]} "${(node.textContent ?? '').trim().slice(0, 30)}" right=${Math.round(node.getBoundingClientRect().right)}`));
}

/**
 * How far the readout of a chart sticks out of the chart's box, side by side ('' when it is inside): a readout placed by a guess of its size is inside at the usual text size
 * and runs over the text under the chart when the text is larger.
 */
export async function readoutSticksOut(chart: Locator, readoutSelector: string): Promise<string> {
  return chart.evaluate((node, selector) => {
    const frame = node.getBoundingClientRect();
    const tip = node.querySelector(selector)?.getBoundingClientRect();
    if (!tip) return 'there is no readout';
    const out: string[] = [];
    if (tip.left < frame.left - 1) out.push(`${Math.round(frame.left - tip.left)} px over the left edge`);
    if (tip.right > frame.right + 1) out.push(`${Math.round(tip.right - frame.right)} px over the right edge`);
    if (tip.top < frame.top - 1) out.push(`${Math.round(frame.top - tip.top)} px over the top`);
    if (tip.bottom > frame.bottom + 1) out.push(`${Math.round(tip.bottom - frame.bottom)} px under the foot`);
    return out.join(', ');
  }, readoutSelector);
}
