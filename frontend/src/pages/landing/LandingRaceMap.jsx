import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { GLOBE_KEY_STEP_DEG, GLOBE_MAX_ZOOM, GLOBE_MIN_ZOOM, GLOBE_ZOOM_STEP, labelSize } from '../../utils/landingGlobe';
import { createRaceGlobeScene } from './landingRaceGlobeScene';

const hasGeo = race => Number.isFinite(race.geo?.lat) && Number.isFinite(race.geo?.lng);
const KEY_ROTATION = {
  ArrowLeft: [0, -GLOBE_KEY_STEP_DEG],
  ArrowRight: [0, GLOBE_KEY_STEP_DEG],
  ArrowUp: [GLOBE_KEY_STEP_DEG, 0],
  ArrowDown: [-GLOBE_KEY_STEP_DEG, 0],
};

function MapIcon({ name }) {
  const paths = {
    previous: <path d="m14 6-6 6 6 6" />,
    next: <path d="m10 6 6 6-6 6" />,
    play: <path d="m9 5 10 7-10 7Z" />,
    pause: <path d="M8 5v14M16 5v14" />,
    plus: <path d="M5 12h14M12 5v14" />,
    minus: <path d="M5 12h14" />,
    spin: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></>,
    fit: <><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /><circle cx="12" cy="12" r="3" /></>,
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

// Visible text must be part of the accessible name (WCAG 2.5.3), e.g. "NYC".
const markerName = race => (race.mapLabel && !race.name.includes(race.mapLabel) ? `${race.mapLabel}, ${race.name}` : race.name);

// A dotted orthographic globe on a canvas with DOM label buttons, SVG callouts
// and the SVG airliner layered above it. landingRaceGlobeScene paints every
// frame; React only renders structure and UI state.
export default function LandingRaceMap({ races = [] }) {
  const { t } = useI18n();
  const racePins = useMemo(() => races.filter(hasGeo), [races]);
  const [selectedId, setSelectedId] = useState(racePins[0]?.id);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(GLOBE_MIN_ZOOM);
  // null until the viewport is measured, so nothing paints at a placeholder size.
  const [size, setSize] = useState(null);
  const [onScreen, setOnScreen] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [spinning, setSpinning] = useState(true);
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const aircraftRef = useRef(null);
  const airlinerRef = useRef(null);
  const markersRef = useRef(new Map());
  const calloutsRef = useRef(new Map());
  const calendarRef = useRef(null);
  const zoomInRef = useRef(null);
  const zoomOutRef = useRef(null);
  const sceneRef = useRef(null);
  const selectedIndex = Math.max(0, racePins.findIndex(race => race.id === selectedId));
  const selected = racePins[selectedIndex];
  const hasRaces = racePins.length > 0;
  const label = labelSize(size?.width ?? 800);

  useLayoutEffect(() => {
    if (!hasRaces || !viewportRef.current) return undefined;
    const scene = createRaceGlobeScene({
      viewport: viewportRef.current,
      canvas: canvasRef.current,
      aircraft: aircraftRef.current,
      airliner: airlinerRef.current,
      markers: markersRef.current,
      callouts: calloutsRef.current,
      onActiveRace: setSelectedId,
      onSpinChange: setSpinning,
      onDragStart: () => setPlaying(false),
    });
    sceneRef.current = scene;
    return () => { scene.destroy(); sceneRef.current = null; };
  }, [hasRaces]);

  useLayoutEffect(() => {
    sceneRef.current?.update({ races: racePins, selectedId: selected?.id, playing, zoom, size, reducedMotion, active: onScreen && documentVisible });
  }, [racePins, selected, playing, zoom, size, reducedMotion, onScreen, documentVisible]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const measure = () => {
      const bounds = viewport.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        setSize(current => (current?.width === bounds.width && current?.height === bounds.height ? current : { width: bounds.width, height: bounds.height }));
      }
    };
    measure();
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    resizeObserver?.observe(viewport);
    window.addEventListener('resize', measure);
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(entries => setOnScreen(entries.some(entry => entry.isIntersecting)))
      : null;
    if (observer) observer.observe(viewport);
    else setOnScreen(true);
    return () => { observer?.disconnect(); resizeObserver?.disconnect(); window.removeEventListener('resize', measure); };
  }, [hasRaces]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => setDocumentVisible(!document.hidden);
    media.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => { media.removeEventListener('change', updateMotion); document.removeEventListener('visibilitychange', updateVisibility); };
  }, []);

  const chooseRace = (id, returnToMap = false) => {
    if (!racePins.some(race => race.id === id)) return;
    setPlaying(false);
    setSelectedId(id);
    sceneRef.current?.flyTo(id);
    if (returnToMap) {
      if (calendarRef.current) calendarRef.current.open = false;
      viewportRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      viewportRef.current?.focus({ preventScroll: true });
    }
  };
  const zoomBy = (amount, event) => {
    setPlaying(false);
    sceneRef.current?.interact();
    const next = Math.max(GLOBE_MIN_ZOOM, Math.min(GLOBE_MAX_ZOOM, zoom + amount));
    // The pressed button is about to be disabled at its limit: keep keyboard focus on the toolbar.
    if (event?.currentTarget === document.activeElement && (next >= GLOBE_MAX_ZOOM || next <= GLOBE_MIN_ZOOM)) {
      (next >= GLOBE_MAX_ZOOM ? zoomOutRef : zoomInRef).current?.focus();
    }
    setZoom(next);
  };
  const resetView = () => {
    setPlaying(false);
    setZoom(GLOBE_MIN_ZOOM);
    sceneRef.current?.recenter();
  };
  const toggleTour = () => setPlaying(value => !value);
  const toggleSpin = () => {
    setPlaying(false);
    sceneRef.current?.setSpin(!spinning);
  };
  const startDrag = event => {
    if (event.target.closest('button')) return;
    sceneRef.current?.beginDrag(event);
  };
  const pointerMove = event => {
    sceneRef.current?.moveDrag(event);
    sceneRef.current?.hover(event);
  };
  const globeKeys = event => {
    if (event.target !== event.currentTarget) return;
    const rotation = KEY_ROTATION[event.key];
    if (rotation) {
      event.preventDefault();
      setPlaying(false);
      sceneRef.current?.rotateBy(...rotation);
    } else if (event.key === 'Home') {
      event.preventDefault();
      resetView();
    }
  };

  if (!selected) return <p className="landing-map-empty">{t('landing.map_empty')}</p>;

  return (
    <>
      <div className="landing-race-explorer" role="region" aria-label={t('landing.map_label')}>
        <div className="landing-race-map-toolbar">
          <span>{t(zoom > GLOBE_MIN_ZOOM ? 'landing.map_drag_hint' : 'landing.map_hint')}</span>
          <div className="landing-race-map-tools">
            {!reducedMotion && <button type="button" onClick={toggleSpin} aria-pressed={spinning} aria-label={t('landing.map_spin')} title={t('landing.map_spin')}><MapIcon name="spin" /></button>}
            <button ref={zoomInRef} type="button" onClick={event => zoomBy(GLOBE_ZOOM_STEP, event)} disabled={zoom >= GLOBE_MAX_ZOOM} aria-label={t('landing.map_zoom_in')} title={t('landing.map_zoom_in')}><MapIcon name="plus" /></button>
            <button ref={zoomOutRef} type="button" onClick={event => zoomBy(-GLOBE_ZOOM_STEP, event)} disabled={zoom <= GLOBE_MIN_ZOOM} aria-label={t('landing.map_zoom_out')} title={t('landing.map_zoom_out')}><MapIcon name="minus" /></button>
            <button type="button" onClick={resetView} aria-label={t('landing.map_reset')} title={t('landing.map_reset')}><MapIcon name="fit" /></button>
          </div>
        </div>
        <div ref={viewportRef} className="landing-race-map-viewport landing-race-globe" data-zoom={zoom} style={{ touchAction: 'pan-y pinch-zoom' }}
          tabIndex={0} role="group" aria-label={t('landing.map_navigation')} aria-describedby="landing-race-current"
          onPointerDown={startDrag} onPointerMove={pointerMove} onPointerUp={event => sceneRef.current?.endDrag(event)}
          onPointerCancel={event => sceneRef.current?.endDrag(event)} onLostPointerCapture={event => sceneRef.current?.endDrag(event, true)}
          onPointerEnter={event => sceneRef.current?.hover(event)} onPointerLeave={event => sceneRef.current?.leave(event)}
          onFocus={() => sceneRef.current?.hold('focus', true)}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) sceneRef.current?.hold('focus', false); }}
          onKeyDown={globeKeys}>
          <canvas ref={canvasRef} className="landing-race-globe-canvas" aria-hidden="true" />
          <svg className="landing-race-map-callouts" width={size?.width} height={size?.height} aria-hidden="true">
            {racePins.map(race => <g key={race.id} data-race-id={race.id} className={race.id === selected.id ? 'is-active' : undefined}
              ref={node => { if (node) calloutsRef.current.set(race.id, node); else calloutsRef.current.delete(race.id); }}>
              <line />
              <circle className="landing-race-map-pin-halo" r="11" />
              <circle className="landing-race-map-pin" r={race.id === selected.id ? 5 : 4} />
            </g>)}
          </svg>
          <svg className="landing-race-map-aircraft-layer" width={size?.width} height={size?.height} aria-hidden="true">
            <g ref={aircraftRef} className="landing-cinematic-map-aircraft" aria-hidden="true">
              {/* The nose sits on the flight coordinate; the scene orients it along the arc's screen heading. */}
              <g ref={airlinerRef} className="landing-race-map-airliner" transform="scale(0.62)">
                <g transform="translate(-24 0)">
                  <path d="M 24 0 C 24 -1.8 21 -3.4 18 -3.4 H 7 L -8 -20 Q -9 -21 -10.5 -21 H -13 L -6 -3.4 L -18 -2.3 L -22 -9 H -25 L -22 -1.2 Q -24 0 -22 1.2 L -25 9 H -22 L -18 2.3 L -6 3.4 L -13 21 H -10.5 Q -9 21 -8 20 L 7 3.4 H 18 C 21 3.4 24 1.8 24 0 Z" className="landing-cinematic-map-aircraft-shape" />
                  <path d="M -4 -8.5 H 1 A 1.6 1.6 0 0 1 1 -11.7 H -4 A 1.6 1.6 0 0 0 -4 -8.5 Z M -4 8.5 H 1 A 1.6 1.6 0 0 0 1 11.7 H -4 A 1.6 1.6 0 0 1 -4 8.5 Z" className="landing-race-map-airliner-engines" />
                  <path d="M 24 0 C 24 -1.8 21 -3.4 18 -3.4 L -17 -2.3 L -22 -1.2 Q -24 0 -22 1.2 L -17 2.3 L 18 3.4 C 21 3.4 24 1.8 24 0 Z" className="landing-race-map-airliner-fuselage" />
                  <path d="M 20 -1.8 Q 22 0 20 1.8 L 17.2 1.3 Q 18 0 17.2 -1.3 Z" className="landing-cinematic-map-aircraft-cockpit" />
                </g>
              </g>
            </g>
          </svg>
          {racePins.map(race => <button key={race.id} type="button" className={`landing-race-map-marker${race.id === selected.id ? ' is-active' : ''}`} data-race-id={race.id}
            ref={node => { if (node) markersRef.current.set(race.id, node); else markersRef.current.delete(race.id); }}
            style={{ width: label.width }} aria-label={markerName(race)} title={race.name}
            aria-pressed={race.id === selected.id} onFocus={() => setPlaying(false)} onClick={() => chooseRace(race.id)}>
            <span>{race.mapLabel ?? race.name}</span>
          </button>)}
        </div>
        <div className="landing-race-map-detail" aria-live={playing ? 'off' : 'polite'} aria-atomic="true" data-race-id={selected.id}>
          <div className="landing-race-map-detail-heading">
            <h3 id="landing-race-current">{selected.name}</h3>
            <div className="landing-race-map-navigation">
              <button type="button" onClick={() => chooseRace(racePins[(selectedIndex + racePins.length - 1) % racePins.length].id)} disabled={racePins.length < 2} aria-label={t('landing.map_previous')} title={t('landing.map_previous')}><MapIcon name="previous" /></button>
              <button type="button" onClick={toggleTour} disabled={racePins.length < 2} aria-label={t(playing ? 'landing.map_pause' : 'landing.map_play')} title={t(playing ? 'landing.map_pause' : 'landing.map_play')} aria-pressed={playing}><MapIcon name={playing ? 'pause' : 'play'} /></button>
              <button type="button" onClick={() => chooseRace(racePins[(selectedIndex + 1) % racePins.length].id)} disabled={racePins.length < 2} aria-label={t('landing.map_next')} title={t('landing.map_next')}><MapIcon name="next" /></button>
            </div>
          </div>
          <dl><div><dt>{t('landing.map_month')}</dt><dd>{selected.date}</dd></div><div><dt>{t('landing.cinematic_race_col_distance')}</dt><dd>{selected.distance}</dd></div></dl>
        </div>
      </div>
      <details ref={calendarRef} className="landing-minimal-disclosure landing-minimal-calendar" onToggle={event => { if (event.currentTarget.open) setPlaying(false); }}>
        <summary><span>{t('landing.minimal_browse_races')}</span><MapIcon name="next" /></summary>
        <div className="landing-race-calendar">
          {racePins.map(race => <button type="button" key={race.id} className={race.id === selected.id ? 'is-active' : ''} data-race-id={race.id} onClick={() => chooseRace(race.id, true)} aria-pressed={race.id === selected.id}>
            <span>{race.name}</span><small>{race.date} · {race.distance}</small><MapIcon name="next" />
          </button>)}
        </div>
      </details>
    </>
  );
}
