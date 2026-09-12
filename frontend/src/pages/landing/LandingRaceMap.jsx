import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { buildRaceFlight, getRaceFlightFrame, sampleRaceFlightLeg, RACE_FLIGHT_STEP_MS } from '../../utils/landingRaceFlight';
import { clampMapCamera, layoutRaceMarkers, focusRaceCamera, mapUnit, zoomMapCamera, MAX_MAP_ZOOM, MAP_ZOOM_STEP } from '../../utils/landingRaceMap';

const FIT_CAMERA = { zoom: 1, x: 0, y: 0 };

function MapIcon({ name }) {
  const paths = {
    previous: <path d="m14 6-6 6 6 6" />,
    next: <path d="m10 6 6 6-6 6" />,
    play: <path d="m9 5 10 7-10 7Z" />,
    pause: <path d="M8 5v14M16 5v14" />,
    plus: <path d="M5 12h14M12 5v14" />,
    minus: <path d="M5 12h14" />,
    fit: <><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /><circle cx="12" cy="12" r="3" /></>,
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function LandingRaceMap({ races = [], mapImage, graticule = [] }) {
  const { t } = useI18n();
  const racePins = useMemo(() => races.filter(race => Number.isFinite(race.pin?.x) && Number.isFinite(race.pin?.y)), [races]);
  const [selectedId, setSelectedId] = useState(racePins[0]?.id);
  const [playing, setPlaying] = useState(false);
  const [travel, setTravel] = useState(null);
  const [camera, setCamera] = useState(FIT_CAMERA);
  const [size, setSize] = useState({ width: 800, height: 400 });
  const [visible, setVisible] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const viewportRef = useRef(null);
  const aircraftRef = useRef(null);
  const activeRouteRef = useRef(null);
  const calendarRef = useRef(null);
  const dragRef = useRef(null);
  const frameRef = useRef(null);
  const selectedRef = useRef(racePins[0]?.id);
  const elapsedRef = useRef(0);
  const selectedIndex = Math.max(0, racePins.findIndex(race => race.id === selectedId));
  const selected = racePins[selectedIndex];
  const flight = useMemo(() => buildRaceFlight(racePins.map(race => race.pin)), [racePins]);
  const markers = useMemo(() => layoutRaceMarkers(racePins, size, camera), [racePins, size, camera]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const measure = () => {
      const bounds = viewport.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) setSize({ width: bounds.width, height: bounds.height });
    };
    measure();
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    resizeObserver?.observe(viewport);
    window.addEventListener('resize', measure);
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      const onScreen = entries.some(entry => entry.isIntersecting);
      setVisible(onScreen);
      if (onScreen) setMapReady(true);
    }) : null;
    if (observer) observer.observe(viewport);
    else { setVisible(true); setMapReady(true); }
    return () => { observer?.disconnect(); resizeObserver?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  useEffect(() => setCamera(current => clampMapCamera(current, size)), [size]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => setDocumentVisible(!document.hidden);
    media.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => { media.removeEventListener('change', updateMotion); document.removeEventListener('visibilitychange', updateVisibility); };
  }, []);

  const paint = useCallback((frame, destination, phase = 'dwell') => {
    frameRef.current = { ...frame, destination };
    const pointer = aircraftRef.current;
    if (pointer) {
      pointer.setAttribute('transform', `translate(${frame.x.toFixed(6)} ${frame.y.toFixed(6)}) rotate(${frame.angle.toFixed(3)})`);
      pointer.dataset.destination = destination;
      pointer.dataset.flightPhase = phase;
    }
  }, []);

  useEffect(() => {
    if (!racePins.length) return undefined;
    const parkedIndex = Math.max(0, racePins.findIndex(race => race.id === selectedRef.current));
    const parkedRace = racePins[parkedIndex];
    if (selectedRef.current !== parkedRace.id) {
      selectedRef.current = parkedRace.id;
      setSelectedId(parkedRace.id);
    }
    const park = () => paint({ ...parkedRace.pin, angle: frameRef.current?.angle ?? 0 }, parkedRace.id);
    if (!visible || !documentVisible || (!playing && !travel)) {
      if (!frameRef.current || frameRef.current.destination !== parkedRace.id) park();
      if (travel && (!visible || !documentVisible)) setTravel(null);
      return undefined;
    }
    let frameId;
    let previousTime = null;
    let manualElapsed = 0;
    const target = travel && racePins.find(race => race.id === travel.id);
    if (travel && !target) { park(); setTravel(null); return undefined; }
    const manualLeg = target ? buildRaceFlight([travel.from, target.pin]).legs[0] : null;
    const tick = timestamp => {
      const delta = previousTime === null ? 0 : timestamp - previousTime;
      previousTime = timestamp;
      if (playing) {
        elapsedRef.current += delta;
        const frame = getRaceFlightFrame(flight.legs, elapsedRef.current);
        const destination = racePins[frame.activeIndex];
        paint(reducedMotion ? { ...destination.pin, angle: frame.angle } : frame, destination.id, !reducedMotion && frame.travelling ? 'travelling' : 'dwell');
        if (activeRouteRef.current) {
          activeRouteRef.current.setAttribute('d', flight.legs[frame.legIndex].path);
          activeRouteRef.current.setAttribute('stroke-dashoffset', String(1 - frame.progress));
        }
        if (selectedRef.current !== destination.id) {
          selectedRef.current = destination.id;
          setSelectedId(destination.id);
        }
      } else if (manualLeg) {
        manualElapsed += delta;
        const progress = reducedMotion ? 1 : Math.min(1, manualElapsed / 750);
        paint(sampleRaceFlightLeg(manualLeg, progress), target.id, progress < 1 ? 'travelling' : 'dwell');
        if (activeRouteRef.current) {
          activeRouteRef.current.setAttribute('d', manualLeg.path);
          activeRouteRef.current.setAttribute('stroke-dashoffset', String(1 - progress));
        }
        if (progress === 1) { setTravel(null); return; }
      }
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [racePins, flight, playing, travel, visible, documentVisible, reducedMotion, paint]);

  const chooseRace = (id, returnToMap = false) => {
    const race = racePins.find(item => item.id === id);
    if (!race) return;
    setPlaying(false);
    selectedRef.current = id;
    setSelectedId(id);
    elapsedRef.current = racePins.findIndex(item => item.id === id) * RACE_FLIGHT_STEP_MS;
    const from = frameRef.current ?? race.pin;
    if (Math.hypot(from.x - race.pin.x, from.y - race.pin.y) < 0.001) {
      setTravel(null);
      paint({ ...race.pin, angle: from.angle ?? 0 }, id);
    } else setTravel({ id, from });
    setCamera(current => focusRaceCamera(race.pin, size, current.zoom));
    if (returnToMap) {
      if (calendarRef.current) calendarRef.current.open = false;
      viewportRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      viewportRef.current?.focus({ preventScroll: true });
    }
  };

  const zoomBy = amount => {
    setPlaying(false);
    setCamera(current => {
      const zoom = Math.max(1, Math.min(MAX_MAP_ZOOM, current.zoom + amount));
      return current.zoom === 1 ? focusRaceCamera(selected.pin, size, zoom) : zoomMapCamera(current, size, zoom);
    });
  };
  const resetView = () => { setPlaying(false); setCamera(FIT_CAMERA); };
  const toggleTour = () => {
    setTravel(null);
    if (!playing) {
      if (travel) paint({ ...selected.pin, angle: frameRef.current?.angle ?? 0 }, selected.id);
      setCamera(FIT_CAMERA);
    }
    setPlaying(value => !value);
  };
  const startDrag = event => {
    if (dragRef.current || event.isPrimary === false || event.target.closest('button') || event.button !== 0 || camera.zoom <= 1) return;
    setPlaying(false);
    dragRef.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, camera };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const drag = event => {
    const start = dragRef.current;
    if (!start || start.pointer !== event.pointerId) return;
    setCamera(clampMapCamera({ ...start.camera, x: start.camera.x + event.clientX - start.x, y: start.camera.y + event.clientY - start.y }, size));
  };
  const endDrag = event => {
    if (dragRef.current?.pointer !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const mapKeys = event => {
    if (event.target !== event.currentTarget) return;
    const step = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[event.key];
    if (step && camera.zoom > 1) {
      event.preventDefault(); setPlaying(false);
      setCamera(current => clampMapCamera({ ...current, x: current.x + step[0], y: current.y + step[1] }, size));
    } else if (event.key === 'Home') { event.preventDefault(); resetView(); }
  };

  if (!selected) return <p className="landing-map-empty">{t('landing.map_empty')}</p>;

  return (
    <>
      <div className="landing-race-explorer" role="region" aria-label={t('landing.map_label')}>
        <div className="landing-race-map-toolbar">
          <span>{t(camera.zoom > 1 ? 'landing.map_drag_hint' : 'landing.map_hint')}</span>
          <div className="landing-race-map-tools">
            <button type="button" onClick={() => zoomBy(MAP_ZOOM_STEP)} disabled={camera.zoom >= MAX_MAP_ZOOM} aria-label={t('landing.map_zoom_in')} title={t('landing.map_zoom_in')}><MapIcon name="plus" /></button>
            <button type="button" onClick={() => zoomBy(-MAP_ZOOM_STEP)} disabled={camera.zoom <= 1} aria-label={t('landing.map_zoom_out')} title={t('landing.map_zoom_out')}><MapIcon name="minus" /></button>
            <button type="button" onClick={resetView} aria-label={t('landing.map_reset')} title={t('landing.map_reset')}><MapIcon name="fit" /></button>
          </div>
        </div>
        <div ref={viewportRef} className="landing-race-map-viewport" data-zoom={camera.zoom} style={{ touchAction: camera.zoom > 1 ? 'none' : 'pan-y pinch-zoom' }}
          tabIndex={0} role="group" aria-label={t('landing.map_navigation')} aria-describedby="landing-race-current"
          onPointerDown={startDrag} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={event => { if (dragRef.current?.pointer === event.pointerId) dragRef.current = null; }} onKeyDown={mapKeys}>
          <svg className="landing-race-map-canvas" viewBox="0 0 100 50" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
            <g className="landing-cinematic-map-graticule">{graticule.map(path => <path key={path} d={path} />)}</g>
            <image href={mapReady ? mapImage : undefined} width="100" height="50" preserveAspectRatio="none" />
            <path d={flight.path} className="landing-race-map-route" />
            <path ref={activeRouteRef} pathLength="1" className="landing-race-map-route-active" />
          </svg>
          <svg className="landing-race-map-canvas landing-race-map-aircraft-layer" viewBox="0 0 100 50" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
            <g ref={aircraftRef} className="landing-cinematic-map-aircraft" transform={`translate(${racePins[0].pin.x} ${racePins[0].pin.y})`} aria-hidden="true">
              {/* Keep the 40px airliner readable at every zoom; its nose stays at the flight coordinate. */}
              <g className="landing-race-map-airliner" transform={`scale(${40 / (49 * (mapUnit(size) || 1) * camera.zoom)})`}>
                <g transform="translate(-24 0)">
                  <path d="M 24 0 C 24 -1.8 21 -3.4 18 -3.4 H 7 L -8 -20 Q -9 -21 -10.5 -21 H -13 L -6 -3.4 L -18 -2.3 L -22 -9 H -25 L -22 -1.2 Q -24 0 -22 1.2 L -25 9 H -22 L -18 2.3 L -6 3.4 L -13 21 H -10.5 Q -9 21 -8 20 L 7 3.4 H 18 C 21 3.4 24 1.8 24 0 Z" className="landing-cinematic-map-aircraft-shape" />
                  <path d="M -4 -8.5 H 1 A 1.6 1.6 0 0 1 1 -11.7 H -4 A 1.6 1.6 0 0 0 -4 -8.5 Z M -4 8.5 H 1 A 1.6 1.6 0 0 0 1 11.7 H -4 A 1.6 1.6 0 0 1 -4 8.5 Z" className="landing-race-map-airliner-engines" />
                  <path d="M 24 0 C 24 -1.8 21 -3.4 18 -3.4 L -17 -2.3 L -22 -1.2 Q -24 0 -22 1.2 L -17 2.3 L 18 3.4 C 21 3.4 24 1.8 24 0 Z" className="landing-race-map-airliner-fuselage" />
                  <path d="M 20 -1.8 Q 22 0 20 1.8 L 17.2 1.3 Q 18 0 17.2 -1.3 Z" className="landing-cinematic-map-aircraft-cockpit" />
                </g>
              </g>
            </g>
          </svg>
          <svg className="landing-race-map-callouts" width={size.width} height={size.height} aria-hidden="true">
            {markers.map(marker => <g key={marker.key} className={marker.race.id === selected.id ? 'is-active' : undefined}>
              <line x1={marker.anchorX} y1={marker.anchorY} x2={marker.x} y2={marker.y} />
              <circle cx={marker.anchorX} cy={marker.anchorY} r="3.5" />
            </g>)}
          </svg>
          {markers.map(marker => <button key={marker.key} type="button" className={`landing-race-map-marker${marker.race.id === selected.id ? ' is-active' : ''}`} data-races={marker.key}
            style={{ width: marker.width, transform: `translate(${marker.x}px, ${marker.y}px) translate(-50%, -50%)` }} aria-label={marker.race.name} title={marker.race.name}
            aria-pressed={marker.race.id === selected.id} onFocus={() => setPlaying(false)} onClick={() => chooseRace(marker.race.id)}>
            <span>{marker.race.mapLabel ?? marker.race.name}</span>
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
