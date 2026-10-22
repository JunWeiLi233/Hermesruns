import { useCallback, useEffect, useRef } from 'react';

/** How long a part is kept at the top of the screen after the page last changed its height, once nothing on it says it is loading. */
export const HOLD_MS = 4000;
/** The longest a part is kept, however slowly the page loads. */
export const HOLD_MAX_MS = 20000;
/** How often the page is looked at, to see whether it has stopped changing and loading. */
export const LOOK_MS = 500;

/** Whatever the reader does with these, they are steering the page themselves, and it is not moved for them any more. */
const READER_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'];

/**
 * Takes the reader to an element and keeps it at the top of the screen while the page fills in around it.
 *
 * The cards above a part load their numbers after the page is drawn and push the part down the screen, so a jump that was right when it was made
 * can leave the reader looking at the card above it. Each change in the height of the page takes the element back to the top, at once (the page
 * scrolls smoothly otherwise, and a correction that glides is a page that wanders). That goes on while anything on the page says it is loading
 * (`aria-busy`, which the cards set while their numbers are on the way: on a slow network that can be many seconds) and for `HOLD_MS` after the page
 * last changed, until the reader scrolls, touches, types or clicks (from then on the page is theirs) or `HOLD_MAX_MS` have passed. The element also
 * gets the keyboard focus, without a scroll of its own, so the next Tab goes into it; it needs a `tabIndex` of -1 for that.
 *
 * Returns `holdAt(element, { behavior })`. `behavior` is how the first scroll goes: 'auto' follows the page (smooth here, for a click), 'instant' is
 * for arriving at an address. A new call lets go of the one before it, and so does leaving the page. With no element it only lets go.
 */
export default function useScrollHold() {
  const release = useRef(null);

  const letGo = useCallback(() => {
    release.current?.();
    release.current = null;
  }, []);

  const holdAt = useCallback((element, { behavior = 'auto' } = {}) => {
    letGo();
    if (!element) return;
    const bring = (how) => element.scrollIntoView({ block: 'start', behavior: how });
    bring(behavior);
    element.focus({ preventScroll: true });

    const began = Date.now();
    let changedAt = began;
    let height = document.documentElement.scrollHeight;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      const next = document.documentElement.scrollHeight;
      if (next === height) return;
      height = next;
      changedAt = Date.now();
      bring('instant');
    });
    observer?.observe(document.body);
    observer?.observe(document.documentElement);

    let timer;
    const look = () => {
      const now = Date.now();
      const loading = document.querySelector('[aria-busy="true"]') != null;
      if (now - began >= HOLD_MAX_MS || (!loading && now - changedAt >= HOLD_MS)) {
        letGo();
        return;
      }
      timer = window.setTimeout(look, LOOK_MS);
    };
    timer = window.setTimeout(look, LOOK_MS);
    READER_EVENTS.forEach((name) => window.addEventListener(name, letGo, { passive: true }));
    release.current = () => {
      observer?.disconnect();
      window.clearTimeout(timer);
      READER_EVENTS.forEach((name) => window.removeEventListener(name, letGo));
    };
  }, [letGo]);

  useEffect(() => letGo, [letGo]);
  return holdAt;
}
