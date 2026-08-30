# Add Shoes Step Cards Design

## Goal

Present the `/shoes/add` workflow as three distinct full-width cards stacked in order: brand selection, model confirmation, and shoe configuration.

## Current Structure

The Add Shoes page currently places steps 1 and 2 inside the shared `add-shoes-browser-panel add-shoes-stage` card. Step 3 is rendered separately inside the setup aside. This makes the workflow read as one large catalog card with a visually detached final step.

## Approved Design

- Keep the existing catalog stage heading as an unboxed introduction above the workflow.
- Render steps 1, 2, and 3 as sibling `add-shoes-step-card` sections in one vertical flow.
- Move step 3 out of the setup aside and place it after step 2.
- Remove the shared stage card's visible border, background, shadow, and card padding so it cannot visually contain the steps.
- Give each step consistent card padding, border, radius, shadow, and vertical spacing.
- Keep the existing brand deck, model filters/search, selected-model summary, form fields, submit behavior, navigation, localization, themes, and responsive inner grids unchanged.

## Responsive Behavior

The three cards remain full-width at every breakpoint. Existing responsive rules continue to control the contents of each card, including the brand deck, model grid, form grid, and mobile action buttons.

## Verification

- Extend the focused Add Shoes smoke coverage to assert that the JSX contains three independent step-card sections and no setup aside wrapper around step 3.
- Run the focused Add Shoes smoke tests.
- Run the frontend lint/build checks required by the Hermes workflow.
- Run the frontend runtime-sync proof when available; report it as unverified if the repository helper is absent.

## Preserve List

- Brand and model selection state and handlers.
- Catalog loading and fallback behavior.
- Search and category/type filtering.
- Configuration form validation and submit payload.
- Route navigation, auth behavior, localization, theme variants, accessibility, and mobile behavior.
