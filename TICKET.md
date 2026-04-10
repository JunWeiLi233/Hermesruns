# Sprint Ticket — 2026-04-10

## Sprint Goal
Upgrade the Hermes landing page to a premium, high-tech athletic aesthetic with design tokens, SVG icons, and smooth interactions.

## Tasks

### Task 1 — Design System & Tokens
- **Files**: `frontend/src/index.css`
- **Context**: Establish the "Dark Mode (OLED)" palette as the foundation.
- **Done when**:
  - CSS variables for `--color-primary` (#EA580C), `--color-background` (#0F172A), `--color-accent` (#059669), and `--color-border` (rgba(255,255,255,0.08)) are added.
  - Global font set to 'Inter'.
- **Verify**: Inspect root CSS variables.

### Task 2 — Landing Page UI Overhaul
- **Files**: `frontend/src/pages/Landing.jsx`
- **Context**: Replace emojis with Lucide icons (or similar SVG paths) and apply the new design tokens.
- **Done when**:
  - Emojis in `features` array are replaced with Lucide-style SVG icons (Activity, Target, Map, Trophy, Footprints, TrendingUp).
  - Feature cards use the new `--color-muted` and `--color-border`.
  - Hero section uses `--color-primary` for accent text.
  - All buttons use tokenized colors and have 150-300ms transitions.
- **Verify**: `cd frontend && npm run lint`

### Task 3 — Visual Audit & Responsive Check
- **Files**: `frontend/src/pages/Landing.jsx`
- **Context**: Ensure the premium feel across all devices.
- **Done when**:
  - Layout verified at 390px, 768px, and 1440px.
  - All clickable elements have `cursor-pointer`.
  - No emojis remain in structural UI.
- **Verify**: Visual check + `cd frontend && node ../node_modules/.bin/eslint src/pages/Landing.jsx --max-warnings 0`

## Runner Outcome
A more trustworthy and professional landing page that clearly communicates Hermes's coach-like intelligence.

## Product Outcome
Higher conversion from skeptical Strava users by projecting a "Pro" analytics vibe.

## Surface Outcome
`frontend/src/pages/Landing.jsx` transformed from generic to premium athletic tech.
