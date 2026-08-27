const RUNS_LOAD_MORE_MIN_MARGIN_PX = 360;

type RunsScrollPosition = {
  left: number;
  top: number;
};

type RunsScrollViewport = {
  scrollX: number;
  scrollY: number;
  document?: {
    documentElement?: {
      style?: {
        scrollBehavior: string;
      };
    };
  };
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  scrollTo: (x: number, y: number) => void;
};

export function getRunsLoadMoreRootMargin(viewportHeight: number): string {
  const normalizedHeight = Number(viewportHeight);
  const margin = Number.isFinite(normalizedHeight) && normalizedHeight > 0
    ? Math.max(RUNS_LOAD_MORE_MIN_MARGIN_PX, Math.round(normalizedHeight))
    : RUNS_LOAD_MORE_MIN_MARGIN_PX;
  return `${margin}px 0px ${margin}px`;
}

export function captureRunsScrollPosition(viewport: RunsScrollViewport): RunsScrollPosition {
  return {
    left: Number.isFinite(viewport.scrollX) ? viewport.scrollX : 0,
    top: Number.isFinite(viewport.scrollY) ? viewport.scrollY : 0,
  };
}

export function restoreRunsScrollPosition(
  viewport: RunsScrollViewport,
  position: RunsScrollPosition,
): number {
  return viewport.requestAnimationFrame(() => {
    const rootStyle = viewport.document?.documentElement?.style;
    const previousScrollBehavior = rootStyle?.scrollBehavior;
    if (rootStyle) rootStyle.scrollBehavior = 'auto';
    viewport.scrollTo(position.left, position.top);
    if (rootStyle) rootStyle.scrollBehavior = previousScrollBehavior ?? '';
  });
}

/**
 * Trims month groups (already sorted most-recent-first, each carrying its full
 * run list) down to a shared render budget. Groups keep their true aggregate
 * count/total for the header copy; only the rendered cards are limited, and
 * groups whose budget is exhausted are dropped entirely so no month header
 * renders above an empty grid. Runs the same for expanded and collapsed
 * months — folding a card never changes how many runs stream in.
 */
export function budgetMonthGroupsByRunCount<G extends { runs: unknown[] }>(
  groups: G[],
  limit: number,
): G[] {
  if (!Number.isFinite(limit)) return [];
  let budget = Math.max(0, Math.floor(limit));
  const budgeted: G[] = [];
  for (const group of groups) {
    if (budget <= 0) break;
    if (group.runs.length <= budget) {
      budget -= group.runs.length;
      budgeted.push(group);
      continue;
    }
    budgeted.push({ ...group, runs: group.runs.slice(0, budget) as G['runs'] });
    budget = 0;
  }
  return budgeted;
}
