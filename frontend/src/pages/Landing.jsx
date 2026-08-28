import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { getBackendBaseUrl } from '../api';
import { useScrollReveal } from '../hooks/useScrollReveal';
import {
  buildLandingRaceShowcase,
  formatRaceDistanceLabel,
  formatRaceMonthLabel,
} from '../utils/landingRaceShowcase.js';
import AppIcon from '../components/AppIcon';
import HermesMarkSvg from '../components/HermesMarkSvg';
import stravaConnectButton from '../assets/btn_strava_connect_with_orange.svg';
import worldMapPoliticalDotted from '../assets/generated/landing-world-map-political-dotted.webp';
import shoeRunMaster from '../assets/generated/run-gait-v2/evo-sl-side-master.webp';
import '../styles/_split/landing.css';
import { SUPPORT_MAILTO } from '../utils/supportContact';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const SHOE_GAIT_MOTION_STOPS = [
  { progress: 0, phase: 'ready', x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1, originX: 50, originY: 70 },
  { progress: 0.08, phase: 'loading', x: -1, y: 1.8, rotate: 0, scaleX: 1.015, scaleY: 0.965, originX: 50, originY: 70 },
  { progress: 0.18, phase: 'midstance', x: -2.5, y: 1.2, rotate: 0.8, scaleX: 1.02, scaleY: 0.96, originX: 68, originY: 70 },
  { progress: 0.31, phase: 'heel-rise', x: -1.5, y: -1, rotate: 6, scaleX: 1, scaleY: 0.99, originX: 84, originY: 70 },
  { progress: 0.38, phase: 'toe-off', x: 1, y: -5, rotate: 13, scaleX: 0.985, scaleY: 0.985, originX: 88, originY: 70 },
  { progress: 0.5, phase: 'early-flight', x: 3, y: -11, rotate: 6, scaleX: 0.98, scaleY: 0.98, originX: 55, originY: 68 },
  { progress: 0.68, phase: 'flight', x: 1, y: -15, rotate: -1, scaleX: 0.985, scaleY: 0.985, originX: 50, originY: 68 },
  { progress: 0.82, phase: 'terminal-swing', x: -1, y: -11, rotate: -7, scaleX: 0.99, scaleY: 0.99, originX: 24, originY: 70 },
  { progress: 0.94, phase: 'initial-contact', x: -2, y: -4, rotate: -9, scaleX: 1, scaleY: 1, originX: 16, originY: 70 },
  { progress: 1, phase: 'landed', x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1, originX: 50, originY: 70 },
];
const HERO_FOCUS_SCROLL_FRACTION = 0.14;

function parseRaceDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function getRaceCountdownDays(isoDate, now = new Date()) {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.ceil((parseRaceDate(isoDate) - today) / DAY_IN_MS));
}

function getMillisecondsUntilTomorrow(now = new Date()) {
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 1, 0);
  return Math.max(1000, tomorrow.getTime() - now.getTime());
}

function RevealSection({ children, className = '', delay = 0, initialVisible = false, onClick }) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.16, rootMargin: '0px', initialVisible });
  return (
    <div
      ref={ref}
      className={`${className} ${isVisible ? 'reveal-visible' : 'reveal-hidden'}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

function PageWidth({ children, className = '' }) {
  return <div className={`landing-cinematic-width ${className}`}>{children}</div>;
}

function getShoeGaitMotion(progress) {
  const nextStopIndex = SHOE_GAIT_MOTION_STOPS.findIndex((stop) => stop.progress >= progress);
  const endIndex = nextStopIndex === -1 ? SHOE_GAIT_MOTION_STOPS.length - 1 : nextStopIndex;
  const startIndex = Math.max(0, endIndex - 1);
  const start = SHOE_GAIT_MOTION_STOPS[startIndex];
  const end = SHOE_GAIT_MOTION_STOPS[endIndex];
  const stopDistance = end.progress - start.progress;
  const localProgress = stopDistance === 0 ? 0 : (progress - start.progress) / stopDistance;
  const easedProgress = localProgress * localProgress * (3 - (2 * localProgress));
  const interpolate = (from, to) => from + ((to - from) * easedProgress);

  return {
    phase: localProgress < 0.5 ? start.phase : end.phase,
    transform: `translate3d(${interpolate(start.x, end.x)}%, ${interpolate(start.y, end.y)}%, 0) rotate(${interpolate(start.rotate, end.rotate)}deg) scale(${interpolate(start.scaleX, end.scaleX)}, ${interpolate(start.scaleY, end.scaleY)})`,
    transformOrigin: `${interpolate(start.originX, end.originX)}% ${interpolate(start.originY, end.originY)}%`,
  };
}

function ShoeRunCycle({ scrollContainerRef }) {
  const { t } = useI18n();
  const [isReady, setIsReady] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => (
    typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));
  const canvasRef = useRef(null);
  const figureRef = useRef(null);
  const runnerRef = useRef(null);
  const decodedShoeRef = useRef(null);

  const drawShoe = useCallback(() => {
    const canvas = canvasRef.current;
    const image = decodedShoeRef.current;
    if (!canvas || !image || canvas.clientWidth <= 0 || canvas.clientHeight <= 0) return;

    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const canvasWidth = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
    const canvasHeight = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));
    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }

    const context = canvas.getContext('2d');
    if (!context) return;

    const scale = Math.min(canvasWidth / image.naturalWidth, canvasHeight / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const drawX = (canvasWidth - drawWidth) / 2;
    const drawY = (canvasHeight - drawHeight) / 2;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    canvas.dataset.hasFrame = 'true';
  }, []);

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setPrefersReducedMotion(motionPreference.matches);

    updateMotionPreference();
    motionPreference.addEventListener('change', updateMotionPreference);
    return () => motionPreference.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const image = new window.Image();
    image.onload = async () => {
      try {
        await image.decode();
      } catch {
        // The loaded bitmap is still safe to display when decode() is unavailable.
      }
      if (cancelled) return;

      decodedShoeRef.current = image;
      drawShoe();
      setIsReady(true);
    };
    image.src = shoeRunMaster;

    return () => {
      cancelled = true;
    };
  }, [drawShoe]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const redrawShoe = () => drawShoe();
    if (typeof window.ResizeObserver !== 'function') {
      window.addEventListener('resize', redrawShoe);
      redrawShoe();
      return () => window.removeEventListener('resize', redrawShoe);
    }

    const resizeObserver = new window.ResizeObserver(redrawShoe);
    resizeObserver.observe(canvas);
    redrawShoe();
    return () => resizeObserver.disconnect();
  }, [drawShoe]);

  useEffect(() => {
    if (!isReady) return undefined;

    const scrollContainer = scrollContainerRef.current;
    const figure = figureRef.current;
    const runner = runnerRef.current;
    const grid = figure?.closest('.landing-hero-shoe-grid');
    const copy = grid?.querySelector('.landing-command-copy');
    if (!scrollContainer || !figure || !runner || !grid || !copy) return undefined;

    let animationFrameId;
    const updateFromScroll = () => {
      animationFrameId = undefined;
      const usesCompactLayout = window.matchMedia('(max-width: 980px)').matches;

      if (prefersReducedMotion) {
        drawShoe();
        copy.inert = false;
        runner.style.transform = 'none';
        runner.style.transformOrigin = '50% 70%';
        figure.style.transform = 'none';
        scrollContainer.style.setProperty('--hero-copy-opacity', '1');
        scrollContainer.style.setProperty('--hero-copy-shift-x', '0px');
        scrollContainer.style.setProperty('--hero-copy-blur', '0px');
        scrollContainer.dataset.heroFocusState = 'intro';
        figure.dataset.scrollState = 'reduced';
        figure.dataset.scrollProgress = '0.000';
        figure.dataset.gaitPhase = 'ready';
        return;
      }

      const containerBounds = scrollContainer.getBoundingClientRect();
      const scrollDistance = Math.max(1, scrollContainer.offsetHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -containerBounds.top / scrollDistance));
      const gaitProgress = usesCompactLayout ? 0 : progress;
      const gaitMotion = getShoeGaitMotion(gaitProgress);
      const focusProgress = usesCompactLayout
        ? 0
        : Math.min(1, progress / HERO_FOCUS_SCROLL_FRACTION);
      const copyOpacity = 1 - focusProgress;
      const centeredFigureOffset = (grid.clientWidth - figure.offsetWidth) / 2;
      const centerShiftX = centeredFigureOffset - figure.offsetLeft;

      copy.inert = focusProgress >= 0.85;
      scrollContainer.style.setProperty('--hero-copy-opacity', copyOpacity.toFixed(3));
      scrollContainer.style.setProperty('--hero-copy-shift-x', `${(-48 * focusProgress).toFixed(1)}px`);
      scrollContainer.style.setProperty('--hero-copy-blur', `${(2 * focusProgress).toFixed(1)}px`);
      scrollContainer.dataset.heroFocusState = focusProgress <= 0
        ? 'intro'
        : focusProgress >= 1 ? 'focused' : 'transitioning';
      figure.style.transform = usesCompactLayout
        ? 'none'
        : `translate3d(${(centerShiftX * focusProgress).toFixed(1)}px, 0, 0) scale(${(1 + (0.08 * focusProgress)).toFixed(3)})`;
      runner.style.transformOrigin = gaitMotion.transformOrigin;
      runner.style.transform = gaitMotion.transform;
      figure.dataset.scrollState = progress <= 0 ? 'idle' : progress >= 1 ? 'complete' : 'scrubbing';
      figure.dataset.scrollProgress = progress.toFixed(3);
      figure.dataset.gaitPhase = gaitMotion.phase;
    };

    const scheduleScrollUpdate = () => {
      if (animationFrameId === undefined) {
        animationFrameId = window.requestAnimationFrame(updateFromScroll);
      }
    };

    updateFromScroll();
    window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
    window.addEventListener('resize', scheduleScrollUpdate);
    return () => {
      window.removeEventListener('scroll', scheduleScrollUpdate);
      window.removeEventListener('resize', scheduleScrollUpdate);
      if (animationFrameId !== undefined) window.cancelAnimationFrame(animationFrameId);
      copy.inert = false;
    };
  }, [drawShoe, isReady, prefersReducedMotion, scrollContainerRef]);

  return (
    <figure
      ref={figureRef}
      className={`landing-hero-shoe-cycle${isReady ? ' is-ready' : ''}`}
      data-scroll-state="loading"
      data-scroll-progress="0.000"
      data-gait-phase="ready"
      aria-hidden="true"
    >
      <div ref={runnerRef} className="landing-hero-shoe-cycle-runner">
        <canvas
          ref={canvasRef}
          className="landing-hero-shoe-cycle-frame"
          data-has-frame="false"
        />
      </div>
      <span className="landing-hero-shoe-cycle-prompt" data-prompt-ready={isReady ? 'true' : 'false'}>
        {t('landing.cinematic_hero_shoe_prompt')}
      </span>
    </figure>
  );
}

function LandingGlyph({ name, className = '' }) {
  const classNames = ['landing-cinematic-glyph', className].filter(Boolean).join(' ');

  if (name === 'logo') {
    return <HermesMarkSvg tone="light" className={`${classNames} landing-cinematic-glyph--logo`} />;
  }

  if (name === 'shoe') {
    return <AppIcon name="shoe" className={classNames} />;
  }

  return (
    <svg className={classNames} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {name === 'runner' && (
        <>
          <circle cx="13.5" cy="4.7" r="2.1" />
          <path d="M10.7 8.5l3.5 2.2 2.8-1.2" />
          <path d="M12.9 10.7l-2 4.6 3.9 4.5" />
          <path d="M10.9 15.1l-4.2 1.5" />
          <path d="M14.5 12.2l2.1 3.1 3.2.7" />
        </>
      )}
      {name === 'arrow' && (
        <>
          <path d="M5 12h13" />
          <path d="M13 6l6 6-6 6" />
        </>
      )}
      {name === 'check' && <path d="M5 12.5l4.2 4.2L19 7" />}
      {name === 'minus' && <path d="M6 12h12" />}
      {name === 'close' && (
        <>
          <path d="M7 7l10 10" />
          <path d="M17 7L7 17" />
        </>
      )}
      {name === 'vdot' && (
        <>
          <path d="M4 18.5 8.8 12l4.1 3.8L20 5.5" />
          <circle cx="8.8" cy="12" r="1.3" />
          <circle cx="12.9" cy="15.8" r="1.3" />
          <circle cx="20" cy="5.5" r="1.3" />
        </>
      )}
      {name === 'zones' && (
        <>
          <rect x="4" y="16" width="3" height="4" rx="1" />
          <rect x="8.5" y="12" width="3" height="8" rx="1" />
          <rect x="13" y="8" width="3" height="12" rx="1" />
          <rect x="17.5" y="4" width="3" height="16" rx="1" />
        </>
      )}
      {name === 'sync' && (
        <>
          <path d="M4 12a8 8 0 0 1 13.6-5.6" />
          <path d="M20 12a8 8 0 0 1-13.6 5.6" />
          <polyline points="18,4 18,8 14,8" />
          <polyline points="6,20 6,16 10,16" />
        </>
      )}
      {name === 'globe' && (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M4 12h16" />
          <ellipse cx="12" cy="12" rx="3" ry="8" />
        </>
      )}
      {name === 'chart' && (
        <>
          <rect x="3" y="12" width="4" height="8" rx="1" />
          <rect x="10" y="7" width="4" height="13" rx="1" />
          <rect x="17" y="3" width="4" height="17" rx="1" />
        </>
      )}
    </svg>
  );
}

function VdotSpark() {
  const points = [54.2, 54.6, 54.5, 55.1, 55.4, 55.8, 56, 56.4, 56.8, 57, 56.7, 57.2, 57.6, 58, 58.4];
  const min = 53.5;
  const max = 59;
  const coord = (value, index) => `${(index / (points.length - 1)) * 270 + 5},${75 - ((value - min) / (max - min)) * 65}`;
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  const handleMove = useCallback((event) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Map the cursor's horizontal pixel position into the viewBox's 0–280 space.
    const ratio = (event.clientX - rect.left) / rect.width;
    const viewBoxX = ratio * 280;
    // Snap to the nearest data point (each point sits at x = index/(n-1)*270 + 5).
    const nearest = Math.round(((viewBoxX - 5) / 270) * (points.length - 1));
    setHoverIndex(Math.max(0, Math.min(points.length - 1, nearest)));
  }, [points.length]);

  const handleLeave = useCallback(() => setHoverIndex(null), []);

  const isHovering = hoverIndex !== null;
  const activeIndex = hoverIndex ?? points.length - 1;
  const activeValue = points[activeIndex];
  const [activeX, activeY] = coord(activeValue, activeIndex).split(',').map(Number);
  // Position the guide/dot/tooltip via CSS transform (GPU-accelerated, smooth)
  // instead of mutating SVG geometry attributes, which can't be transitioned.
  const translate = `translate(${activeX}px, ${activeY}px)`;
  const tooltipLeftPct = (activeX / 280) * 100;

  return (
    <div className="landing-cinematic-vdot-spark-wrap">
      <svg
        ref={svgRef}
        viewBox="0 0 280 80"
        className="landing-cinematic-vdot-spark"
        role="img"
        aria-label={`VO2max trend: latest ${points[points.length - 1]}`}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        <polygon points={`${points.map(coord).join(' ')} 275,80 5,80`} className="landing-cinematic-vdot-fill" />
        <polyline points={points.map(coord).join(' ')} className="landing-cinematic-vdot-line" />
        {/* guide + highlighted marker — positioned with transform so they glide. */}
        <line
          x1="0" y1="6" x2="0" y2="80"
          className={`landing-cinematic-vdot-guide${isHovering ? ' is-active' : ''}`}
          style={{ transform: `translateX(${activeX}px)` }}
        />
        <circle
          cx="0" cy="0" r="3.5"
          className={`landing-cinematic-vdot-dot is-active${isHovering ? ' is-hover' : ''}`}
          style={{ transform: translate }}
        />
      </svg>
      <div
        className={`landing-cinematic-vdot-tooltip${isHovering ? ' is-visible' : ''}`}
        style={{ left: `${tooltipLeftPct}%` }}
      >
        <strong>{activeValue.toFixed(1)}</strong>
        <span>VO2max · day {activeIndex + 1}</span>
      </div>
    </div>
  );
}

const WORLD_MAP_GRATICULE = [
  'M8 12.5H94',
  'M6 25H96',
  'M10 37.5H92',
  'M25 3V47',
  'M50 2V48',
  'M75 3V47',
];

const ROBINSON_X_COEFFICIENTS = [
  1,
  0.9986,
  0.9954,
  0.99,
  0.9822,
  0.973,
  0.96,
  0.9427,
  0.9216,
  0.8962,
  0.8679,
  0.835,
  0.7986,
  0.7597,
  0.7186,
  0.6732,
  0.6213,
  0.5722,
  0.5322,
];

const ROBINSON_Y_COEFFICIENTS = [
  0,
  0.062,
  0.124,
  0.186,
  0.248,
  0.31,
  0.372,
  0.434,
  0.4958,
  0.5571,
  0.6176,
  0.6769,
  0.7346,
  0.7903,
  0.8435,
  0.8936,
  0.9394,
  0.9761,
  1,
];

function interpolateRobinsonCoefficient(coefficients, absLat) {
  const clampedLat = Math.max(0, Math.min(90, absLat));
  const lowerIndex = Math.min(Math.floor(clampedLat / 5), coefficients.length - 2);
  const localT = (clampedLat - lowerIndex * 5) / 5;

  return coefficients[lowerIndex] + ((coefficients[lowerIndex + 1] - coefficients[lowerIndex]) * localT);
}

function projectWorldPoint({ lat, lng }) {
  const absLat = Math.abs(lat);
  const xCoefficient = interpolateRobinsonCoefficient(ROBINSON_X_COEFFICIENTS, absLat);
  const yCoefficient = interpolateRobinsonCoefficient(ROBINSON_Y_COEFFICIENTS, absLat);
  const robinsonX = 50 + ((lng / 360) * 100 * xCoefficient);
  const robinsonY = 25 - (lat >= 0 ? yCoefficient : -yCoefficient) * 25;

  return {
    x: robinsonX,
    y: robinsonY,
  };
}

const RACE_MAP_CITY_ANCHORS = {
  'tokyo-marathon': { x: 83.65, y: 13.65 },
  'boston-marathon': { x: 29.85, y: 11.60 },
  'london-marathon': { x: 47.35, y: 8.95 },
  'berlin-marathon': { x: 51.55, y: 8.55 },
  'chicago-marathon': { x: 27.45, y: 12.15 },
  'new-york-city-marathon': { x: 29.60, y: 12.15 },
  'paris-marathon': { x: 49.45, y: 10.05 },
  'valencia-marathon': { x: 47.10, y: 12.40 },
  'sydney-marathon': { x: 85.25, y: 35.55 },
  'comrades-marathon': { x: 55.50, y: 34.40 },
};

function resolveRaceMapPoint(race) {
  return RACE_MAP_CITY_ANCHORS[race.id] ?? projectWorldPoint(race.geo);
}

const RACE_MAP_CYCLE_STEP_SECONDS = 3;

function getRaceCycleDuration(total) {
  return `${Math.max(total, 1) * RACE_MAP_CYCLE_STEP_SECONDS}s`;
}

function getRaceTimelineDelay(index, total) {
  if (!total) return '0s';

  return `${index * RACE_MAP_CYCLE_STEP_SECONDS}s`;
}

function buildCurvedFlightPath(points) {
  if (points.length < 2) return '';

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;

    const previous = points[index - 1];
    const midpointX = (previous.x + point.x) / 2;
    const midpointY = (previous.y + point.y) / 2;
    const arcLift = Math.min(8, Math.max(2.4, Math.abs(point.x - previous.x) * 0.08));
    const controlY = Math.min(previous.y, point.y, midpointY) - arcLift;

    return `${path} Q ${midpointX.toFixed(2)} ${controlY.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, '');
}

function WorldMap({ races, metricLabels, flowLabels }) {
  // The dotted base map is a mid-page asset; only fetch it once the map
  // section approaches the viewport so first-load bandwidth stays for the hero.
  const mapHostRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const host = mapHostRef.current;
    if (!host) return undefined;
    if (typeof IntersectionObserver !== 'function') {
      setMapReady(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setMapReady(true);
        observer.disconnect();
      }
    }, { rootMargin: '600px 0px' });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const racePins = races.map((race) => ({
    ...race,
    pin: race.pin ?? (race.geo ? resolveRaceMapPoint(race) : null),
  }));
  const flightPoints = racePins.map((race) => race.pin).filter(Boolean);
  const flightPath = buildCurvedFlightPath([...flightPoints, flightPoints[0]].filter(Boolean));
  const getRacePhaseDelay = (index) => getRaceTimelineDelay(index, racePins.length);
  const raceCycleDuration = getRaceCycleDuration(racePins.length);
  const flowSteps = [
    { key: 'locate', order: '01', label: flowLabels.select },
    { key: 'read', order: '02', label: flowLabels.score },
    { key: 'match', order: '03', label: flowLabels.plan },
  ];

  return (
    <div ref={mapHostRef} className="landing-cinematic-map" style={{ '--race-cycle-duration': raceCycleDuration }} aria-hidden="true">
      <svg viewBox="0 0 100 50" preserveAspectRatio="xMidYMid meet">
        <g className="landing-cinematic-map-graticule">
          {WORLD_MAP_GRATICULE.map((path) => <path key={path} d={path} />)}
        </g>
        <image
          href={mapReady ? worldMapPoliticalDotted : undefined}
          width="100"
          height="50"
          preserveAspectRatio="none"
          className="landing-cinematic-map-reference"
        />
        {flightPath ? (
          <>
            <path d={flightPath} pathLength="1" className="landing-cinematic-map-flight-route" />
            <path d={flightPath} pathLength="1" className="landing-cinematic-map-flight-route-live" />
            <g className="landing-cinematic-map-aircraft" aria-hidden="true">
              <circle r="2.2" className="landing-cinematic-map-aircraft-glow" />
              <path
                d="M 2.55 0 L 0.46 -0.52 L -1.52 -1.62 L -1.82 -1.3 L -0.62 -0.08 L -1.7 1.12 L -1.34 1.48 L 0.46 0.52 Z"
                className="landing-cinematic-map-aircraft-shape"
              />
              <animateMotion dur={raceCycleDuration} path={flightPath} rotate="auto" repeatCount="indefinite" />
            </g>
          </>
        ) : null}
        {racePins.map((race, index) => (
          <g
            key={race.name}
            transform={`translate(${race.pin.x} ${race.pin.y})`}
            className="landing-cinematic-map-pin"
            style={{ '--race-index': index, '--race-delay': getRacePhaseDelay(index), '--race-cycle-duration': raceCycleDuration }}
          >
            <circle r="0.72" className="landing-cinematic-map-pin-halo" />
            <circle r="0.5" className="landing-cinematic-map-badge" />
            <circle r="0.12" className="landing-cinematic-map-core" />
            <text x="0" y="0.16" textAnchor="middle" className="landing-cinematic-map-order">
              {String(index + 1).padStart(2, '0')}
            </text>
          </g>
        ))}
      </svg>
      <div className="landing-cinematic-map-bottom-deck">
        <div className="landing-cinematic-map-guide">
          {flowSteps.map((step) => (
            <span key={step.key} className={`landing-cinematic-map-guide-step is-${step.key}`}>
              <strong>{step.label}</strong>
            </span>
          ))}
        </div>
        <div className="landing-cinematic-map-caption-strip">
          {racePins.map((race, index) => (
            <div
              key={`${race.name}-caption`}
              className="landing-cinematic-map-caption"
              style={{ '--race-index': index, '--race-delay': getRacePhaseDelay(index), '--race-cycle-duration': raceCycleDuration }}
            >
              <span className="landing-cinematic-map-caption-order">{String(index + 1).padStart(2, '0')}</span>
              <strong>{race.name}</strong>
              <span className="landing-cinematic-map-caption-verb">{flowLabels.score}</span>
              <div className="landing-cinematic-map-caption-meta">
                <em className="landing-cinematic-map-caption-field is-date"><span>{metricLabels.date}</span>{race.date}</em>
                <small className="landing-cinematic-map-caption-field is-days"><span>{metricLabels.days}</span>{race.days}</small>
                <b className="landing-cinematic-map-caption-field is-distance"><span>{metricLabels.distance}</span><i>{race.distance}</i></b>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnswerCard({ number, title, body, children }) {
  return (
    <article className="landing-cinematic-answer-card">
      <div className="landing-cinematic-answer-head">
        <span>{number}</span>
        <h3>{title}</h3>
      </div>
      <p>{body}</p>
      <div className="landing-cinematic-answer-figure">{children}</div>
    </article>
  );
}

function CompareGlyph({ value }) {
  if (value === true) {
    return (
      <span className="landing-cinematic-compare-cell">
        <LandingGlyph name="check" className="landing-cinematic-compare-icon is-yes" />
      </span>
    );
  }
  if (value === 'partial') {
    return (
      <span className="landing-cinematic-compare-cell">
        <LandingGlyph name="minus" className="landing-cinematic-compare-icon is-partial" />
      </span>
    );
  }
  return (
    <span className="landing-cinematic-compare-cell">
      <LandingGlyph name="close" className="landing-cinematic-compare-icon is-no" />
    </span>
  );
}

export default function Landing() {
  const { isAuthenticated, isAdmin, authHydrated } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [raceCountdownNow, setRaceCountdownNow] = useState(() => new Date());
  const heroScrollRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !authHydrated) return;
    navigate(isAdmin ? '/dashboard' : '/profile');
  }, [isAuthenticated, authHydrated, isAdmin, navigate]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    let timeoutId;
    const scheduleNextCountdownRefresh = () => {
      timeoutId = window.setTimeout(() => {
        setRaceCountdownNow(new Date());
        scheduleNextCountdownRefresh();
      }, getMillisecondsUntilTomorrow());
    };
    scheduleNextCountdownRefresh();
    return () => window.clearTimeout(timeoutId);
  }, []);

  const startStrava = useCallback(() => {
    window.location.href = `${getBackendBaseUrl()}/api/auth/strava/start?state=login`;
  }, []);

  const navLinks = [
    ['#features', t('landing.cinematic_nav_daily')],
    ['#answers', t('landing.cinematic_nav_method')],
    ['#races', t('landing.cinematic_nav_races')],
    ['#compare', t('landing.cinematic_nav_compare')],
  ];

  const commandCards = [
    {
      number: '01',
      title: t('landing.cinematic_answer_1_title'),
      body: t('landing.cinematic_answer_1_body'),
      metric: t('landing.command_card_1_metric'),
    },
    {
      number: '02',
      title: t('landing.cinematic_answer_2_title'),
      body: t('landing.cinematic_answer_2_body'),
      metric: t('landing.command_card_2_metric'),
    },
    {
      number: '03',
      title: t('landing.cinematic_answer_3_title'),
      body: t('landing.cinematic_answer_3_body'),
      metric: t('landing.command_card_3_metric'),
    },
  ];

  // Showcase facts (months, distances, coordinates) come from the bundled
  // world race catalog; only the display names localize through landing keys.
  const showcaseNames = {
    'berlin-marathon': t('landing.cinematic_race_berlin'),
    'sydney-marathon': t('landing.cinematic_race_sydney'),
    'chicago-marathon': t('landing.cinematic_race_chicago'),
    'new-york-city-marathon': t('landing.cinematic_race_new_york'),
    'valencia-marathon': t('landing.cinematic_race_valencia'),
    'tokyo-marathon': t('landing.cinematic_race_tokyo'),
    'boston-marathon': t('landing.cinematic_race_boston'),
    'london-marathon': t('landing.cinematic_race_london'),
    'paris-marathon': t('landing.cinematic_race_paris'),
    'comrades-marathon': t('landing.cinematic_race_comrades'),
  };
  const races = buildLandingRaceShowcase(raceCountdownNow).map((race) => ({
    ...race,
    name: showcaseNames[race.id] ?? race.catalogName,
    date: formatRaceMonthLabel(race.nextOccurrence),
    days: getRaceCountdownDays(race.nextOccurrence.toISOString().slice(0, 10), raceCountdownNow),
    distance: formatRaceDistanceLabel(race.distanceKm),
  }));

  const compareRows = [
    { feature: t('landing.cinematic_compare_decision'), note: t('landing.cinematic_compare_decision_note'), hermes: true, strava: 'partial', runna: 'partial' },
    { feature: t('landing.cinematic_compare_race_plan'), note: t('landing.cinematic_compare_race_plan_note'), hermes: 'partial', strava: 'partial', runna: true },
    { feature: t('landing.cinematic_compare_formula'), note: t('landing.cinematic_compare_formula_note'), hermes: true, strava: false, runna: false },
    { feature: t('landing.cinematic_compare_sync'), note: t('landing.cinematic_compare_sync_note'), hermes: true, strava: true, runna: 'partial' },
    { feature: t('landing.cinematic_compare_acwr'), note: t('landing.cinematic_compare_acwr_note'), hermes: true, strava: 'partial', runna: 'partial' },
    { feature: t('landing.cinematic_compare_shoes'), note: t('landing.cinematic_compare_shoes_note'), hermes: true, strava: 'partial', runna: false },
    { feature: t('landing.cinematic_compare_local'), note: t('landing.cinematic_compare_local_note'), hermes: true, strava: false, runna: false },
    { feature: t('landing.cinematic_compare_noise'), note: t('landing.cinematic_compare_noise_note'), hermes: true, strava: false, runna: true },
  ];

  const footerUtilityLinks = [
    { label: t('landing.stitch_footer_terms'), to: '/terms' },
    { label: t('landing.stitch_footer_privacy'), to: '/privacy' },
    { label: t('landing.stitch_footer_support'), href: SUPPORT_MAILTO },
  ];

  return (
    <div className="landing-page--cinematic landing-page--liquid-glass" data-hermes-landing="true">
      {/* ── Navigation ── */}
      <header className={`landing-cinematic-nav ${isScrolled ? 'is-scrolled' : ''}`}>
        <PageWidth className="landing-cinematic-nav-inner">
          <Link to="/" className="landing-cinematic-brand">
            <span className="landing-cinematic-brand-glyph" aria-hidden="true">
              <LandingGlyph name="logo" />
            </span>
            <span>HERMES</span>
          </Link>

          <nav className="landing-cinematic-links" aria-label={t('landing.cinematic_nav_label')}>
            {navLinks.map(([href, label]) => (
              <a key={href} href={href}>{label}</a>
            ))}
          </nav>

          <div className="landing-cinematic-nav-actions">
            <Link to="/login" className="landing-cinematic-btn landing-cinematic-btn--ghost">{t('landing.sign_in')}</Link>
            <Link to="/signup" className="landing-cinematic-btn landing-cinematic-btn--primary">
              <span>{t('landing.signup_link')}</span>
              <LandingGlyph name="arrow" />
            </Link>
          </div>
        </PageWidth>
      </header>

      <main>
        {/* ── 1. Hero ── */}
        <section ref={heroScrollRef} className="landing-cinematic-hero landing-cinematic-hero--minimal">
          <PageWidth className="landing-cinematic-hero-inner landing-hero-shoe-grid">
            <div className="landing-cinematic-hero-copy landing-command-copy">
              <h1 className="landing-cinematic-hero-title">
                <span>{t('landing.cinematic_hero_line_1')}</span>
                <span>{t('landing.cinematic_hero_line_2')}</span>
                <span className="is-accent">{t('landing.cinematic_hero_line_3')}</span>
              </h1>
              <p>{t('landing.cinematic_hero_text')}</p>

              <div className="landing-cinematic-hero-actions">
                <button type="button" className="landing-cinematic-btn landing-cinematic-btn--primary landing-cinematic-btn--strava is-large" onClick={startStrava} aria-label={t('landing.cta_strava')}>
                  <img className="landing-strava-connect-button" src={stravaConnectButton} alt="" width="237" height="48" loading="eager" decoding="async" />
                </button>
                <Link to="/signup" className="landing-cinematic-hero-alt-link">
                  {t('landing.get_started')}
                </Link>
              </div>

              <div className="landing-cinematic-trust">
                <span>{t('landing.cinematic_trust_local')}</span>
              </div>
            </div>
            <ShoeRunCycle scrollContainerRef={heroScrollRef} />
          </PageWidth>
        </section>

        {/* ── 2. Feature Grid ── */}
        <section id="features" className="landing-command-deck landing-command-deck--minimal-black">
          <PageWidth className="landing-command-deck-grid">
            <RevealSection className="landing-command-card-stack">
              {commandCards.map((card) => (
                <article key={card.number} className="landing-command-card">
                  <div className="landing-command-card-head">
                    <span>{card.number}</span>
                    <h2>{card.title}</h2>
                  </div>
                  <p>{card.body}</p>
                  <strong>{card.metric}</strong>
                </article>
              ))}
            </RevealSection>
          </PageWidth>
        </section>

        {/* ── 3. Three Daily Answers ── */}
        <section id="answers" className="landing-cinematic-answers">
          <PageWidth>
            <RevealSection className="landing-cinematic-section-head landing-cinematic-section-head--answers">
              <span className="landing-cinematic-kicker">{t('landing.cinematic_answers_kicker')}</span>
              <h2 className="landing-cinematic-answers-title">{t('landing.cinematic_answers_title')} <span>{t('landing.cinematic_answers_title_muted')}</span></h2>
            </RevealSection>

            <div className="landing-cinematic-answer-grid">
              <RevealSection delay={40}>
                <AnswerCard number="01" title={t('landing.cinematic_answer_1_title')} body={t('landing.cinematic_answer_1_body')}>
                  <div className="landing-cinematic-mini-paces">
                    {[t('landing.cinematic_zone_recovery'), t('landing.cinematic_zone_easy'), t('landing.cinematic_zone_marathon'), t('landing.cinematic_zone_threshold'), t('landing.cinematic_zone_interval'), t('landing.cinematic_zone_repetition')].map((label, index) => (
                      <div key={label} className={index === 3 ? 'is-active' : ''}>
                        <span>{label}</span>
                        <strong>{['6:18', '5:42', '4:36', '4:21', '3:52', '3:30'][index]}</strong>
                      </div>
                    ))}
                  </div>
                </AnswerCard>
              </RevealSection>

              <RevealSection delay={90}>
                <AnswerCard number="02" title={t('landing.cinematic_answer_2_title')} body={t('landing.cinematic_answer_2_body')}>
                  <VdotSpark />
                  <div className="landing-cinematic-vdot-row">
                    <strong>58.4</strong>
                    <span>+1.2 / 30d</span>
                  </div>
                </AnswerCard>
              </RevealSection>

              <RevealSection delay={140}>
                <AnswerCard number="03" title={t('landing.cinematic_answer_3_title')} body={t('landing.cinematic_answer_3_body')}>
                  {[
                    ['Endorphin Speed 4', '68%', t('landing.cinematic_shoe_today')],
                    ['Cloudmonster', '42%', t('landing.cinematic_shoe_easy')],
                    ['Vaporfly 3', '91%', t('landing.cinematic_shoe_race')],
                    ['Pegasus 41', '18%', t('landing.cinematic_shoe_recovery')],
                  ].map(([name, width, tag]) => (
                    <div key={name} className="landing-cinematic-shoe-row">
                      <div><span>{name}</span><em>{tag}</em></div>
                      <i><span style={{ width }} /></i>
                    </div>
                  ))}
                </AnswerCard>
              </RevealSection>
            </div>
          </PageWidth>
        </section>

        {/* ── 4. Races ── */}
        <section id="races" className="landing-cinematic-races">
          <PageWidth>
            <RevealSection className="landing-cinematic-section-head is-split">
              <div>
                <span className="landing-cinematic-kicker">{t('landing.cinematic_races_kicker')}</span>
                <h2>{t('landing.cinematic_races_title')}</h2>
              </div>
              <p>{t('landing.cinematic_races_copy')}</p>
            </RevealSection>

            <div className="landing-cinematic-race-stage">
              <WorldMap
                races={races}
                metricLabels={{
                  date: t('landing.cinematic_race_col_date'),
                  days: t('landing.cinematic_race_col_days'),
                  distance: t('landing.cinematic_race_col_distance'),
                }}
                flowLabels={{
                  select: t('landing.cinematic_race_flow_select'),
                  score: t('landing.cinematic_race_flow_score'),
                  plan: t('landing.cinematic_race_flow_plan'),
                }}
              />
              <RevealSection className="landing-cinematic-race-list" delay={70}>
                <div className="landing-cinematic-race-head">
                  <span aria-hidden="true" />
                  <span>{t('landing.cinematic_race_col_race')}</span>
                  <span>{t('landing.cinematic_race_col_date')}</span>
                  <span>{t('landing.cinematic_race_col_days')}</span>
                  <span>{t('landing.cinematic_race_col_distance')}</span>
                </div>
                {races.map((race, index) => (
                  <div
                    key={race.name}
                    className="landing-cinematic-race-row"
                    style={{
                      '--race-index': index,
                      '--race-delay': getRaceTimelineDelay(index, races.length),
                      '--race-cycle-duration': getRaceCycleDuration(races.length),
                    }}
                  >
                    <span className="landing-cinematic-race-order">{String(index + 1).padStart(2, '0')}</span>
                    <span>{race.name}</span>
                    <span data-label={t('landing.cinematic_race_col_date')}>
                      <span className="landing-cinematic-sr-only">{t('landing.cinematic_race_col_date')}: </span>
                      {race.date}
                    </span>
                    <strong data-label={t('landing.cinematic_race_col_days')}>
                      <span className="landing-cinematic-sr-only">{t('landing.cinematic_race_col_days')}: </span>
                      {race.days}
                    </strong>
                    <em data-label={t('landing.cinematic_race_col_distance')} className={index === 0 ? 'is-primary' : ''}>
                      <span className="landing-cinematic-sr-only">{t('landing.cinematic_race_col_distance')}: </span>
                      {race.distance}
                    </em>
                  </div>
                ))}
              </RevealSection>
            </div>
          </PageWidth>
        </section>

        {/* ── 8. Comparison ── */}
        <section id="compare" className="landing-cinematic-compare">
          <PageWidth>
            <RevealSection className="landing-cinematic-section-head">
              <span className="landing-cinematic-kicker">{t('landing.cinematic_compare_kicker')}</span>
              <h2>{t('landing.cinematic_compare_title')}</h2>
            </RevealSection>

            <RevealSection className="landing-cinematic-compare-table">
              <div className="landing-cinematic-compare-row is-head">
                <span />
                <strong>Hermes</strong>
                <span>{t('landing.cinematic_compare_social')}</span>
                <span>{t('landing.cinematic_compare_device')}</span>
              </div>
              {compareRows.map(({ feature, note, hermes, strava, runna }) => (
                <div key={feature} className="landing-cinematic-compare-row">
                  <span className="landing-cinematic-compare-feature">
                    <strong>{feature}</strong>
                    <small>{note}</small>
                  </span>
                  <CompareGlyph value={hermes} />
                  <CompareGlyph value={strava} />
                  <CompareGlyph value={runna} />
                </div>
              ))}
            </RevealSection>
          </PageWidth>
        </section>

        {/* ── 9. Final CTA ── */}
        <section className="landing-cinematic-final">
          <PageWidth>
            <RevealSection className="landing-cinematic-final-card landing-cinematic-final-card--minimal">
              <div className="landing-cinematic-final-copy">
                <span className="landing-cinematic-kicker">{t('landing.cinematic_final_kicker')}</span>
                <h2>{t('landing.cinematic_cta_title')}</h2>
                <p>{t('landing.cinematic_cta_copy')}</p>
                <div className="landing-cinematic-hero-actions">
                  <button type="button" className="landing-cinematic-btn landing-cinematic-btn--primary landing-cinematic-btn--strava is-large" onClick={startStrava} aria-label={t('landing.cta_strava')}>
                    <img className="landing-strava-connect-button" src={stravaConnectButton} alt="" width="237" height="48" loading="lazy" decoding="async" />
                  </button>
                  <Link to="/signup" className="landing-cinematic-btn landing-cinematic-btn--outline is-large">
                    {t('landing.get_started')}
                  </Link>
                </div>
                <div className="landing-cinematic-final-trust">
                  <span>{t('landing.cinematic_final_no_card')}</span>
                  <span>{t('landing.cinematic_final_no_feed')}</span>
                  <span>{t('landing.cinematic_final_method')}</span>
                </div>
              </div>
            </RevealSection>
          </PageWidth>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="landing-cinematic-footer">
        <PageWidth className="landing-cinematic-footer-inner">
          <div className="landing-cinematic-footer-brand">
            <strong>HERMES</strong>
            <span>{t('landing.footer')}</span>
          </div>
          <div className="landing-cinematic-footer-links">
            {footerUtilityLinks.map((link) => (
              link.to ? (
                <Link key={link.label} to={link.to} className="landing-cinematic-footer-link">{link.label}</Link>
              ) : (
                <a key={link.label} href={link.href} className="landing-cinematic-footer-link">{link.label}</a>
              )
            ))}
          </div>
        </PageWidth>
      </footer>
    </div>
  );
}
