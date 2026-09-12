import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../i18n/locales/en/pages';
import LandingRaceMap from './LandingRaceMap';

vi.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), en.landing[key.split('.').at(-1)] ?? key) }),
}));

const races = [
  { id: 'berlin', name: 'Berlin Marathon', date: 'SEP 2026', distance: '42.2K', pin: { x: 51.55, y: 8.55 } },
  { id: 'paris', name: 'Paris Marathon', date: 'APR 2027', distance: '42.2K', pin: { x: 49.45, y: 10.05 } },
  { id: 'tokyo', name: 'Tokyo Marathon', date: 'MAR 2027', distance: '42.2K', pin: { x: 83.65, y: 13.65 } },
  { id: 'sydney', name: 'Sydney Marathon', date: 'SEP 2026', distance: '42.2K', pin: { x: 85.25, y: 35.55 } },
];
let callbacks;
let clock;
let rafId;
let motion;

const mount = (items = races) => render(<LandingRaceMap races={items} mapImage="map.webp" />);
const advance = ms => act(() => {
  clock += ms;
  const pending = [...callbacks.values()];
  callbacks.clear();
  pending.forEach(callback => callback(clock));
});
const plane = () => document.querySelector('.landing-cinematic-map-aircraft');
const current = () => document.querySelector('.landing-race-map-detail');

beforeEach(() => {
  callbacks = new Map(); clock = 0; rafId = 0;
  motion = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => motion));
  vi.stubGlobal('requestAnimationFrame', callback => { callbacks.set(++rafId, callback); return rafId; });
  vi.stubGlobal('cancelAnimationFrame', id => callbacks.delete(id));
  vi.stubGlobal('IntersectionObserver', class { constructor(callback) { this.callback = callback; } observe() { this.callback([{ isIntersecting: true }]); } disconnect() {} });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('PointerEvent', class extends MouseEvent { constructor(type, init) { super(type, init); this.pointerId = init.pointerId; this.pointerType = init.pointerType; } });
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 335, height: 260, x: 0, y: 0, top: 0, left: 0, bottom: 260, right: 335 });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('interactive landing race map', () => {
  it('starts still, keeps the calendar closed, and shows honest month-level data', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Play the race tour' })).toHaveAttribute('aria-pressed', 'false');
    expect(document.querySelector('details')).not.toHaveAttribute('open');
    expect(current()).toHaveAttribute('data-race-id', 'berlin');
    expect(screen.getByText('Race month')).toBeVisible();
    expect(screen.queryByText('Countdown')).not.toBeInTheDocument();
    expect(callbacks.size).toBe(0);
  });

  it('moves to a chosen destination without React snapping the plane ahead of its flight', () => {
    mount();
    const start = plane().getAttribute('transform');
    fireEvent.click(screen.getByRole('button', { name: 'Next race' }));
    expect(current()).toHaveAttribute('data-race-id', 'paris');
    expect(plane()).toHaveAttribute('transform', start);
    advance(0); advance(750);
    expect(plane()).toHaveAttribute('data-destination', 'paris');
    expect(plane()).toHaveAttribute('data-flight-phase', 'dwell');
    expect(plane().getAttribute('transform')).toContain('translate(49.450000 10.050000)');
    expect(callbacks.size).toBe(0);
  });

  it('pauses and resumes the same tour frame without counting paused time', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Play the race tour' }));
    advance(0); advance(2000);
    const paused = plane().getAttribute('transform');
    fireEvent.click(screen.getByRole('button', { name: 'Pause the race tour' }));
    advance(6000);
    expect(plane()).toHaveAttribute('transform', paused);
    expect(callbacks.size).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Play the race tour' }));
    advance(0);
    expect(plane()).toHaveAttribute('transform', paused);
    advance(1000);
    expect(plane().getAttribute('transform')).toContain('translate(49.450000 10.050000)');
  });

  it('shows NYC, Boston and Chicago separately and selects NYC directly', () => {
    mount([...races,
      { ...races[0], id: 'nyc', name: 'New York City Marathon', mapLabel: 'NYC', pin: { x: 29.6, y: 12.15 } },
      { ...races[0], id: 'boston', name: 'Boston Marathon', mapLabel: 'Boston', pin: { x: 29.85, y: 11.6 } },
      { ...races[0], id: 'chicago', name: 'Chicago Marathon', mapLabel: 'Chicago', pin: { x: 27.45, y: 12.15 } },
    ]);
    const map = within(document.querySelector('.landing-race-map-viewport'));
    const nyc = map.getByRole('button', { name: 'New York City Marathon' });
    expect(nyc).toHaveTextContent('NYC');
    expect(map.getByRole('button', { name: 'Boston Marathon' })).toBeVisible();
    expect(map.getByRole('button', { name: 'Chicago Marathon' })).toBeVisible();
    expect(map.queryByRole('button', { name: /nearby races/ })).not.toBeInTheDocument();
    fireEvent.click(nyc);
    advance(0); advance(750);
    expect(current()).toHaveAttribute('data-race-id', 'nyc');
    expect(nyc).toHaveAttribute('aria-pressed', 'true');
    expect(plane().getAttribute('transform')).toContain('translate(29.600000 12.150000)');
  });

  it('supports zoom, keyboard panning, reset, and native page scrolling at fit', () => {
    mount();
    const viewport = document.querySelector('.landing-race-map-viewport');
    expect(viewport.style.touchAction).toBe('pan-y pinch-zoom');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(viewport).toHaveAttribute('data-zoom', '1.5');
    expect(viewport.style.touchAction).toBe('none');
    const before = document.querySelector('.landing-race-map-canvas').style.transform;
    fireEvent.keyDown(viewport, { key: 'ArrowLeft' });
    expect(document.querySelector('.landing-race-map-canvas').style.transform).not.toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Show the whole map' }));
    expect(viewport).toHaveAttribute('data-zoom', '1');
    expect(viewport.style.touchAction).toBe('pan-y pinch-zoom');
  });

  it('honors reduced motion and handles empty or single-destination data', () => {
    motion.matches = true;
    const { rerender } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Next race' }));
    advance(0);
    expect(plane()).toHaveAttribute('data-flight-phase', 'dwell');
    expect(callbacks.size).toBe(0);
    rerender(<LandingRaceMap races={[races[0]]} mapImage="map.webp" />);
    expect(screen.getByRole('button', { name: 'Next race' })).toBeDisabled();
    rerender(<LandingRaceMap races={[]} mapImage="map.webp" />);
    expect(screen.getByText('Race information is currently unavailable.')).toBeVisible();
  });

  it('pauses in hidden documents and cancels playback when unmounted', () => {
    const view = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Play the race tour' }));
    advance(0); advance(2000);
    const position = plane().getAttribute('transform');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    advance(5000);
    expect(callbacks.size).toBe(0);
    expect(plane()).toHaveAttribute('transform', position);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    advance(0);
    expect(plane()).toHaveAttribute('transform', position);
    view.unmount();
    expect(callbacks.size).toBe(0);
  });

  it('allows touch dragging only after zooming and releases cancelled gestures', () => {
    mount();
    const viewport = document.querySelector('.landing-race-map-viewport');
    viewport.setPointerCapture = vi.fn();
    viewport.hasPointerCapture = vi.fn(() => true);
    viewport.releasePointerCapture = vi.fn();
    const down = { pointerId: 7, pointerType: 'touch', button: 0, clientX: 160, clientY: 130 };
    fireEvent.pointerDown(viewport, down);
    expect(viewport.setPointerCapture).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    const canvas = document.querySelector('.landing-race-map-canvas');
    const original = canvas.style.transform;
    fireEvent.pointerDown(viewport, down);
    fireEvent.pointerDown(viewport, { ...down, pointerId: 8 });
    expect(viewport.setPointerCapture).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(viewport, { ...down, clientX: 120 });
    expect(canvas.style.transform).not.toBe(original);
    fireEvent.pointerCancel(viewport, down);
    expect(viewport.releasePointerCapture).toHaveBeenCalledWith(7);
    const cancelled = canvas.style.transform;
    fireEvent.pointerMove(viewport, { ...down, clientX: 80 });
    expect(canvas.style.transform).toBe(cancelled);
  });

  it('selects from the calendar, closes it, and returns keyboard focus to the map', () => {
    mount();
    const calendar = document.querySelector('details');
    fireEvent.click(calendar.querySelector('summary'));
    fireEvent.click(within(document.querySelector('.landing-race-calendar')).getByRole('button', { name: /Tokyo Marathon/ }));
    advance(0); advance(750);
    expect(calendar).not.toHaveAttribute('open');
    expect(current()).toHaveAttribute('data-race-id', 'tokyo');
    expect(document.querySelector('.landing-race-map-viewport')).toHaveFocus();
    expect(plane().getAttribute('transform')).toContain('translate(83.650000 13.650000)');
  });
});
