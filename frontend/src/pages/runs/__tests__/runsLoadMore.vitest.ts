import { describe, expect, it, vi } from 'vitest';

import * as runsLoadMore from '../runsLoadMore';

const { getRunsLoadMoreRootMargin } = runsLoadMore;

describe('getRunsLoadMoreRootMargin', () => {
  it('preloads one viewport ahead of an expanded month grid', () => {
    expect(getRunsLoadMoreRootMargin(768)).toBe('768px 0px 768px');
  });

  it('keeps a minimum preload distance when the viewport is small or unavailable', () => {
    expect(getRunsLoadMoreRootMargin(320)).toBe('360px 0px 360px');
    expect(getRunsLoadMoreRootMargin(0)).toBe('360px 0px 360px');
  });

  it('restores the saved Runs viewport after a list mutation without smooth scrolling', () => {
    const captureScrollPosition = Reflect.get(runsLoadMore, 'captureRunsScrollPosition') as undefined | ((viewport: unknown) => { left: number; top: number });
    const restoreScrollPosition = Reflect.get(runsLoadMore, 'restoreRunsScrollPosition') as undefined | ((viewport: unknown, position: { left: number; top: number }) => number);

    expect(captureScrollPosition).toBeTypeOf('function');
    expect(restoreScrollPosition).toBeTypeOf('function');

    let animationFrameCallback: FrameRequestCallback | null = null;
    const scrollTo = vi.fn();
    const rootStyle = { scrollBehavior: 'smooth' };
    const viewport = {
      scrollX: 18,
      scrollY: 742,
      document: { documentElement: { style: rootStyle } },
      requestAnimationFrame(callback: FrameRequestCallback) {
        animationFrameCallback = callback;
        return 41;
      },
      scrollTo,
    };

    const position = captureScrollPosition!(viewport);
    expect(position).toEqual({ left: 18, top: 742 });
    expect(restoreScrollPosition!(viewport, position)).toBe(41);
    expect(scrollTo).not.toHaveBeenCalled();

    animationFrameCallback!(0);
    expect(scrollTo).toHaveBeenCalledWith(18, 742);
    expect(rootStyle.scrollBehavior).toBe('smooth');
  });
});
