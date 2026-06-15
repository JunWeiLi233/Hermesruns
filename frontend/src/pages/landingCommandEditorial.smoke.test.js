import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');

function read(relativePath) {
  return readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const landingSource = read('pages/Landing.jsx');
const styleSource = read('styles/style.css');
const retiredHeroGridClassPair = ['landing-cinematic-hero-grid', 'landing-command-hero'].join(' ');

assert(
  landingSource.includes('landing-command-copy')
    && !landingSource.includes(retiredHeroGridClassPair)
    && !landingSource.includes('landing-command-board landing-cinematic-hero-proof'),
  'Landing hero should keep the command editorial copy without the removed hero grid or proof board.',
);

assert(
  !landingSource.includes("t('landing.badge')"),
  'Landing hero should not render the retired landing badge copy.',
);

assert(
  landingSource.includes('landing-command-deck')
    && landingSource.includes('landing-command-card-stack')
    && landingSource.includes('landing-command-rhythm')
    && !landingSource.includes('landing-cinematic-feature-grid'),
  'Landing should use the command deck instead of the old equal feature grid.',
);

assert(
  landingSource.includes("['#races', t('landing.cinematic_nav_races')]")
    && landingSource.includes('<section id="races" className="landing-cinematic-races">'),
  'Landing Races navigation should point to the actual race map section.',
);

assert(
  styleSource.includes('Landing command editorial redesign')
    && /\.landing-command-copy\s*\{[\s\S]*padding:\s*clamp\(120px,\s*19vh,\s*218px\)\s+0\s+clamp\(40px,\s*8vh,\s*92px\);/.test(styleSource)
    && /\.landing-command-deck-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(320px,\s*0\.9fr\)\s+minmax\(0,\s*1\.1fr\);/.test(styleSource),
  'Landing command CSS should define the hero copy spacing and command deck grid.',
);

assert(
  /\.landing-command-copy\s+\.landing-cinematic-hero-title\s*>\s*span\s*\{[\s\S]*text-wrap:\s*nowrap;/.test(styleSource),
  'Landing hero title spans should keep manual line breaks instead of inheriting balanced wrapping.',
);

assert(
  /\.landing-command-copy\s+\.landing-cinematic-hero-title\s*>\s*span:not\(\.is-accent\)\s*\{[\s\S]*color:\s*rgba\(255,\s*250,\s*243,\s*0\.82\);/.test(styleSource),
  'Landing hero non-accent title lines should stay legible on the dark first screen.',
);

assert(
  landingSource.includes("navigate(isAdmin ? '/dashboard' : '/profile')")
    && landingSource.includes('/api/auth/strava/start?state=login')
    && landingSource.includes('to="/login"')
    && landingSource.includes('to="/signup"'),
  'Landing redesign must preserve auth redirect, Strava start, and login/signup routes.',
);

assert(
  !landingSource.includes('const heroWorkout =')
    && !landingSource.includes("t('landing.cinematic_hud_workout_title', heroWorkout)")
    && !landingSource.includes("t('landing.cinematic_hud_workout_copy', heroWorkout)")
    && !landingSource.includes("t('landing.cinematic_hud_shoe', heroWorkout)"),
  'Landing hero should not keep the removed command-board workout placeholders.',
);

assert(
  landingSource.includes('const formulaValues =')
    && landingSource.includes("t('landing.cinematic_formula_vdot', formulaValues)")
    && landingSource.includes("t('landing.cinematic_formula_acwr', formulaValues)")
    && landingSource.includes("t('landing.cinematic_formula_recovery', formulaValues)")
    && landingSource.includes("t('landing.cinematic_formula_paces', formulaValues)")
    && landingSource.includes("t('landing.cinematic_formula_last_input_value', formulaValues)"),
  'Landing formula copy should provide replacements for every public placeholder token.',
);

assert(
  landingSource.includes('className="landing-cinematic-race-order"')
    && landingSource.includes('function getRaceTimelineDelay(index, total)')
    && landingSource.includes('function getRaceCycleDuration(total)')
    && landingSource.includes('const RACE_MAP_CYCLE_STEP_SECONDS = 3;')
    && landingSource.includes('const ROBINSON_X_COEFFICIENTS =')
    && landingSource.includes('const ROBINSON_Y_COEFFICIENTS =')
    && landingSource.includes('const RACE_MAP_CITY_ANCHORS =')
    && landingSource.includes('function interpolateRobinsonCoefficient(coefficients, absLat)')
    && landingSource.includes('function resolveRaceMapPoint(race)')
    && landingSource.includes('RACE_MAP_CITY_ANCHORS[race.id]')
    && !landingSource.includes('function getRaceLabelOffset(index)')
    && !landingSource.includes('className="landing-cinematic-map-label"')
    && landingSource.includes('className="landing-cinematic-map-badge"')
    && landingSource.includes('textAnchor="middle"')
    && landingSource.includes('const robinsonX = 50 + ((lng / 360) * 100 * xCoefficient);')
    && landingSource.includes('const robinsonY = 25 - (lat >= 0 ? yCoefficient : -yCoefficient) * 25;')
    && !landingSource.includes('((lng + 180) / 360) * 100')
    && !landingSource.includes('((90 - lat) / 180) * WORLD_MAP_VIEWBOX_HEIGHT')
    && landingSource.includes('return `${index * RACE_MAP_CYCLE_STEP_SECONDS}s`;')
    && landingSource.includes('return `${Math.max(total, 1) * RACE_MAP_CYCLE_STEP_SECONDS}s`;')
    && !landingSource.includes('function buildRaceReadoutPath(pin, index)')
    && landingSource.includes("'--race-cycle-duration': getRaceCycleDuration(races.length)")
    && landingSource.includes("style={{ '--race-cycle-duration': raceCycleDuration }}")
    && !landingSource.includes('className="landing-cinematic-map-readout-layer"')
    && !landingSource.includes('className="landing-cinematic-map-readout-line"')
    && !landingSource.includes('pathLength="1"')
    && landingSource.includes('className="landing-cinematic-map-selection-layer"')
    && landingSource.includes('className="landing-cinematic-map-selection"')
    && landingSource.includes('className="landing-cinematic-map-selection-spread"')
    && landingSource.includes('className="landing-cinematic-map-selection-ping"')
    && landingSource.includes('className="landing-cinematic-map-selection-ring"')
    && !landingSource.includes('<animateMotion')
    && !/pin:\s*\{/.test(landingSource)
    && landingSource.includes('className="landing-cinematic-map-timeline"')
    && landingSource.includes('className="landing-cinematic-map-timeline-item"')
    && landingSource.includes('className="landing-cinematic-map-guide"')
    && landingSource.includes('className={`landing-cinematic-map-guide-step is-${step.key}`}')
    && landingSource.includes('className="landing-cinematic-map-bottom-deck"')
    && landingSource.includes("{ key: 'locate', order: '01', label: flowLabels.select }")
    && landingSource.includes("{ key: 'read', order: '02', label: flowLabels.score }")
    && landingSource.includes("{ key: 'match', order: '03', label: flowLabels.plan }")
    && landingSource.includes('className="landing-cinematic-map-caption-strip"')
    && landingSource.includes('className="landing-cinematic-map-caption-meta"')
    && landingSource.includes('function WorldMap({ races, metricLabels, flowLabels })')
    && landingSource.includes('metricLabels={{')
    && landingSource.includes('flowLabels={{')
    && landingSource.includes("select: t('landing.cinematic_race_flow_select')")
    && landingSource.includes("score: t('landing.cinematic_race_flow_score')")
    && landingSource.includes("plan: t('landing.cinematic_race_flow_plan')")
    && landingSource.includes('<span className="landing-cinematic-map-caption-order">{String(index + 1).padStart(2, \'0\')}</span>')
    && landingSource.includes('<span className="landing-cinematic-map-caption-verb">{flowLabels.score}</span>')
    && landingSource.includes("date: t('landing.cinematic_race_col_date')")
    && landingSource.includes('<em className="landing-cinematic-map-caption-field is-date"><span>{metricLabels.date}</span>{race.date}</em>')
    && landingSource.includes('<small className="landing-cinematic-map-caption-field is-days"><span>{metricLabels.days}</span>{race.days}</small>')
    && landingSource.includes('<b className="landing-cinematic-map-caption-field is-goal"><span>{metricLabels.goal}</span>{race.goal}</b>')
    && landingSource.includes("data-label={t('landing.cinematic_race_col_date')}")
    && landingSource.includes("data-label={t('landing.cinematic_race_col_days')}")
    && landingSource.includes("data-label={t('landing.cinematic_race_col_goal')}")
    && landingSource.includes('className="landing-cinematic-sr-only"'),
  'Landing race rows and map captions should use fixed projected coordinates, a data-driven cycle duration, and a readable pin-to-readout-to-row animation instead of fake route or score-panel motion.',
);

assert(
  landingSource.includes("t('landing.cinematic_race_london')")
    && landingSource.includes("t('landing.cinematic_race_new_york')")
    && landingSource.includes("t('landing.cinematic_race_paris')")
    && landingSource.includes("t('landing.cinematic_race_valencia')")
    && landingSource.includes("t('landing.cinematic_race_sydney')")
    && landingSource.includes("geo: { lat: 51.5072, lng: -0.1276 }")
    && landingSource.includes("geo: { lat: 40.7128, lng: -74.006 }")
    && landingSource.includes("geo: { lat: 48.8566, lng: 2.3522 }")
    && landingSource.includes("geo: { lat: 39.4699, lng: -0.3763 }")
    && landingSource.includes("geo: { lat: -33.8688, lng: 151.2093 }"),
  'Landing race map should include additional famous marathons with real projected coordinates.',
);

assert(
  landingSource.includes("id: 'tokyo'")
    && landingSource.includes("id: 'boston'")
    && landingSource.includes("id: 'london'")
    && landingSource.includes("id: 'berlin'")
    && landingSource.includes("id: 'chicago'")
    && landingSource.includes("id: 'newYork'")
    && landingSource.includes("id: 'paris'")
    && landingSource.includes("id: 'valencia'")
    && landingSource.includes("id: 'sydney'")
    && landingSource.includes("id: 'comrades'")
    && landingSource.includes('tokyo: { x: 83.65, y: 13.65 }')
    && landingSource.includes('boston: { x: 29.85, y: 11.60 }')
    && landingSource.includes('london: { x: 47.35, y: 8.95 }')
    && landingSource.includes('berlin: { x: 51.55, y: 8.55 }')
    && landingSource.includes('chicago: { x: 27.45, y: 12.15 }')
    && landingSource.includes('newYork: { x: 29.60, y: 12.15 }')
    && landingSource.includes('paris: { x: 49.45, y: 10.05 }')
    && landingSource.includes('valencia: { x: 47.10, y: 12.40 }')
    && landingSource.includes('sydney: { x: 85.25, y: 35.55 }')
    && landingSource.includes('comrades: { x: 55.50, y: 34.40 }'),
  'Landing race map pins should use PNG-calibrated city-region anchors so coastal races sit on the correct marathon region instead of nearby ocean, New Zealand, or the wrong coastline.',
);

assert(
  !landingSource.includes('className="landing-cinematic-map-cursor"')
    && !landingSource.includes('className="landing-cinematic-map-scan"')
    && !landingSource.includes('className="landing-cinematic-map-handoff-line"')
    && !landingSource.includes('className="landing-cinematic-map-decision-rail"')
    && !landingSource.includes('className="landing-cinematic-map-rail-node"')
    && !landingSource.includes('className="landing-cinematic-map-signal-line"')
    && !landingSource.includes('className="landing-cinematic-map-hub-packet"')
    && !landingSource.includes('className="landing-cinematic-map-dossier-token"')
    && !landingSource.includes('className="landing-cinematic-map-answer-token"')
    && !landingSource.includes('className="landing-cinematic-map-request-card"')
    && !landingSource.includes('className="landing-cinematic-map-recommendation-card"')
    && !landingSource.includes('className="landing-cinematic-map-hub"')
    && !landingSource.includes('className="landing-cinematic-map-row-target"')
    && !landingSource.includes('className="landing-cinematic-map-table-node"')
    && !landingSource.includes('landing-cinematic-map-sequence')
    && !landingSource.includes('landing-cinematic-map-score')
    && !landingSource.includes('landing-cinematic-map-plan')
    && !landingSource.includes('landing-cinematic-map-selector')
    && !styleSource.includes('landing-cinematic-map-sequence')
    && !styleSource.includes('landing-cinematic-map-score')
    && !styleSource.includes('landing-cinematic-map-plan')
    && !styleSource.includes('landing-cinematic-map-selector')
    && !styleSource.includes('landing-cinematic-map-focus')
    && !styleSource.includes('landing-cinematic-map-flow')
    && !styleSource.includes('landing-cinematic-map-insight')
    && !landingSource.includes('function buildRaceSignalPath(pin)')
    && !landingSource.includes('function buildRaceHandoffPath(pin, index)')
    && !landingSource.includes('function buildRaceInputPath(pin)')
    && !landingSource.includes('function buildRaceOutputPath(index)')
    && !landingSource.includes('function buildRaceLegPath(previousPin, nextPin)')
    && !landingSource.includes('function buildRaceScorePath(pin)')
    && !landingSource.includes('function buildRacePlanPath(index)')
    && !styleSource.includes('landing-cinematic-map-cursor-route')
    && !styleSource.includes('landing-cinematic-map-scan-step')
    && !styleSource.includes('landing-cinematic-map-signal-step')
    && !styleSource.includes('landing-cinematic-map-hub-packet-step')
    && !styleSource.includes('landing-cinematic-map-dossier-token-step')
    && !styleSource.includes('landing-cinematic-map-answer-token-step')
    && !styleSource.includes('.landing-cinematic-map-handoff-line')
    && !styleSource.includes('.landing-cinematic-map-decision-rail')
    && !styleSource.includes('.landing-cinematic-map-rail-node')
    && !styleSource.includes('landing-cinematic-map-request-card')
    && !styleSource.includes('landing-cinematic-map-recommendation-card')
    && !styleSource.includes('landing-cinematic-map-hub')
    && !styleSource.includes('landing-cinematic-map-row-target')
    && !styleSource.includes('landing-cinematic-map-table-node')
    && !styleSource.includes('landing-cinematic-map-handoff-step')
    && !styleSource.includes('landing-cinematic-map-rail-node-step'),
  'Landing race map should not use the old decorative cursor, scan, packet, hub, or ambiguous handoff rail animation.',
);

assert(
  /\.landing-cinematic-map-selection-spread,[\s\S]*\.landing-cinematic-map-selection-ping,[\s\S]*\.landing-cinematic-map-selection-ring\s*\{[\s\S]*animation-duration:\s*var\(--race-cycle-duration,\s*15s\);[\s\S]*animation-delay:\s*var\(--race-delay\)/.test(styleSource)
    && !styleSource.includes('landing-cinematic-map-readout-line')
    && !styleSource.includes('landing-cinematic-map-readout-line-step')
    && /\.landing-cinematic-map-selection-spread\s*\{[\s\S]*animation-name:\s*landing-cinematic-map-selection-spread-step/.test(styleSource)
    && /\.landing-cinematic-map-selection-spread\s*\{[\s\S]*fill:\s*rgba\(240,\s*117,\s*97,\s*0\.14\)/.test(styleSource)
    && /\.landing-cinematic-map-selection-spread\s*\{[\s\S]*stroke-width:\s*1\.4/.test(styleSource)
    && /@keyframes landing-cinematic-map-selection-spread-step\s*\{[\s\S]*r:\s*86/.test(styleSource)
    && /\.landing-cinematic-map-selection-ring\s*\{[\s\S]*animation-name:\s*landing-cinematic-map-selection-ring-step/.test(styleSource)
    && /@keyframes landing-cinematic-map-selection-ring-step\s*\{[\s\S]*opacity:\s*0\.92/.test(styleSource)
    && /\.landing-cinematic-map-bottom-deck\s*\{[\s\S]*position:\s*absolute;[\s\S]*grid-template-columns:\s*minmax\(220px,\s*278px\) minmax\(0,\s*388px\);[\s\S]*justify-content:\s*space-between/.test(styleSource)
    && /\.landing-cinematic-map-guide\s*\{[\s\S]*width:\s*100%;[\s\S]*pointer-events:\s*none/.test(styleSource)
    && /\.landing-cinematic-map-guide-step\s*\{[\s\S]*animation-duration:\s*3s/.test(styleSource)
    && /@keyframes landing-cinematic-map-guide-locate-step\s*\{[\s\S]*transform:\s*translateX\(3px\)/.test(styleSource)
    && /@keyframes landing-cinematic-map-guide-read-step\s*\{[\s\S]*transform:\s*translateX\(3px\)/.test(styleSource)
    && /@keyframes landing-cinematic-map-guide-match-step\s*\{[\s\S]*transform:\s*translateX\(3px\)/.test(styleSource)
    && /\.landing-cinematic-map-timeline\s*\{[\s\S]*flex-wrap:\s*wrap;[\s\S]*width:\s*min\(430px,\s*calc\(100% - 36px\)\)/.test(styleSource)
    && /\.landing-cinematic-map-timeline-item\s*\{[\s\S]*animation:\s*landing-cinematic-map-timeline-step var\(--race-cycle-duration,\s*15s\)/.test(styleSource)
    && /@keyframes landing-cinematic-map-timeline-step\s*\{[\s\S]*color:\s*var\(--lc-coral\)/.test(styleSource)
    && /\.landing-cinematic-race-row::before,[\s\S]*\.landing-cinematic-race-row::after\s*\{[\s\S]*animation-duration:\s*var\(--race-cycle-duration,\s*15s\)/.test(styleSource)
    && /\.landing-cinematic-race-row::after\s*\{[\s\S]*animation-name:\s*landing-cinematic-race-row-panel-step/.test(styleSource)
    && /@keyframes landing-cinematic-race-row-panel-step\s*\{[\s\S]*14%,\s*20%/.test(styleSource)
    && /\.landing-cinematic-race-row strong::after\s*\{[\s\S]*animation:\s*landing-cinematic-race-days-meter-step var\(--race-cycle-duration,\s*15s\)/.test(styleSource)
    && /\.landing-cinematic-race-row em\s*\{[\s\S]*animation:\s*landing-cinematic-race-goal-step var\(--race-cycle-duration,\s*15s\)/.test(styleSource)
    && /@keyframes landing-cinematic-race-goal-step\s*\{[\s\S]*color:\s*var\(--lc-coral\)/.test(styleSource)
    && !/\.landing-cinematic-map-caption span,\s*[\r\n]\.landing-cinematic-map-caption em/.test(styleSource)
    && /\.landing-cinematic-map-caption-order\s*\{[\s\S]*font-size:\s*0\.68rem/.test(styleSource)
    && /\.landing-cinematic-map-caption-verb\s*\{[\s\S]*font-size:\s*0\.52rem/.test(styleSource)
    && /\.landing-cinematic-map-caption-strip\s*\{[\s\S]*position:\s*relative;[\s\S]*width:\s*100%;[\s\S]*min-height:\s*58px/.test(styleSource)
    && /\.landing-cinematic-map-caption-meta\s*\{[\s\S]*grid-template-columns:\s*auto/.test(styleSource)
    && /\.landing-cinematic-map-caption-meta em,[\s\S]*\.landing-cinematic-map-caption-meta small,[\s\S]*\.landing-cinematic-map-caption-meta b\s*\{[\s\S]*font-size:\s*0\.6rem/.test(styleSource)
    && /\.landing-cinematic-map-caption-field\.is-date\s*\{[\s\S]*animation-name:\s*landing-cinematic-map-caption-date-step/.test(styleSource)
    && /\.landing-cinematic-map-caption-field\.is-days\s*\{[\s\S]*animation-name:\s*landing-cinematic-map-caption-days-step/.test(styleSource)
    && /\.landing-cinematic-map-caption-field\.is-goal\s*\{[\s\S]*animation-name:\s*landing-cinematic-map-caption-goal-step/.test(styleSource)
    && /@keyframes landing-cinematic-map-caption-date-step\s*\{[\s\S]*4%,\s*8%/.test(styleSource)
    && /@keyframes landing-cinematic-map-caption-goal-step\s*\{[\s\S]*13%,\s*18%/.test(styleSource)
    && /\.landing-cinematic-map-caption-meta em span,[\s\S]*\.landing-cinematic-map-caption-meta small span,[\s\S]*\.landing-cinematic-map-caption-meta b span\s*\{[\s\S]*color:\s*rgba\(33,\s*30,\s*27,\s*0\.48\)/.test(styleSource)
    && /\.landing-cinematic-map-caption\s*\{[\s\S]*animation:\s*landing-cinematic-map-caption-step var\(--race-cycle-duration,\s*15s\)/.test(styleSource)
    && /\.landing-cinematic-map-caption:first-child\s*\{[\s\S]*opacity:\s*1/.test(styleSource),
  'Landing race map motion should explain the diagram with active race-pin selection, a readout line, sequential metric reading, delayed row matching, scaled timing, and reduced-motion fallback.',
);

assert(
  /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.landing-cinematic-race-row\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto;[\s\S]*min-height:\s*92px/.test(styleSource)
    && /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.landing-cinematic-map-timeline\s*\{[\s\S]*top:\s*8px;[\s\S]*width:\s*min\(320px,\s*calc\(100% - 28px\)\)/.test(styleSource)
    && /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.landing-cinematic-map-bottom-deck\s*\{[\s\S]*left:\s*50%;[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*width:\s*min\(320px,\s*calc\(100% - 28px\)\)/.test(styleSource)
    && /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.landing-cinematic-map-guide\s*\{[\s\S]*position:\s*static/.test(styleSource)
    && /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.landing-cinematic-map-caption-strip\s*\{[\s\S]*position:\s*relative/.test(styleSource),
  'Landing race sequence should keep compact mobile race cards plus centered mobile map timeline, guide, and caption.',
);

assert(
  /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.landing-cinematic-race-row span\[data-label\]::before,[\s\S]*content:\s*attr\(data-label\)/.test(styleSource),
  'Landing compact mobile race cards should label date, countdown, and goal values after the desktop table header is hidden.',
);

assert(
  /\.landing-cinematic-race-head\s*\{[\s\S]*border-bottom:\s*1px solid rgba\(33,\s*30,\s*27,\s*0\.1\);[\s\S]*color:\s*rgba\(33,\s*30,\s*27,\s*0\.56\);[\s\S]*font-weight:\s*820/.test(styleSource),
  'Landing desktop race table headers should remain readable enough to support the race data table.',
);

assert(
  /\.landing-cinematic-compare-table\s*\{[\s\S]*border:\s*1px solid rgba\(33,\s*30,\s*27,\s*0\.1\);[\s\S]*overflow:\s*hidden/.test(styleSource)
    && landingSource.includes('className="landing-cinematic-compare-cell"')
    && landingSource.includes('className="landing-cinematic-compare-feature"')
    && /\.landing-cinematic-compare-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(190px,\s*1\.35fr\) repeat\(3,\s*minmax\(92px,\s*0\.7fr\)\)/.test(styleSource)
    && /\.landing-cinematic-compare-feature\s*\{[\s\S]*display:\s*grid;[\s\S]*gap:\s*5px;[\s\S]*justify-items:\s*start/.test(styleSource)
    && /\.landing-cinematic-compare-icon\s*\{[\s\S]*display:\s*inline-grid;[\s\S]*place-items:\s*center;[\s\S]*width:\s*34px;[\s\S]*height:\s*34px/.test(styleSource)
    && /\.landing-cinematic-compare-icon\.is-no\s*\{[\s\S]*color:\s*rgba\(33,\s*30,\s*27,\s*0\.42\)/.test(styleSource),
  'Landing comparison chart should stay readable on the light landing surface with explained rows, compact columns, and visible yes/no/partial badges.',
);

assert(
  landingSource.includes("feature: t('landing.cinematic_compare_decision'), note: t('landing.cinematic_compare_decision_note'), hermes: true, strava: 'partial', runna: 'partial'")
    && landingSource.includes("feature: t('landing.cinematic_compare_race_plan'), note: t('landing.cinematic_compare_race_plan_note'), hermes: 'partial', strava: 'partial', runna: true")
    && landingSource.includes("feature: t('landing.cinematic_compare_formula'), note: t('landing.cinematic_compare_formula_note'), hermes: true, strava: false, runna: false")
    && landingSource.includes("feature: t('landing.cinematic_compare_sync'), note: t('landing.cinematic_compare_sync_note'), hermes: true, strava: true, runna: 'partial'")
    && landingSource.includes("feature: t('landing.cinematic_compare_shoes'), note: t('landing.cinematic_compare_shoes_note'), hermes: true, strava: 'partial', runna: false")
    && landingSource.includes("feature: t('landing.cinematic_compare_local'), note: t('landing.cinematic_compare_local_note'), hermes: true, strava: false, runna: false")
    && landingSource.includes("feature: t('landing.cinematic_compare_noise'), note: t('landing.cinematic_compare_noise_note'), hermes: true, strava: false, runna: true"),
  'Landing comparison chart should stay objective: Runna wins structured race plans while Hermes wins transparent formulas, private local analysis, shoe decisions, and no-feed coaching.',
);

assert(
  /\.landing-cinematic-sr-only\s*\{[\s\S]*clip:\s*rect\(0 0 0 0\);[\s\S]*white-space:\s*nowrap/.test(styleSource),
  'Landing race-card value labels should stay available to assistive tech without changing the visual layout.',
);

assert(
  !landingSource.includes('className="landing-cinematic-final-proof"')
    && !landingSource.includes('landing-cinematic-final-proof')
    && !styleSource.includes('landing-cinematic-final-proof')
    && !landingSource.includes('cinematic_final_proof')
    && !landingSource.includes('cinematic_final_proof_race')
    && !landingSource.includes('cinematic_final_proof_ready')
    && !landingSource.includes('<strong>2:52</strong>')
    && !landingSource.includes('<strong>82%</strong>')
    && /\.landing-cinematic-final-card\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*1fr;[\s\S]*radial-gradient\(circle at 14% 18%/.test(styleSource)
    && /\.landing-cinematic-final-card\s*\{[\s\S]*place-items:\s*center;[\s\S]*min-height:\s*390px/.test(styleSource)
    && /\.landing-cinematic-final-copy\s*\{[\s\S]*display:\s*grid;[\s\S]*justify-items:\s*center;[\s\S]*width:\s*min\(100%,\s*940px\)/.test(styleSource)
    && /\.landing-cinematic-final-copy h2\s*\{[\s\S]*color:\s*var\(--lc-ink\);[\s\S]*white-space:\s*nowrap/.test(styleSource)
    && /\.landing-cinematic-final-copy > p\s*\{[\s\S]*color:\s*rgba\(33,\s*30,\s*27,\s*0\.64\)/.test(styleSource)
    && /@media \(max-width:\s*840px\)\s*\{[\s\S]*\.landing-cinematic-final-copy h2\s*\{[\s\S]*white-space:\s*normal/.test(styleSource)
    && /\.landing-cinematic-final-trust\s*\{[\s\S]*justify-content:\s*center/.test(styleSource),
  'Landing final CTA should remove the three proof grids, keep centered content, and hold the desktop Chinese title on one line.',
);

console.log('[PASS] Landing command editorial guardrails passed.');
