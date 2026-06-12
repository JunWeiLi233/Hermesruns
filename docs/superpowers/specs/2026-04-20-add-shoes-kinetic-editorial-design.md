# Add Shoes Kinetic Editorial Design

## Goal

Redesign `/shoes/add` into a darker kinetic-editorial “performance footwear” surface inspired by the supplied HERMES STITCH reference, while preserving the real Hermes add-shoe workflow, catalog wiring, auth behavior, and submit contract.

## Surface

- Route: `/shoes/add`
- Owner file: `frontend/src/pages/AddShoes.jsx`
- Shared styling: `frontend/src/styles/style.css`
- Shared copy: `frontend/src/i18n/translations.js`

## Reference Fit

The supplied reference is a dark, cinematic, editorial catalog with:

- oversized Manrope hero copy
- premium brand-card hierarchy
- strong asymmetry
- glassy top chrome
- large visual brand selection tiles
- obvious product taxonomy

Hermes should adapt that language to the real Add Shoes flow rather than cloning a literal brand-management dashboard.

## Locked Design Decisions

### Target Mode

- `dark`

The page should preserve safe structure for light mode, but the main redesign target is the supplied dark reference.

### Preserve List

- existing Hermes signed-in shell
- auth redirect behavior
- `/api/shoe-catalog` and `/api/shoes` fetches
- current three-step behavior:
  - brand selection
  - model selection
  - setup / submit
- current submit payload fields
- existing route navigation and cancel/back behavior
- existing i18n wiring

### Visual Goal

Turn the current utility-heavy add flow into a premium catalog stage:

- hero should feel like a performance-footwear editorial opener
- brand selection should become a visual “fleet roster” stage
- model picking should feel like a catalog board, not a plain list
- the final configuration form should read as a selected-shoe payload card

## Layout Plan

### Top Fold

Use a stronger split hero:

- left: oversized title, short setup narrative, brand/category/status pills
- right: compact status metric cards for active pairs, fleet distance, and rotation health

The hero should feel broader and more cinematic than the current balanced utility layout.

### Stage 1: Brand Deck

Replace the smaller brand chips/cards with a more editorial brand deck:

- larger cards
- stronger brand-logo stage
- visible model count
- active-state treatment with stronger coral signal

The active brand should feel like the selected runway, not a standard filter.

### Stage 2: Model Grid

Keep filters and search, but promote the model board into a higher-contrast catalog shelf:

- category/type controls stay
- model cards feel denser and more premium
- selected model should read clearly as “locked in”

### Stage 3: Setup Payload

The configuration step should become a final payload panel:

- selected pair summary at the top
- form below
- primary CTA reads like a launch action
- cancel remains present but visually secondary

## Styling Direction

Use the Kinetic Editorial system from `design.md`:

- dark charcoal base, not pure black
- coral emphasis only where hierarchy benefits
- no divider-line dependency
- layered tonal panels instead of flat card walls
- larger Manrope type with tighter tracking for hero headings

## Tests

Add a focused smoke test for Add Shoes that proves:

- the page exposes a dedicated editorial hero
- the page exposes a brand deck shell
- the page exposes a premium model board
- the page exposes a setup payload panel
- matching CSS classes exist

## Design Version

Because this is a meaningful user-facing redesign, append a new top entry to `DESIGN_VERSIONS.md` after implementation and verification.
