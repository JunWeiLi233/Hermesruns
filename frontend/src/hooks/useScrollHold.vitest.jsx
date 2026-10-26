import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useScrollHold, { HOLD_MAX_MS, HOLD_MS, LOOK_MS } from './useScrollHold';

/** The page asks for a hold on an element by its test id; the tests reach the hold through `held.holdAt`. */
const held = { holdAt: null };

function Page() {
  held.holdAt = useScrollHold();
  return (
    <main>
      <section data-testid="first" tabIndex={-1}>first</section>
      <section data-testid="second" tabIndex={-1}>second</section>
    </main>
  );
}

/** A ResizeObserver the test can fire by hand: `watchers` are the live ones, each with what it watches. */
let watchers;
class FakeObserver {
  constructor(callback) {
    this.callback = callback;
    this.targets = [];
    this.live = true;
    watchers.push(this);
  }
  observe(node) { this.targets.push(node); }
  disconnect() { this.live = false; }
}

/** The height of the page, which jsdom does not lay out: the tests say what it is. */
let pageHeight;
let heightSpy;
/** The page is told it changed size, to `height` (or by 300 px when none is given): every live observer is notified. */
const resize = (height = pageHeight + 300) => act(() => {
  pageHeight = height;
  watchers.filter((watcher) => watcher.live).forEach((watcher) => watcher.callback([]));
});

beforeEach(() => {
  watchers = [];
  pageHeight = 2000;
  heightSpy = vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(() => pageHeight);
  vi.stubGlobal('ResizeObserver', FakeObserver);
  Element.prototype.scrollIntoView = vi.fn();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  heightSpy.mockRestore();
  delete Element.prototype.scrollIntoView;
});

const scrolledTo = () => Element.prototype.scrollIntoView.mock.contexts.map((node) => node.dataset.testid);
const howItScrolled = () => Element.prototype.scrollIntoView.mock.calls.map(([options]) => options);

describe('holding an element at the top of the screen', () => {
  it('takes the reader to the element at once, with the keyboard focus on it, the way the page scrolls', () => {
    render(<Page />);
    act(() => held.holdAt(screen.getByTestId('second')));

    expect(scrolledTo()).toEqual(['second']);
    expect(howItScrolled()).toEqual([{ block: 'start', behavior: 'auto' }]);
    expect(document.activeElement).toBe(screen.getByTestId('second'));
  });

  it('can be asked for the first scroll to be instant, to arrive at an address and not glide there', () => {
    render(<Page />);
    act(() => held.holdAt(screen.getByTestId('second'), { behavior: 'instant' }));

    expect(howItScrolled()).toEqual([{ block: 'start', behavior: 'instant' }]);
  });

  it('takes it back to the top, at once, every time the page changes height while it fills in around the element', () => {
    render(<Page />);
    act(() => held.holdAt(screen.getByTestId('second')));

    resize();
    resize();

    expect(scrolledTo()).toEqual(['second', 'second', 'second']);
    expect(howItScrolled().map((options) => options.behavior)).toEqual(['auto', 'instant', 'instant']);
    expect(watchers[0].targets).toEqual([document.body, document.documentElement]);
  });

  it('leaves the page as it is when it changes size but not height, and when the first notice comes with the height it had', () => {
    render(<Page />);
    act(() => held.holdAt(screen.getByTestId('second')));

    resize(2000);
    resize(2000);

    expect(scrolledTo()).toEqual(['second']);
  });

  it.each([['wheel'], ['touchstart'], ['pointerdown'], ['keydown']])('stops when the reader acts (%s): the page is theirs from then on', (name) => {
    render(<Page />);
    act(() => held.holdAt(screen.getByTestId('first')));
    expect(watchers[0].live).toBe(true);

    act(() => { fireEvent(window, new Event(name)); });
    resize();

    expect(watchers[0].live).toBe(false);
    expect(scrolledTo()).toEqual(['first']);
  });

  it('stops after a few seconds, so a page that keeps growing is not fought over for ever', () => {
    render(<Page />);
    act(() => held.holdAt(screen.getByTestId('first')));

    act(() => { vi.advanceTimersByTime(HOLD_MS - 1); });
    expect(watchers[0].live).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(watchers[0].live).toBe(false);
    resize();

    expect(scrolledTo()).toEqual(['first']);
  });

  it('lets go of the one before when it is asked for another element', () => {
    render(<Page />);
    act(() => held.holdAt(screen.getByTestId('first')));
    act(() => held.holdAt(screen.getByTestId('second')));

    expect(watchers.map((watcher) => watcher.live)).toEqual([false, true]);
    resize();
    expect(scrolledTo()).toEqual(['first', 'second', 'second']);
    expect(document.activeElement).toBe(screen.getByTestId('second'));
  });

  it('lets go when the page is left, and leaves nothing behind that listens', () => {
    const removed = vi.spyOn(window, 'removeEventListener');
    const started = vi.spyOn(window, 'setTimeout');
    const cleared = vi.spyOn(window, 'clearTimeout');
    const { unmount } = render(<Page />);
    act(() => held.holdAt(screen.getByTestId('first')));
    const holdTimer = started.mock.results[started.mock.calls.findIndex(([, wait]) => wait === LOOK_MS)].value;

    unmount();

    expect(watchers[0].live).toBe(false);
    expect(removed.mock.calls.map(([name]) => name).sort()).toEqual(['keydown', 'pointerdown', 'touchstart', 'wheel']);
    expect(cleared).toHaveBeenCalledWith(holdTimer);
    removed.mockRestore();
    started.mockRestore();
    cleared.mockRestore();
  });

  describe('on a page that loads slowly', () => {
    /** Something on the page says it is loading, as the cards of Load balance do while their numbers are on the way. */
    const loading = () => {
      const node = document.createElement('div');
      node.setAttribute('aria-busy', 'true');
      document.body.appendChild(node);
      return node;
    };
    afterEach(() => { document.querySelectorAll('[aria-busy="true"]').forEach((node) => node.remove()); });

    it('holds on while something on the page says it is loading, however long that is, and lets go a few seconds after it has finished', () => {
      render(<Page />);
      const busy = loading();
      act(() => held.holdAt(screen.getByTestId('second')));

      act(() => { vi.advanceTimersByTime(HOLD_MS * 3); });
      expect(watchers[0].live).toBe(true);
      resize();
      expect(scrolledTo()).toEqual(['second', 'second']);

      busy.remove();
      act(() => { vi.advanceTimersByTime(HOLD_MS - LOOK_MS); });
      expect(watchers[0].live).toBe(true);
      act(() => { vi.advanceTimersByTime(LOOK_MS); });
      expect(watchers[0].live).toBe(false);
    });

    it('holds on for a few seconds after the page last changed its height, and not from the moment it was asked', () => {
      render(<Page />);
      act(() => held.holdAt(screen.getByTestId('first')));

      act(() => { vi.advanceTimersByTime(HOLD_MS - 1000); });
      resize();
      act(() => { vi.advanceTimersByTime(HOLD_MS - LOOK_MS); });
      expect(watchers[0].live).toBe(true);
      act(() => { vi.advanceTimersByTime(LOOK_MS); });
      expect(watchers[0].live).toBe(false);
    });

    it('lets go at last, however long the page goes on loading', () => {
      render(<Page />);
      loading();
      act(() => held.holdAt(screen.getByTestId('first')));

      act(() => { vi.advanceTimersByTime(HOLD_MAX_MS - LOOK_MS); });
      expect(watchers[0].live).toBe(true);
      act(() => { vi.advanceTimersByTime(LOOK_MS); });
      expect(watchers[0].live).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('lets go at once when the reader acts, loading or not', () => {
      render(<Page />);
      loading();
      act(() => held.holdAt(screen.getByTestId('first')));

      act(() => { fireEvent(window, new Event('wheel')); });
      expect(watchers[0].live).toBe(false);
      // Nothing of the hold is left to run: all the time there is passes and the page is not touched.
      act(() => { vi.advanceTimersByTime(HOLD_MAX_MS * 2); });
      expect(scrolledTo()).toEqual(['first']);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it('does nothing for no element, and lets go of the hold it had', () => {
    render(<Page />);
    act(() => held.holdAt(screen.getByTestId('first')));
    act(() => held.holdAt(null));

    expect(watchers[0].live).toBe(false);
    expect(scrolledTo()).toEqual(['first']);
  });

  it('still takes the reader there once, where the browser has no ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    render(<Page />);
    act(() => held.holdAt(screen.getByTestId('second')));

    expect(scrolledTo()).toEqual(['second']);
    expect(document.activeElement).toBe(screen.getByTestId('second'));
    expect(watchers).toHaveLength(0);
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    expect(vi.getTimerCount()).toBe(0);
  });
});
