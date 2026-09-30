import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../i18n/locales/en/pages';
import { GLOBE_FLIGHT_MS, GLOBE_TOUR_DWELL_MS, globeFrame } from '../../utils/landingGlobe';
import LandingRaceMap from './LandingRaceMap';

vi.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), en.landing[key.split('.').at(-1)] ?? key) }),
}));

const races = [
  { id: 'berlin', name: 'Berlin Marathon', mapLabel: 'Berlin', date: 'SEP 2026', distance: '42.2K', geo: { lat: 52.52, lng: 13.405 } },
  { id: 'paris', name: 'Paris Marathon', mapLabel: 'Paris', date: 'APR 2027', distance: '42.2K', geo: { lat: 48.8566, lng: 2.3522 } },
  { id: 'tokyo', name: 'Tokyo Marathon', mapLabel: 'Tokyo', date: 'MAR 2027', distance: '42.2K', geo: { lat: 35.685, lng: 139.76 } },
  { id: 'sydney', name: 'Sydney Marathon', mapLabel: 'Sydney', date: 'SEP 2026', distance: '42.2K', geo: { lat: -33.8688, lng: 151.2093 } },
];
const SIZE = { width: 335, height: 260 };
const CENTRE = `translate(${(SIZE.width / 2).toFixed(2)} ${(SIZE.height / 2).toFixed(2)})`;
const RADIUS = globeFrame(SIZE).radius;
let callbacks;
let clock;
let rafId;
let motion;
let intersect;
let startOnScreen;

const mount = (items = races) => render(<LandingRaceMap races={items} />);
const advance = ms => act(() => {
  clock += ms;
  const pending = [...callbacks.values()];
  callbacks.clear();
  pending.forEach(callback => callback(clock));
});
const run = (ms, step = 50) => { for (let elapsed = 0; elapsed < ms; elapsed += step) advance(Math.min(step, ms - elapsed)); };
const settle = () => { for (let frame = 0; frame < 200 && callbacks.size; frame += 1) advance(50); };
const plane = () => document.querySelector('.landing-cinematic-map-aircraft');
const current = () => document.querySelector('.landing-race-map-detail');
const viewport = () => document.querySelector('.landing-race-map-viewport');
const view = () => ({ lat: Number(viewport().dataset.viewLat), lng: Number(viewport().dataset.viewLng) });
const expectView = (lat, lng) => { expect(view().lat).toBeCloseTo(lat, 1); expect(view().lng).toBeCloseTo(lng, 1); };
const marker = id => viewport().querySelector(`.landing-race-map-marker[data-race-id="${id}"]`);
const cluster = [
  races[0],
  { ...races[0], id: 'london', name: 'London Marathon', mapLabel: 'London', geo: { lat: 51.5074, lng: -0.1278 } },
  races[1],
  { ...races[0], id: 'valencia', name: 'Valencia Marathon', mapLabel: 'Valencia', geo: { lat: 39.4699, lng: -0.3763 } },
  { ...races[0], id: 'nyc', name: 'New York City Marathon', mapLabel: 'NYC', geo: { lat: 40.7128, lng: -74.006 } },
  { ...races[0], id: 'boston', name: 'Boston Marathon', mapLabel: 'Boston', geo: { lat: 42.3601, lng: -71.0589 } },
  { ...races[0], id: 'chicago', name: 'Chicago Marathon', mapLabel: 'Chicago', geo: { lat: 41.8781, lng: -87.6298 } },
];
const labelBox = button => {
  const [, x, y] = button.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
  return { x: Number(x), y: Number(y), width: parseFloat(button.style.width), height: 44 };
};

beforeEach(() => {
  callbacks = new Map(); clock = 0; rafId = 0; startOnScreen = true;
  motion = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => motion));
  vi.stubGlobal('requestAnimationFrame', callback => { callbacks.set(++rafId, callback); return rafId; });
  vi.stubGlobal('cancelAnimationFrame', id => callbacks.delete(id));
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback) { this.callback = callback; intersect = onScreen => act(() => this.callback([{ isIntersecting: onScreen }])); }
    observe() { this.callback([{ isIntersecting: startOnScreen }]); }
    disconnect() {}
  });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('PointerEvent', class extends MouseEvent { constructor(type, init) { super(type, init); this.pointerId = init.pointerId; this.pointerType = init.pointerType; } });
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  // jsdom has no canvas: the globe must still lay out labels and the airliner without a 2D context.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ ...SIZE, x: 0, y: 0, top: 0, left: 0, bottom: SIZE.height, right: SIZE.width });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('interactive landing race globe', () => {
  it('starts on the first race with the calendar closed and honest month-level data', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Play the race tour' })).toHaveAttribute('aria-pressed', 'false');
    expect(document.querySelector('details')).not.toHaveAttribute('open');
    expect(current()).toHaveAttribute('data-race-id', 'berlin');
    expect(screen.getByText('Race month')).toBeVisible();
    expect(screen.queryByText('Countdown')).not.toBeInTheDocument();
    expectView(52.52, 13.405);
    expect(plane()).toHaveAttribute('data-destination', 'berlin');
    expect(plane()).toHaveAttribute('data-flight-phase', 'dwell');
    expect(plane().getAttribute('transform')).toContain(CENTRE);
    expect(screen.getByText('Drag to spin the globe. Choose a city to fly there.')).toBeVisible();
  });

  it('slowly spins while idle and stops for good once the visitor interacts', () => {
    mount();
    expect(callbacks.size).toBe(1);
    advance(0); advance(1000);
    expect(view().lng).toBeCloseTo(13.405 - 5.5, 1);
    fireEvent.keyDown(viewport(), { key: 'ArrowRight' });
    const turned = view().lng;
    settle();
    expect(callbacks.size).toBe(0);
    expect(view().lng).toBe(turned);
  });

  it('flies the airliner along the arc to the next race and dwells there', () => {
    mount();
    const start = plane().getAttribute('transform');
    fireEvent.click(screen.getByRole('button', { name: 'Next race' }));
    expect(current()).toHaveAttribute('data-race-id', 'paris');
    expect(plane()).toHaveAttribute('transform', start);
    expect(plane()).toHaveAttribute('data-destination', 'paris');
    advance(0); advance(GLOBE_FLIGHT_MS / 2);
    expect(plane()).toHaveAttribute('data-flight-phase', 'travelling');
    expect(plane().getAttribute('transform')).not.toBe(start);
    expect(Number(document.querySelector('.landing-race-map-airliner').getAttribute('transform').match(/scale\(([\d.]+)\)/)[1])).toBeGreaterThan(0.62);
    advance(GLOBE_FLIGHT_MS / 2);
    expect(plane()).toHaveAttribute('data-flight-phase', 'dwell');
    expect(plane()).toHaveAttribute('data-destination', 'paris');
    expectView(48.8566, 2.3522);
    expect(plane().getAttribute('transform')).toContain(CENTRE);
    settle();
    expect(callbacks.size).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Previous race' }));
    run(GLOBE_FLIGHT_MS + 100);
    expect(current()).toHaveAttribute('data-race-id', 'berlin');
    expect(plane()).toHaveAttribute('data-destination', 'berlin');
    expect(plane()).toHaveAttribute('data-flight-phase', 'dwell');
  });

  it('pauses and resumes the tour on the same frame without counting paused time', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Play the race tour' }));
    advance(0); run(GLOBE_TOUR_DWELL_MS + GLOBE_FLIGHT_MS / 2);
    expect(plane()).toHaveAttribute('data-flight-phase', 'travelling');
    expect(current()).toHaveAttribute('data-race-id', 'paris');
    const paused = plane().getAttribute('transform');
    const pausedView = view();
    fireEvent.click(screen.getByRole('button', { name: 'Pause the race tour' }));
    run(6000);
    settle();
    expect(callbacks.size).toBe(0);
    expect(plane()).toHaveAttribute('transform', paused);
    expect(view()).toEqual(pausedView);
    fireEvent.click(screen.getByRole('button', { name: 'Play the race tour' }));
    advance(0);
    expect(plane()).toHaveAttribute('transform', paused);
    run(GLOBE_FLIGHT_MS / 2 + 100);
    expect(plane()).toHaveAttribute('data-flight-phase', 'dwell');
    expect(plane()).toHaveAttribute('data-destination', 'paris');
    expect(plane().getAttribute('transform')).toContain(CENTRE);
  });

  it('hides far-side labels from pointer and assistive tech while the calendar lists every race', () => {
    mount();
    const map = within(viewport());
    expect(map.getByRole('button', { name: 'Berlin Marathon' })).toBeVisible();
    expect(map.getByRole('button', { name: 'Paris Marathon' })).toBeVisible();
    const sydney = marker('sydney');
    expect(sydney).toHaveAttribute('aria-hidden', 'true');
    expect(sydney).toHaveAttribute('tabindex', '-1');
    expect(sydney.style.visibility).toBe('hidden');
    expect(sydney).toHaveAttribute('data-side', 'back');
    expect(map.queryByRole('button', { name: 'Sydney Marathon' })).not.toBeInTheDocument();
    expect(within(document.querySelector('.landing-race-calendar')).getAllByRole('button')).toHaveLength(races.length);
    fireEvent.click(within(document.querySelector('.landing-race-calendar')).getByRole('button', { name: /Sydney Marathon/ }));
    run(GLOBE_FLIGHT_MS + 100);
    expect(map.getByRole('button', { name: 'Sydney Marathon' })).toBeVisible();
    expect(marker('sydney')).toHaveAttribute('tabindex', '0');
    expect(marker('berlin')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps close clusters legible with separate labels and callouts to the true pins', () => {
    mount(cluster);
    const map = within(viewport());
    // Each accessible name contains the visible label text (NYC → "NYC, New York City Marathon").
    const shown = cluster.map(race => map.getByRole('button', { name: new RegExp(`^${race.mapLabel}\\b.*${race.name}$|^${race.name}$`) }));
    shown.forEach((button, index) => expect(button.getAttribute('aria-label')).toContain(cluster[index].mapLabel));
    expect(shown[4]).toHaveAccessibleName('NYC, New York City Marathon');
    const boxes = shown.map(labelBox);
    boxes.forEach((box, index) => {
      expect(box.x - box.width / 2).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width / 2).toBeLessThanOrEqual(SIZE.width);
      boxes.slice(index + 1).forEach(other => expect(Math.abs(box.x - other.x) >= box.width || Math.abs(box.y - other.y) >= box.height).toBe(true));
      const callout = document.querySelector(`.landing-race-map-callouts g[data-race-id="${cluster[index].id}"]`);
      expect(Number(callout.querySelector('line').getAttribute('x2'))).toBeCloseTo(box.x, 0);
      expect(callout.querySelector('.landing-race-map-pin').getAttribute('cx')).toBe(callout.querySelector('line').getAttribute('x1'));
    });
    expect(shown[4]).toHaveTextContent('NYC');
    fireEvent.click(shown[4]);
    run(GLOBE_FLIGHT_MS + 100);
    expect(current()).toHaveAttribute('data-race-id', 'nyc');
    expect(shown[4]).toHaveAttribute('aria-pressed', 'true');
    expect(plane()).toHaveAttribute('data-destination', 'nyc');
    expect(plane().getAttribute('transform')).toContain(CENTRE);
  });

  it('rotates by drag only once a press clearly moves, and releases cancelled gestures', () => {
    mount();
    const globe = viewport();
    globe.setPointerCapture = vi.fn();
    globe.hasPointerCapture = vi.fn(() => true);
    globe.releasePointerCapture = vi.fn();
    expect(globe.style.touchAction).toBe('pan-y pinch-zoom');
    const down = { pointerId: 7, pointerType: 'touch', button: 0, clientX: 160, clientY: 130 };
    fireEvent.pointerDown(globe, down);
    fireEvent.pointerDown(globe, { ...down, pointerId: 8 });
    // A press alone is only recorded: no capture, no drag state, the spin keeps its button pressed.
    expect(globe.setPointerCapture).not.toHaveBeenCalled();
    expect(globe).not.toHaveAttribute('data-dragging');
    fireEvent.pointerMove(globe, { ...down, clientX: 163 });
    expect(globe.setPointerCapture).not.toHaveBeenCalled();
    expect(view().lng).toBeCloseTo(13.405, 2);
    fireEvent.pointerMove(globe, { ...down, clientX: 160 - RADIUS * Math.PI / 18 });
    expect(globe.setPointerCapture).toHaveBeenCalledTimes(1);
    expect(globe).toHaveAttribute('data-dragging');
    expect(view().lng).toBeCloseTo(13.405 + 10, 1);
    expect(screen.getByRole('button', { name: 'Spin the globe' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.pointerMove(globe, { ...down, clientY: 130 + RADIUS });
    expect(view().lat).toBe(60);
    fireEvent.pointerCancel(globe, down);
    expect(globe.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(globe).not.toHaveAttribute('data-dragging');
    const cancelled = view();
    fireEvent.pointerMove(globe, { ...down, clientX: 20 });
    expect(view()).toEqual(cancelled);
    fireEvent.pointerDown(marker('berlin'), { ...down, pointerId: 9 });
    fireEvent.pointerMove(marker('berlin'), { ...down, pointerId: 9, clientX: 40 });
    expect(globe.setPointerCapture).toHaveBeenCalledTimes(1);
  });

  it('leaves vertical touch swipes to the page: the spin, the tour and the tilt survive a scroll', () => {
    mount();
    const globe = viewport();
    globe.setPointerCapture = vi.fn();
    advance(0); advance(1000);
    const swipe = { pointerId: 3, pointerType: 'touch', button: 0, clientX: 40, clientY: 240 };
    fireEvent.pointerDown(globe, swipe);
    fireEvent.pointerMove(globe, { ...swipe, clientX: 42, clientY: 200 });
    fireEvent.pointerCancel(globe, swipe);
    expect(globe.setPointerCapture).not.toHaveBeenCalled();
    expect(view().lat).toBeCloseTo(52.52, 2);
    const before = view().lng;
    advance(1000);
    expect(view().lng).toBeCloseTo(before - 5.5, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Play the race tour' }));
    advance(0); advance(500);
    fireEvent.pointerDown(globe, swipe);
    fireEvent.pointerMove(globe, { ...swipe, clientY: 150 });
    act(() => { fireEvent.lostPointerCapture(globe, swipe); });
    expect(screen.getByRole('button', { name: 'Pause the race tour' })).toHaveAttribute('aria-pressed', 'true');
    expect(view().lat).toBeCloseTo(52.52, 2);
  });

  it('holds the spin only while a mouse rests on the globe or a label, and while the globe has focus', () => {
    mount();
    const globe = viewport();
    advance(0); advance(1000);
    const mouse = { pointerId: 1, pointerType: 'mouse', clientX: SIZE.width / 2, clientY: SIZE.height / 2 };
    fireEvent.pointerEnter(globe, mouse);
    settle();
    expect(callbacks.size).toBe(0);
    const held = view().lng;
    // The empty band beside the disc does not hold the globe still.
    fireEvent.pointerMove(globe, { ...mouse, clientX: 2, clientY: 2 });
    advance(0); advance(1000);
    expect(view().lng).toBeCloseTo(held - 5.5, 1);
    fireEvent.pointerMove(marker('paris'), { ...mouse, clientX: 2, clientY: 2 });
    settle();
    expect(callbacks.size).toBe(0);
    fireEvent.pointerLeave(globe, mouse);
    const left = view().lng;
    advance(0); advance(1000);
    expect(view().lng).toBeCloseTo(left - 5.5, 1);
    act(() => globe.focus());
    settle();
    expect(callbacks.size).toBe(0);
    const focused = view().lng;
    act(() => globe.blur());
    advance(0); advance(1000);
    expect(view().lng).toBeCloseTo(focused - 5.5, 1);
  });

  it('offers a labelled control that pauses and resumes the ambient spin', () => {
    mount();
    const spin = screen.getByRole('button', { name: 'Spin the globe' });
    expect(spin).toHaveAttribute('aria-pressed', 'true');
    advance(0); advance(1000);
    fireEvent.click(spin);
    expect(spin).toHaveAttribute('aria-pressed', 'false');
    settle();
    expect(callbacks.size).toBe(0);
    const stopped = view().lng;
    fireEvent.click(spin);
    expect(spin).toHaveAttribute('aria-pressed', 'true');
    advance(0); advance(1000);
    expect(view().lng).toBeCloseTo(stopped - 5.5, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Play the race tour' }));
    expect(spin).toHaveAttribute('aria-pressed', 'false');
  });

  it('never lets labels overlap on any frame while the globe spins or tours', () => {
    mount(cluster);
    const check = () => {
      const boxes = [...viewport().querySelectorAll('.landing-race-map-marker')].filter(button => button.style.visibility !== 'hidden').map(labelBox);
      boxes.forEach((box, index) => boxes.slice(index + 1).forEach(other => {
        expect(Math.abs(box.x - other.x) >= box.width || Math.abs(box.y - other.y) >= box.height, `frame at ${clock}ms`).toBe(true);
      }));
    };
    advance(0);
    for (let frame = 0; frame < 900; frame += 1) { advance(16); check(); }
    fireEvent.click(screen.getByRole('button', { name: 'Play the race tour' }));
    advance(0);
    for (let frame = 0; frame < 1400; frame += 1) { advance(16); check(); }
  // ~2,300 simulated frames: allow slower CI runners well past vitest's 5s default.
  }, 20_000);

  it('turns with arrow keys, zooms with the toolbar, and resets with Home', () => {
    mount();
    const globe = viewport();
    fireEvent.keyDown(globe, { key: 'ArrowLeft' });
    expect(view().lng).toBeCloseTo(3.41, 1);
    fireEvent.keyDown(globe, { key: 'ArrowUp' });
    expect(view().lat).toBe(60);
    fireEvent.keyDown(globe, { key: 'ArrowDown' });
    expect(view().lat).toBe(50);
    expect(globe).toHaveAttribute('data-zoom', '1');
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    const zoomOut = screen.getByRole('button', { name: 'Zoom out' });
    expect(zoomOut).toBeDisabled();
    act(() => zoomIn.focus());
    fireEvent.click(zoomIn);
    expect(globe).toHaveAttribute('data-zoom', '1.5');
    expect(screen.getByText('Zoomed in. Drag to turn the globe.')).toBeVisible();
    fireEvent.click(zoomIn); fireEvent.click(zoomIn); fireEvent.click(zoomIn);
    expect(globe).toHaveAttribute('data-zoom', '2.5');
    expect(zoomIn).toBeDisabled();
    // Keyboard focus moves to the opposite control instead of falling to the page.
    expect(zoomOut).toHaveFocus();
    settle();
    const zoomedPlane = plane().getAttribute('transform');
    fireEvent.click(zoomOut);
    expect(globe).toHaveAttribute('data-zoom', '2');
    settle();
    expect(plane().getAttribute('transform')).not.toBe(zoomedPlane);
    fireEvent.keyDown(globe, { key: 'Home' });
    expect(globe).toHaveAttribute('data-zoom', '1');
    settle();
    expectView(52.52, 13.405);
    expect(callbacks.size).toBe(0);
    fireEvent.click(zoomIn);
    fireEvent.click(screen.getByRole('button', { name: 'Reset the globe' }));
    expect(globe).toHaveAttribute('data-zoom', '1');
  });

  it('honors reduced motion: no idle spin, no flight animation and no idle frame loop', () => {
    motion.matches = true;
    const { rerender } = mount();
    expect(callbacks.size).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Next race' }));
    expect(plane()).toHaveAttribute('data-flight-phase', 'dwell');
    expect(plane()).toHaveAttribute('data-destination', 'paris');
    expect(plane().getAttribute('transform')).toContain(CENTRE);
    expect(callbacks.size).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(callbacks.size).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Play the race tour' }));
    advance(0); run(GLOBE_TOUR_DWELL_MS + GLOBE_FLIGHT_MS / 2);
    expect(plane()).toHaveAttribute('data-flight-phase', 'dwell');
    expect(current()).toHaveAttribute('data-race-id', 'tokyo');
    fireEvent.click(screen.getByRole('button', { name: 'Pause the race tour' }));
    settle();
    expect(callbacks.size).toBe(0);
    rerender(<LandingRaceMap races={[races[0]]} />);
    expect(screen.getByRole('button', { name: 'Next race' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Play the race tour' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Spin the globe' })).not.toBeInTheDocument();
    rerender(<LandingRaceMap races={[]} />);
    expect(screen.getByText('Race information is currently unavailable.')).toBeVisible();
  });

  it('paints nothing until the globe is on screen, but keeps far-side labels out of the tab order', () => {
    startOnScreen = false;
    mount();
    expect(callbacks.size).toBe(0);
    expect(plane()).not.toHaveAttribute('transform');
    expect(marker('sydney')).toHaveAttribute('aria-hidden', 'true');
    expect(marker('sydney')).toHaveAttribute('tabindex', '-1');
    expect(marker('berlin').tabIndex).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Next race' }));
    expect(plane()).not.toHaveAttribute('transform');
    intersect(true);
    expect(plane()).toHaveAttribute('data-destination', 'paris');
    expect(plane()).toHaveAttribute('transform');
    expect(callbacks.size).toBe(1);
  });

  it('pauses while hidden or offscreen and cancels the frame loop when unmounted', () => {
    const view$ = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Play the race tour' }));
    advance(0); run(GLOBE_TOUR_DWELL_MS + 200);
    const position = plane().getAttribute('transform');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(callbacks.size).toBe(0);
    advance(5000);
    expect(plane()).toHaveAttribute('transform', position);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    advance(0);
    expect(plane()).toHaveAttribute('transform', position);
    intersect(false);
    expect(callbacks.size).toBe(0);
    intersect(true);
    expect(callbacks.size).toBe(1);
    view$.unmount();
    expect(callbacks.size).toBe(0);
  });

  it('selects from the calendar, closes it, and returns keyboard focus to the globe', () => {
    mount();
    const calendar = document.querySelector('details');
    fireEvent.click(calendar.querySelector('summary'));
    fireEvent.click(within(document.querySelector('.landing-race-calendar')).getByRole('button', { name: /Tokyo Marathon/ }));
    expect(calendar).not.toHaveAttribute('open');
    expect(viewport()).toHaveFocus();
    advance(0); advance(GLOBE_FLIGHT_MS);
    expect(current()).toHaveAttribute('data-race-id', 'tokyo');
    expect(plane()).toHaveAttribute('data-destination', 'tokyo');
    expect(plane()).toHaveAttribute('data-flight-phase', 'dwell');
    expect(plane().getAttribute('transform')).toContain(CENTRE);
  });
});
