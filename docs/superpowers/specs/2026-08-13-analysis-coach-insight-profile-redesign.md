# Analysis Coach Insight Profile Redesign

## Goal

Redesign `/analysis/coach-insight` so it feels like a natural extension of the current Profile page. Preserve every existing coach-insight data source, state, navigation action, and user-visible capability while replacing the separate command-center presentation with Profile's warmer kinetic-editorial hierarchy.

## Scope

The redesign applies only to the `coach-insight` branch rendered by `AnalysisInsightDetail.jsx` and its route-scoped styles. The other Analysis detail routes (`load-balance`, `intensity`, and `injury-risk`) must not change.

The following behavior must remain available:

- Authentication, loading, and error handling.
- Back navigation to `/analysis`.
- Assigned coach identity.
- Readiness score and description.
- Race forecast and forecast delta.
- Key workout and training focus.
- Performance index, coaching judgment, supporting statistics, and trend chart.
- Recent-session rows and navigation to `/run/:id`.
- Primary and secondary training blueprint sessions.
- Coaching rationale for the primary session.
- Today Run action and navigation to `/today-run`.
- Training phases, weekly focus cards, and recommendation reasons.
- English and Simplified Chinese localization.

No backend, API, analytics-model, or routing changes are included.

## Visual Direction

Use the current Profile page as the visual authority:

- Warm paper-like canvas with dark ink and coral accents.
- Editorial typography with strong, compact headings and restrained labels.
- One dominant narrative surface followed by compact evidence cards.
- Mostly square or lightly rounded card geometry instead of floating glass panels.
- One deliberate dark feature surface for contrast, not a fully dark dashboard.
- Fine borders, subtle shadows, and minimal decorative gradients.
- Dense data that remains scannable rather than decorative.

The implementation must use coach-insight-specific class names. It may mirror Profile's composition and tokens, but it must not import or depend on Profile's internal page-specific selectors.

## Information Hierarchy

### 1. Editorial Coach Hero

The first section establishes the coaching decision before showing evidence. It contains:

- Back action.
- Live/macrocycle context.
- Assigned coach identity.
- Current coaching judgment as the main headline.
- Supporting coach narrative.
- Readiness score as the dominant metric.
- Forecast and key-workout context as secondary facts.

The hero should feel related to Profile's greeting/readiness header and Today's Session card, while remaining specific to coaching analysis.

### 2. Decision Metric Strip

Render three equal evidence cards immediately after the hero:

- Race forecast.
- Key workout.
- Current training focus.

Each card has a compact label, one primary value, and one supporting line. No data is invented when a value is unavailable.

### 3. Coaching Workbench

Use an asymmetric two-column grid:

- Main column: performance narrative and trend chart, followed by recent sessions.
- Side column: training blueprint, primary-session rationale, secondary sessions, and the Today Run action.

The performance section is the primary evidence surface. Recent sessions remain individually navigable. The blueprint remains actionable and visually distinct from historical evidence.

### 4. Supporting Evidence

Keep the existing phase, weekly focus, and recommendation-reason content in a three-card bottom grid. These cards use the calmer Profile evidence-card treatment and should not compete with the hero or performance section.

## Data Flow

`buildMergedCoachSystemModel` remains the single presentation model for this route. The redesign consumes its existing fields directly and does not duplicate calculations in JSX or CSS.

The route keeps the current flow:

1. Load profile and activities.
2. Build the shared Analysis snapshot and recent rows.
3. Build the coach system model for `coach-insight`.
4. Render the Profile-aligned layout from that model.

Empty recent sessions continue to show the existing localized empty state. Optional primary or secondary sessions remain conditional. Missing metrics continue to use the model's existing fallback values.

## Responsive Behavior

- Above 1180px: editorial hero, three-column metric strip, asymmetric workbench, and three-column supporting evidence.
- At or below 1180px: workbench collapses to one column; metric and evidence grids remain compact where space permits.
- At or below 760px: metric and evidence grids become one column, hero facts stack, and session rows simplify without hiding values.
- At or below 640px: typography and spacing compress; actions remain full-width and touch-friendly.

No content may disappear solely because of viewport width.

## Accessibility And Interaction

- Preserve semantic headings and article/section landmarks.
- Preserve real buttons for navigation actions.
- Keep visible keyboard focus states.
- Decorative artwork and chart layers remain hidden from assistive technology.
- Text and metric contrast must remain readable in light, dark, and high-contrast themes supported by the existing shell.
- Motion, if any, is limited to existing hover/focus transitions and respects reduced-motion behavior.

## Testing And Proof

Add or extend focused source-level smoke coverage to verify:

- The coach-insight branch uses the new Profile-aligned hierarchy.
- Every preserved data section remains rendered.
- Back, run-detail, and Today Run navigation remain wired.
- The route-specific CSS defines desktop and mobile layouts.
- No other Analysis detail branch adopts the coach-insight classes.

Required verification:

- Focused coach-insight smoke test.
- Locale syntax checks if copy changes.
- `npm run lint` with no new errors.
- `node scripts/run-vite-build.mjs`.
- `tools/verify-frontend-runtime-sync.mjs` for the edited frontend files.
- Browser or equivalent live visual proof when `http://localhost:8080` is available; otherwise report that live proof is pending.

## Non-Goals

- Changing coaching calculations or recommendations.
- Adding new API requests.
- Redesigning Profile itself.
- Redesigning other Analysis detail routes.
- Introducing a new UI framework or shared component abstraction.
