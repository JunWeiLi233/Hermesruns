# Native component specifications

Values reference `tokens.json`; minimum dimensions are logical units, not screenshot measurements. Implementations live in `playground/primitives.tsx` and are demonstrated by the web gallery. Native platform behavior still requires device testing. All wording below is original.

## Shared behavior

Every press target: `layout.controlMin` minimum, visible label, correct native role and state, press feedback, focus treatment, and no destructive action hidden behind a swipe. Touch focus and accessibility focus are not the same. Preserve reading order; avoid marking an entire panel accessible when it contains independently actionable children. Expose errors and result changes once. Native screen wrappers add safe-area/keyboard handling during app implementation.

Native button implementations use Pressable; form fields use TextInput; sheets use Modal; long collections will use FlatList rather than unbounded nested scrolling. Use `accessibilityLabel`, `accessibilityState`, and explicit focus handling as appropriate. Web equivalents use semantic roles through React Native Web; do not embed HTML-only widgets in native components. [React Native accessibility](https://reactnative.dev/docs/accessibility), [Pressable](https://reactnative.dev/docs/pressable)

### C01 ActionButton

- Variants: primary, secondary, ghost, destructive; one full-width primary action per decision region.
- Size: minimum 48, horizontal space16, vertical space12, radius md, label 16/24 semibold. Text can wrap and increase height.
- Tokens: accent/on-accent, accent-pressed for primary press; surface/text/border-input secondary; danger/on-accent destructive; disabled/on-disabled for unavailable.
- States: idle, pressed, keyboard focus, disabled, busy. Busy keeps its original label plus an indicator and blocks duplicate actions; disabled explains the reason nearby.
- Accessibility: role button; busy/disabled state; 3-unit focus boundary. Never use reduced opacity to make text unreadable.
- Used on: S01-S18. Gallery: Continue, Unavailable, Saving run, and confirmations.

### C02 WizardHeader

- Step count, Back action, page title, narrow progress bar; S03-S08 have six steps.
- Tokens: title type, caption context, text/text-muted, accent progress, surface-subtle track.
- States: initial, resumed, edited, final review. Back retains inputs; error never advances the count.
- Accessibility: header role and progress value; title receives accessibility focus after route changes through the screen shell.
- Used on: S03-S08. The gallery demonstrates step four; its Back returns to the demo's Today tab.

### C03 ChoiceCard (goal/ability)

- Single-select card with title, explanatory text, and a textual Selected marker. Whole card is one action; no nested button.
- Tokens: surface versus selected, border-input versus accent, label/body. Radius md, padding16, no fixed description height.
- States: unselected, selected, pressed, focused, disabled/unavailable. A unavailable option includes a reason.
- Accessibility: radio/checked inside a named group; keyboard traversal must reach every option. Native selection is announced.
- Used on: S03/S05; also C06. Goal cards only offer supported 5K/10K in the first release; no fake unlocked catalogue.

### C04 LabeledField (unit-aware inputs)

- Label above value, visible unit in the label, helper/error below. Native date/time pickers are composed beside this field in the production screen.
- Tokens: fieldMin52, radius md, border-input, focus, danger; body input, caption helper. No placeholder-only label.
- States: empty, filled, focus, invalid, disabled, saving. Validate on blur/submit; preserve the user's raw text during editing.
- Accessibility: label and hint; polite field error; screen-level submission error also focuses the first bad field. Numeric keyboard is a convenience, not validation.
- Used on: S02/S04/S05/S12/S15. Distance stored in meters; separate seconds fields for durations where needed; unit switching converts once and never rounds stored values repeatedly.
- Example: “Distance (km)”; error “Enter a distance greater than zero.”

### C05 Calendar / WeekdayPicker

- Weekday choices wrap into a 48-unit-minimum grid. Announce full weekday names; visual labels may abbreviate. Select available days before choosing frequency/long-run day.
- Tokens: accent/on-accent checked, surface/text unchecked, selected press background, border-input boundary.
- States: selected, unavailable, focused, conflict, busy. A date is never selectable solely by swiping; provide Previous/Next week and date selection alternatives.
- Accessibility: weekday checkboxes and checked state; native date picker rather than tiny custom calendar cells for S04/S12. Calendar screen rows also repeat full dates.
- Used on: S04/S06/S10/S12. `WeekdayPicker` primitive is built; native date/time picker integration and production calendar remain build-stage work.

### C06 PreferenceSelector

- Two named radio groups: weekly volume and session challenge. Each option has a plain description; no unexplained “AI intensity” slider.
- Tokens: C03 cards; heading20 group labels and body16 descriptions.
- States: default, modified, focused, incompatible, unavailable. Start with “Steady weeks” and “Balanced sessions” as proposed defaults; the future independent generator must implement their effects.
- Accessibility: named group, selected radio, description. Lower volume does not imply slower pace; tell users which targets will change in preview.
- Used on: S07/S16. Gallery example changes only local selection, not a plan.

### C07 WorkoutCard / StatusBadge / Metric

- Content: date/context → session type → objective → distance/time or effort → one View session action. Rest cards have no run target.
- Tokens: surface/text, title28, heading20 metrics, text-muted labels, radius lg, padding20. Labels wrap; metric groups stack at large text.
- States: scheduled, due, partial, completed, skipped, rest, upcoming, no plan, failed load. Status badge always includes text.
- Accessibility: targets read with units; approximate duration is announced as approximate. Never show zero distance as a rest-day run. Static card text and nested button are separate reading targets.
- Used on: S08-S11. Weekly planned distance and actual logged distance are separate metrics; no inferred completion percentage.

### C08 StepList

- Ordered rows with numbered mark, instruction, target (distance OR duration), and effort or pace range. Repeat blocks are explicit, e.g. “Repeat 4 times,” rather than nested hidden steps.
- Tokens: mark32, selected current row, surface other rows, heading/body/caption, decorative separators.
- States: upcoming, current, completed, interrupted, effort-only. Do not infer measured completion in a preview.
- Accessibility: natural ordered reading sequence; announce current step on change, not every GPS tick. Avoid timer announcements interrupting instructions.
- Used on: S11/S18. Gallery steps are synthetic examples and are not a reviewed prescription.

### C09 ActivityCard / Picker

- Title/date, distance and duration, provenance, and sync/link labels. Entire row is one press target. Picker variant exposes selected state and a separate final Link run action.
- Tokens: surface/selected, text/text-muted, status palette, radius md, padding16.
- States: manual, phone, linked/unlinked, pending, selected, failed save, deleted. Imported providers are deferred until a normalized read adapter exists.
- Accessibility: one concise label with run facts; distinguish selection from confirmed linking. Text says “Waiting to sync,” not a green success indicator.
- Used on: S13-S15. Never turn partial completion into complete merely because a log exists.

### C10 FeedbackBanner

- Title, short explanation, optional labeled recovery action; inline near the affected region. Initial error must not replace a useful cached plan.
- Tokens: info/info-bg, warning/warning-bg, success/success-bg, danger/danger-bg; text body and label title.
- States: informational, validating, retrying, saved locally, synced, conflict, expired session. No timed dismissal of important errors.
- Accessibility: polite live result or deliberately urgent error; no announcement loop. Native iOS announcements require the screen's change handler during integration; Android live-region props alone are insufficient to prove iOS behavior.
- Used on: all. Example: “Stored on this phone. We'll send it when you're connected.” Session expiry offers Sign in; stale preview offers Refresh preview.

### C11 ConfirmationSheet

- Heading, consequence, primary confirmation, cancel. Activation shows replacement plan/date effects. Destruction names the affected run.
- Tokens: surface sheet, bg backdrop, border-input, radius lg, width max560. Current isolated primitive uses an opaque neutral backdrop and no animation.
- States: review, submitting, success/close, failed (stay open). Back/Escape cancel when idle; avoid dismissing during a commit.
- Accessibility: native Modal with modal view; focus on opening, contain focus while open, restore initiating control on close. Destructive confirmation must first focus explanation/cancel, never a preselected destructive button. Native and web focus need separate verification.
- Used on: S08/S13/S15/S18. Built generic primitive; production screens supply the consequence/cancel label, API errors, and initiating-control ref.

### C12 RecordingControls

- Large Pause/Resume and explicit Finish action; final finish opens C11. Controls sit above native bottom insets.
- Tokens: minimum record action64 during production recording; neutral primary/secondary colors avoid implying recording status with color alone.
- States: running, paused, interrupted, finishing, offline save. Timer stops accumulating elapsed running time while paused according to the agreed recording model; distinguish total elapsed versus active time in summary.
- Accessibility: action text changes from Pause to Resume; no gesture-only finish; announce signal/interruption once. Touch and screen-reader actions remain available with locked orientation.
- Used on: S18, later stage. Gallery implements pause-label toggle and confirmation only; native recording and the production 64-unit sizing are deferred.

### C13 TabBar

- Production: Today, Plan, Runs with equal flexible targets and readable labels. Gallery: four inspection tabs with wrapping when needed.
- Tokens: tabMin56, surface/text, selected background, radius md for gallery only; production safe-area shell owns placement.
- States: selected/unselected, keyboard focus, loading destination. Preserve each tab's scroll position; route title changes are announced.
- Accessibility: tab/selected state; active label remains visible. Do not hide text behind icons at small widths.
- Used on: S09/S10/S14. No bottom tabs during onboarding, modal completion, or active recording.

## Skeleton, loading and empty states

Initial loads reserve the eventual content shape and show a short status (“Getting your session”). A skeleton is decorative, never individually announced or focusable. Use a static surface-subtle fill with radius sm, not a flashing shimmer. After a failed initial load show title, explanation and Retry. Later refetches keep the last successful content with its age and never imply freshness.

Empty history offers “Log your first run.” No plan offers “Set up a plan.” Empty link picker offers “Add a run first.” Busy actions retain input, label, and layout. These compositions are specified for the build stage rather than claimed as working API states in the gallery.
