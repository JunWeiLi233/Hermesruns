# Sprint Ticket — 2026-04-10

## Sprint Goal
Prepare the runner for their next race by displaying personalized preparation suggestions on the Profile page once a race is added to their calendar.

## Tasks

### Task 1 — Backend/Data Fetching
- **Files**: `frontend/src/pages/Profile.jsx`
- **Context**: Fetch race data on the Profile page to identify the next target race.
- **Done when**:
  - `apiJson('/api/races')` is added to the `loadProfile` or a separate `useEffect` in `Profile.jsx`.
  - The nearest upcoming race (non-canceled, future date) is identified and stored in state.
- **Verify**: Console log the identified next race.

### Task 2 — Race Prep UI Component
- **Files**: `frontend/src/pages/Profile.jsx`
- **Context**: Create a new section or card on the Profile page to show the countdown and training advice.
- **Done when**:
  - A new "Race Countdown" card appears when an upcoming race exists.
  - The card displays the race name, date, countdown days, and a preparation advice snippet (reusing or adapting logic from `Races.jsx`).
  - The UI uses the premium "Dark Mode (OLED)" tokens.
- **Verify**: Visually confirm the card appears correctly on mobile and desktop.

### Task 3 — Logic Adaptation & Localization
- **Files**: `frontend/src/pages/Profile.jsx`, `frontend/src/i18n/translations.js`
- **Context**: Ensure the advice logic is consistent with the Races page and fully localized.
- **Done when**:
  - Advice logic (Taper, Sharpen, Long Run, Specific, Base) is implemented in `Profile.jsx`.
  - All new labels are added to `translations.js`.
- **Verify**: `node .tools/check-translations.mjs`

## Runner Outcome
Runners feel coached and prepared every time they open Hermes, seeing exactly how many days are left and what to focus on for their next big event.

## Product Outcome
Higher retention and value perception by turning a static calendar into an active coaching tool.

## Surface Outcome
`Profile.jsx` gains a dynamic coaching module driven by the race calendar.
