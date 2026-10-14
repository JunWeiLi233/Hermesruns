# Screen specifications

All layouts and copy are original proposals. S-IDs and F-IDs follow the recon. Six setup steps mean S03-S08; S01/S02 are identity entry before the wizard. Production text uses localization keys when implemented. Sample data is labeled until reviewed training rules exist.

## Layout and navigation

Scroll-safe single column, gutter20, max reading width560, native safe areas. Screen header has Back where appropriate and a full title. Primary action follows its inputs; a sticky footer, if added, respects keyboard and safe-area insets and never covers content. At large text, keep actions in the document flow. No fixed-height cards or truncated mandatory labels.

The production shell has Today, Plan, Runs tabs, with Account reachable by a labeled header action. S03-S08 hide tabs. Detail/edit screens return to their entry context; Cancel never discards without warning after changes. Shared query failures and pending actions follow C10/C11. Step numbers are illustrative until backed by the actual draft state.

## S01 Welcome — F01

Hierarchy: Hermes word label → “Make your next run clear.” → “Build a schedule around your goal and the days you can run.” → Set up my plan → Sign in. Resume setup appears only when an owner-safe local draft exists; no account name leaks before identity validation. Initial examples can show a neutral text-based session illustration; no Runna assets.

States: first launch; known draft with “Continue setup”; returning identity with Sign in; expired identity → S02. The app never shows private cached plan data merely because a previous user used this phone. Components C01/C10.

## S02 Account — F01

Modes: Create account, Sign in, Reset password, Check your email. Visible email/password labels, show/hide password with an explicit accessible name, password rules from existing backend, and submit below the form. Secondary “Forgot your password?” changes mode. Use password autofill attributes; never store the raw password in drafts.

Verification: “Open the link in your email, then return here to sign in.” Provide Resend email and Back to sign in. Recovery uses a generic sent message. If a captcha is required, offer the architected system-browser challenge. Explain session replacement before login in the prototype: “Signing in here may sign you out on your other device.”

States: empty, invalid field, submitting, email unverified, generic auth failure, recovery requested, network unavailable, rate limited. Error retains email and focuses its summary; do not reveal whether a recovery account exists. S03 follows only a valid runner session. C01/C04/C10.

## S03 Goal — F01/F02

Step 1: “What are you running toward?” Two goal modes: “Finish a distance” and “Prepare for a race.” Distance options 5K and 10K with plain captions. Selected option shows text plus outline. Continue disabled until both selections are valid. Other distances can be explained in static text, never look selectable.

States: no selection, selected, recovered draft, editing replacement. Back from a replacement returns to S16. C02/C03.

## S04 Dates — F01/F02

Step 2: “Choose your training window.” Native start/end date controls. Race mode adds optional event name and uses Race date as the end. Summary “Training starts [date] and ends [date].” The display is local calendar dates in the plan zone, not midnight UTC.

States: valid; end before start; over maximum duration; infeasible preparation according to generator. Keep selected dates, explain the offending field, and allow Adjust dates. Do not invent a minimum duration before independent coaching rules establish it. C02/C04/C05/C10.

## S05 Fitness — F01/F02

Step 3: “Start from where you are.” Ability choice, current weekly distance, longest recent run, optional recent distance/time/date. One visible units toggle updates displayed distances without erasing precision. “I don't have a recent result” clears the optional result group, not the baseline fitness fields. Describe effort-based fallback in preview when no reliable pace input exists.

States: no race result, all result fields present, incomplete result group, unit changed, invalid numeric entry, unfamiliar ability. Use zero baseline if accepted by reviewed rules; no fabricated estimated result. C02/C03/C04/C10.

## S06 Availability — F01/F02/F07

Step 4: “Make room for running.” Weekday checkboxes → requested runs/week → preferred long-run day selected from available days. Summary repeats the chosen full day names. If runs/week exceeds availability, explain “Choose more days or reduce your weekly runs.”

States: selected, insufficient days, long-run day removed, incompatible schedule, replacement candidate. Removing a chosen long-run day prompts a new choice and prevents continuing. The gallery's day picker demonstrates only selection, not all schedule fields. C02/C05/C10.

## S07 Preferences — F01/F02

Step 5: “Find a manageable rhythm.” Volume group: Lighter weeks / Steady weeks / Fuller weeks. Challenge group: Gentler sessions / Balanced sessions / Demanding sessions. State “Volume changes how much you run. Challenge changes session structure.” Show a short explanation under each choice. Advanced caps follow later, not unimplemented toggles.

States: defaults, modified, unsupported combination with field explanation, unavailable plan-type control. A unavailable setting has a reason and is absent from preview calculations. Never claim this selector independently changes pace. C02/C06/C10.

## S08 Preview — F01/F02/F07

Step 6: “See how your weeks fit.” Input summary with labeled Edit actions → weekly volume outline/table → first week's workout rows → warnings → Use this plan. Volume visualization needs a textual week-by-week alternative. Show exact selected dates, training zone, goal, and generator mode. DEMO banner: “Sample schedule. These sessions demonstrate the app and are not a reviewed training plan.”

Replacement confirmation names the existing plan, new start date, and retained run history. Candidate previews never alter Today until committed. A future-start activation explains “This becomes your selected plan now; sessions begin [date].”

States: generating, ready, failed/retry, saving, stale preview, replacing active plan, upcoming start. Stale case: “Your plan changed while you were reviewing. Refresh the preview.” Busy button keeps Use this plan plus progress indication. Generation failure retains all inputs. C02/C07/C10/C11.

## S09 Today — F03/F04/F08

Hierarchy: date and plan week → “Your run, at a glance.” → session card → Logged and Planned weekly totals → helpful next action. Keep week context concise and avoid a feed of unrelated cards. The Today gallery is a synthetic example of this hierarchy.

| Server state | Content / main action |
| --- | --- |
| NO_PLAN | “Give your week a shape.” / Set up a plan |
| UPCOMING | Start date and selected goal / View plan |
| REST | “Room to recover.” No run target / See this week |
| DUE | Objective and targets / View session |
| PARTIAL | Logged facts and partial label / Review session |
| COMPLETED | “Session logged.” Actual versus planned facts / View run |
| SKIPPED | Skipped date, no fake activity / View plan |
| FINISHED_PLAN | Plan date range and actual history / Choose a new goal |

Offline/cached state shows last refresh date and explicit age. A failed initial fetch shows Retry; cached reads depend on later implementation. Planned totals do not become logged totals when a workout is marked complete without an activity. C07/C09/C10/C13.

## S10 Plan calendar — F02/F06/F07

Hierarchy: goal/date-range header → current week and Previous/Next controls → one full-date workout row per day → Manage plan. Rows show run type, targets, and state; rest is text rather than a zero-distance workout. Display an archived plan header when viewing history.

Move session is an explicit row/detail action that opens a date picker and confirmation; drag is an optional later enhancement. Occupied dates, out-of-bounds dates, and protected past/linked sessions show a clear conflict and never silently swap. No calendar full of tiny tappable dots.

States: current/future/archived, empty week, pending move, conflict, loading and stale cache. C05/C07/C10/C11/C13.

## S11 Workout detail — F03/F04/F06

Hierarchy: date/state → title → objective → target metrics → ordered steps → Log this run → Link an existing run / Skip session as secondary actions. Effort-only sessions say what effort means and omit pace numbers. Completed view shows linked run facts and View run; unlogged completion explicitly says “Marked complete · no run linked.”

States: planned, partial, completed, skipped, retired/removed session, stale revision. Log/link lets the runner choose Finished the session or Ran part of it. Skip/reopen is deliberate; save alone never implies completion. C01/C07/C08/C10/C11.

## S12 Manual activity — F04/F05

“Save what you ran.” Fields: local date, local time, captured IANA zone, distance/unit, elapsed duration, optional notes. Session context is visible if launched from S11. If linked, completion choice is explicit before saving. “Elapsed time includes pauses.” A standalone extra run says “This won't be linked to a planned session.”

Native time picker input resolves to an instant. DST repeated time offers both offsets with clear local labels; nonexistent time asks for a valid time. Numeric duration entry should split hours/minutes/seconds for the full app; the gallery's mm:ss example is only a compact primitive demonstration.

States: valid, invalid, ambiguous time, saving, saved locally, synced, expired session, stale session association. Saving offline says “Stored on this phone” and offers Review, without declaring server success or confirmed completion. Reconnect reuses the outbox key. C04/C05/C09/C10/C11.

## S13 Link activity — F06

Header repeats scheduled workout and date. Select one eligible MANUAL/PHONE run; row shows full date, distance, time, provenance, and current link state. Then completion choice and Link run. Selection is local until confirmation succeeds.

States: no eligible run → Add a run first; selected; already linked → reason; partial/complete; conflict → refresh; busy; undo. Do not offer unknown imported/provider items before their normalized adapter exists. Unlink confirmation says “The run stays in your history. Its session association will be removed.” C03/C09/C10/C11.

## S14 History — F05/F09

Header “Your runs” and Add run action → chronological date sections → activity cards. Keep a text label for manual provenance and Waiting to sync. Cursor pagination appends without resetting focus/scroll. Count extra runs once.

States: empty → “Your history starts with one run.” / Log your first run; filled; pending local item; loading more; retry; expired session. Initial scope includes only app-created MANUAL/PHONE entries, disclosed if the user also imports activities in Hermes web. C01/C09/C10/C13.

## S15 Run summary — F04/F05/F09

Header date/provenance/sync status → actual distance, elapsed time and average pace → session association (or Unlinked) → notes → Edit manual entry and Delete. Show captured time zone, and distinguish declared manual facts from measured phone facts. No route map if only summary data exists.

States: manual editable; phone read-only metrics; local pending; linked/unlinked; correction conflict; deleted. Manual correction uses S12 and saves conditionally; cancel retains original. Deletion confirmation: “Delete this run? Its logged distance will be removed. The linked session may return to planned.” Phone correction creates a new manual entry with a review of old association, never rewrites measured telemetry.

Components C04/C07/C09/C10/C11. Completed status follows explicit association decision rather than arbitrary distance thresholds.

## S16 Manage plan — F02/F07

Header active/draft/archived state → goal/date summary → rows for Fitness, Running days, Volume, Session challenge → Review changes. Active settings edits create a candidate; “Your current sessions stay in place until you use the updated plan.” Completed and linked history is visibly retained in preview.

Create new plan and Archive plan are separate actions. Archived plans remain readable. Unsaved changes prompt Keep editing / Discard changes. Stale revision requests fresh data. Goal changes beyond the supported plan distance create a new draft rather than rewriting the historical goal.

States: unchanged, modified, generating, preview-ready, failed, conflict, archived. C04/C05/C06/C10/C11.

## S17 Recording setup — stage two, F08

Session/Free run context → Outdoor recording → location permission explanation → GPS quality → audio preference → Start run. Request native permission after the user's explicit action. Denied permission provides Open settings and Log manually. Weak GPS offers waiting or a visibly qualified recording; never show a precise distance without measurement.

C01/C08/C10. No watch pairing, treadmill modes, private provider connections or fake permissions in the first stage.

## S18 Live run — stage two, F08

Large elapsed/active time and distance with units → current step/effort → Pause/Resume → Finish. Use at least 64-unit action heights; landscape and large text can scroll while keeping controls reachable. Clear PAUSED / Signal interrupted text; confirmation before final save.

On termination recover local checkpoints, disclose gaps, and offer Save partial run / Discard. Finishing offline stores a pending summary; it does not show Synced. Timers do not constantly interrupt assistive speech. Phone recording and background behavior remain unbuilt; only the control primitive is demonstrated. C08/C10/C11/C12.

## Localization and content handoff

English examples are fresh authored copy. The eventual mobile app needs localized strings in its own feature files and consistent handling of variable length, units, full dates, time zones and pluralization. Translate before claiming locale support. Do not import unrelated web stylesheet or labels directly. No actual coach promises, race predictions, partner offers, subscription gates or medical programmes are added by these designs.
