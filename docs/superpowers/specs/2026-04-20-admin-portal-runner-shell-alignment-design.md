# Admin Portal Runner-Shell Alignment Design

## Goal

Redesign the full admin portal under `/dashboard/*` so it feels visually aligned with the broader Hermes runner-shell family across `/profile`, `/races`, `/weather`, and `/schedule`, while preserving the admin portal's real operator workflows, route structure, data wiring, and control density.

This is not a literal clone of any single runner page. It is a shared editorial translation:

- runner-side shell rhythm becomes operator-side shell rhythm
- runner-side cinematic hierarchy becomes operator-side task hierarchy
- runner-side tonal layering becomes operator-side workbench layering
- operator workflows remain first-class instead of being buried under decorative mimicry

## Surface

- Route family: `/dashboard`, `/dashboard/users`, `/dashboard/course-maps`, `/dashboard/shoes`, `/dashboard/jobs`, `/dashboard/audit`, `/dashboard/settings`
- Primary owner file: `frontend/src/pages/Dashboard.jsx`
- Shared styling owner: `frontend/src/styles/style.css`
- Shared copy owner: `frontend/src/i18n/translations.js`

## Reference Fit

The admin portal should inherit the user portal's cross-page design language, not just the `/profile` layout.

Reference characteristics pulled from the runner-shell family:

- persistent sidebar and topbar cadence
- cinematic hero followed by clear second-layer modules
- premium editorial hierarchy instead of equal-weight utility cards
- tonal separation and ambient depth instead of border-heavy containment
- bold Manrope-led headings with calmer metadata treatment
- route-specific visual identity inside one shared system

The admin portal should therefore feel like the operator twin of the user experience:

- same family
- different job

## Locked Design Decisions

### Round Type

- `structural-redesign`

### Target Mode

- `dual-mode`

The admin portal already supports multiple themes and the touched shell/styles are shared infrastructure, so the redesign must preserve coherent hierarchy in both dark and light modes.

### Chosen Direction

Use the approved `B` direction: `Shared Editorial Translation`.

Why:

- it best satisfies "align admin portal design with the user portal design"
- it preserves route-level operator usefulness better than a literal mimic
- it allows all admin routes to read as one system rather than seven unrelated redesigns

## Preserve List

- existing route-driven `/dashboard/*` structure
- admin auth gating and logout behavior
- all existing backend/API wiring
- all existing core admin actions, filters, tables, pagination, notes, bulk actions, upload flows, review flows, queue refreshes, and settings interactions
- current admin route taxonomy:
  - overview
  - users
  - course maps
  - shoes
  - jobs
  - audit
  - settings
- existing operator semantics and workflow outcomes

Do not change product behavior, routing, or backend contracts as part of the redesign unless required by the visual translation itself.

## Visual Goal

Turn the current admin portal from a collection of route-local redesigns into one coherent Hermes operator shell that clearly belongs to the same product as the runner experience.

The portal should feel:

- premium
- decisive
- breathable
- operationally trustworthy
- visually continuous with the user portal

It should not feel:

- like a pasted clone of `/profile`
- like seven independent mini-design systems
- like a generic SaaS admin wall

## System-Level Layout Plan

### 1. Shared Shell

Unify the admin shell around the runner-family reading pattern:

- stronger sidebar presence with the same family of spacing and tonal layering
- topbar that reads as calmer chrome rather than a separate control strip
- route hero area that anchors each page before utility controls begin
- consistent page-width, vertical rhythm, and card spacing across all routes

The shell should feel closer to the runner-side "cinematic editorial frame" while still reading as an operator workspace.

### 2. Shared Route Anatomy

Each admin route should follow one consistent hierarchy:

1. route hero
2. supporting metrics or summary rail
3. command/control band
4. primary workbench
5. secondary support modules

Not every route needs every layer at the same intensity, but the hierarchy should remain legible across all routes.

### 3. Shared Component Language

Across the portal, standardize:

- hero panels
- KPI cards
- command bars
- table wrappers
- workbench cards
- secondary side panels
- operator chips/badges

These should feel related to runner-side cards and strips without pretending operator tables are runner-facing storytelling modules.

## Route Plan

### Overview

Use Overview as the portal's strongest editorial opener.

- retain the current operational summary role
- make the hero feel like the admin equivalent of the runner dashboard opening fold
- keep queue, user, review, and audit signals visually staged as the admin "daily answers"
- preserve fast scanning over decorative excess

Overview should become the clearest expression of the shared operator shell.

### Users

Keep the previously approved "roster command center" direction, but align it more tightly to the runner-shell family.

- preserve the roster-story hero
- keep KPI band, command strip, bulk action band, and roster table
- make its shell, spacing, and tonal steps clearly part of the same family as Overview and the runner portal

Users should read like an operator analog to runner history/progression surfaces: dense, readable, and guided.

### Course Maps

Keep Course Maps as the most visual admin workbench.

- preserve the map lab / upload / review / publish workflow
- align its hero and workbench framing with the runner portal's stronger map- and race-adjacent surfaces
- preserve preview clarity, pending/live distinction, and action affordances

Course Maps should feel like the admin portal's closest cousin to `/races` and route-detail map surfaces.

### Shoes

Keep Shoes as a catalog-review and live-image workbench.

- preserve the current review-state distinctions
- preserve catalog and live/pending actions
- align the visual composition to the same family as Add Shoes and the broader runner-side footwear language

Shoes should feel like editorial product operations, not a plain inventory table.

### Jobs

Keep Jobs as a command deck / terminal-adjacent surface.

- preserve job queue filtering, selection, and detail reading
- maintain higher information density than the runner portal
- visually tie it back into the shared shell with consistent hero, card framing, and spacing

Jobs should be the "hardest" route visually, but still unmistakably part of Hermes.

### Audit

Keep Audit as the admin terminal / timeline surface.

- preserve the audit-terminal concept
- keep event scanning and trace reading easy
- align the page's surrounding shell and card family to the rest of the admin redesign

Audit should remain quieter and more forensic than other routes.

### Settings

Keep Settings as the calmest route in the system.

- preserve language/theme/session actions
- present them in a studio-like settings composition
- make the page feel related to runner-side settings and shell chrome rather than isolated utility cards

Settings should serve as the decompression page within the portal.

## Styling Direction

Use the Kinetic Editorial system from `design.md`, translated for operator work.

### Shared Rules

- no border-first containment
- strong tonal steps and layered surfaces
- clear first focus, second layer, and support layer
- expressive but restrained coral emphasis
- premium typography hierarchy

### Dark Mode

- keep nuanced charcoal surfaces, not pure black
- preserve terminal/workbench credibility
- use coral for emphasis and active guidance, not saturation

### Light Mode

- preserve the warm editorial gallery feeling
- avoid white-card-inside-white-card repetition
- keep operator content readable at higher density

## Copy Rules

Any changed user-facing admin copy must be updated in:

- `en`
- `zh-CN`

Do not leave new hardcoded UI strings in the redesign.

## Testing

At minimum, the redesign must preserve or update focused admin smoke coverage for:

- route shell behavior
- topbar/sidebar navigation
- overview surface
- users surface
- course maps surface
- shoes surface
- jobs surface
- audit surface
- settings surface

Required verification after implementation:

- targeted admin/dashboard smoke tests
- `cd frontend && npm run build`
- frontend runtime sync verification before claiming the live site changed

## Risks

- making the shell too similar to the runner portal and reducing operator scanning speed
- keeping too much route-local styling and ending with a half-unified portal
- improving the hero layers while leaving table/workbench surfaces visually disconnected
- introducing dark-mode-only or light-mode-only fixes in shared shell selectors

## Design Version

Because this is a meaningful user-facing redesign of the admin portal, append a new entry to `DESIGN_VERSIONS.md` after implementation and verification.
