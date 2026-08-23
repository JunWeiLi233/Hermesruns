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
