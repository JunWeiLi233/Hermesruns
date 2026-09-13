import { afterEach, expect, it, vi } from 'vitest';
import { installRoutePreloadListener, routePreloaders } from './routePreload';

let uninstall;
afterEach(() => { uninstall?.(); document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function pointer(type) {
  const event = new Event('pointerover', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: type });
  return event;
}
it('does not fetch route chunks while a touch pointer passes over a link', () => {
  const loader = vi.spyOn(routePreloaders, '/shoes').mockResolvedValue({});
  document.body.innerHTML = '<a href="/shoes">Shoes</a>';
  uninstall = installRoutePreloadListener();
  document.querySelector('a').dispatchEvent(pointer('touch'));
  expect(loader).not.toHaveBeenCalled();
  document.querySelector('a').dispatchEvent(pointer('mouse'));
  expect(loader).toHaveBeenCalledTimes(1);
});
it('respects data saver without preventing ordinary link navigation', () => {
  const loader = vi.spyOn(routePreloaders, '/schedule').mockResolvedValue({});
  vi.stubGlobal('navigator', { connection: { saveData: true } });
  document.body.innerHTML = '<a href="/schedule">Schedule</a>';
  uninstall = installRoutePreloadListener();
  const event = new Event('focusin', { bubbles: true, cancelable: true });
  document.querySelector('a').dispatchEvent(event);
  expect(loader).not.toHaveBeenCalled();
  expect(event.defaultPrevented).toBe(false);
  expect(document.querySelector('a').getAttribute('href')).toBe('/schedule');
});
