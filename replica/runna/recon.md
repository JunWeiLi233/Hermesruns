> Current release: the user switched to a website integrated into Hermes. See [web-delivery.md](web-delivery.md) for implementation scope; mobile choices below remain proposals.

# Recon map: Runna core running-plan experience (iPhone and Android)

Scope: onboarding, plan creation, today's workout, and logging a run.
For: runners using a new mobile experience in the Hermes project. This audience is a working assumption; commercial positioning is undecided.
Date: 2026-10-13.
Status: research and proposed behavior only. No mobile implementation or Hermes feature audit was performed.

## Sources

Read selected public pages on the date above. These are individual documentation reads, not a crawl. Source IDs below refer to the linked pages, not to private APIs. Store listing text was reviewed; screenshot pixels, authenticated screens, and videos were not inspected. No reference images were saved. Future screenshots belong in `screens/` as references only.

| ID | Source | URL | Evidence used |
| --- | --- | --- | --- |
| R01 | Account setup | [Signing up and logging in](https://support.runna.com/en/articles/14033755-signing-up-or-logging-in-to-runna) | Account methods; mobile versus web capabilities |
| R02 | Plan creation | [Create a training plan](https://support.runna.com/en/articles/15443877-how-to-create-a-training-plan-in-runna) | Goal selection, preview, activation, generation errors |
| R03 | Fitness and progression | [Plans around current fitness](https://support.runna.com/en/articles/15231838-how-does-runna-build-your-training-plan-around-your-current-fitness) | Starting fitness inputs and high-level progression |
| R04 | Schedule | [Adjust running schedule](https://support.runna.com/en/articles/6206024-adjusting-your-running-schedule) | Available weekdays, frequency, long-run day |
| R05 | Preferences | [Training preferences](https://support.runna.com/en/articles/10393191-how-to-use-training-preferences) | Volume versus difficulty; plan-type exceptions |
| R06 | Navigation | [App navigation guide](https://support.runna.com/en/articles/10473504-your-quick-guide-to-navigating-the-runna-app) | Today and Plan surfaces |
| R07 | Activity logging | [Log, link, or manually add an activity](https://support.runna.com/en/articles/14666681-how-to-log-link-or-manually-add-an-activity) | Manual logging, linking, correcting, redo behavior |
| R08 | Recording feedback | [Audio cues](https://support.runna.com/en/articles/8159780-setting-up-and-managing-your-audio-cues) | Recording controls and pace/split announcements |
| R09 | Mileage versus pace | [Mileage calculation and adjustments](https://support.runna.com/en/articles/14666572-how-runna-calculates-your-mileage-and-how-to-adjust-it) | Recovery/taper weeks; race times affect pace |
| R10 | iOS listing | [Apple App Store](https://apps.apple.com/us/app/runna-running-plans-coach/id1594204443) | Phone/watch offering and in-app subscriptions |
| R11 | Android listing | [Google Play](https://play.google.com/store/apps/details?id=com.runbuddy.prod) | GPS recording and monthly/annual subscription offering |
| R12 | Usage terms | [Runna terms](https://www.runna.com/terms-and-conditions) | Personal-use, proprietary rights, automated collection restrictions |
| R13 | Plan lifecycle | [Current, upcoming, and draft plans](https://support.runna.com/en/articles/15586762-managing-your-current-upcoming-and-draft-plans) | Draft previews and plan management |
| R14 | Post-workout feedback | [Workout Insights](https://support.runna.com/en/articles/10494265-what-are-workout-insights) | Feedback versus actual plan adaptation |

Runna's terms sections 12 and 16 restrict business use of its services, copying/reverse engineering, automated data collection, and use of its trademarks/look. This is a research constraint, not a legal clearance for a future product. This recon uses public descriptions to propose independently authored behavior. Account-based competitive research would require a separate terms check. Use original branding, writing, workout content, and implementation. [R12](https://www.runna.com/terms-and-conditions)

## Core loop and release boundary

Choose a goal and describe current fitness and availability; preview and activate a schedule; open today's session; log an actual run and associate it with the session; see the updated history.

Proposed first release: adult recreational runners, 5K and 10K distance/race goals, one active plan, manual activity entry, and both mobile platforms. This narrowed goal catalogue is our product proposal. Keep the data model extensible to longer distances. A first prototype can use clearly labeled sample workouts; generating usable training prescriptions requires independently developed rules and coaching review.

Phone GPS recording is a second stage. Logging an already completed run satisfies the requested core loop without making recording a prerequisite. Subscriptions, watches, integrations, advanced adaptation, and social features are later decisions.

## Documented behavior versus proposed implementation

| Area | Publicly documented behavior | Proposal or unknown |
| --- | --- | --- |
| Account | Email/password, Apple, Google, and Strava signup are described; web cannot display or complete the plan. R01 | First release uses email plus account recovery; provider parity can follow. Session mechanics are unknown. |
| Setup | Goal, ability, mileage, frequency, preview, then activation. R02 | Our wizard groups these into S03-S08; actual question ordering and number of screens are unverified. |
| Fitness | Ability, weekly distance, longest recent run, and recent finish times inform race/distance plans. R03 | Formula coefficients, defaults, templates, and pace calibration are not public here. |
| Schedule | Availability, frequency, and long-run day can change across the plan; individual calendar moves are distinct. R04 | Our scheduler validates conflicts and preserves completed history. |
| Preferences | Volume and difficulty can be adjusted separately; changing these does not itself change pace targets. Some plan types lack these controls. R05 | Use our own setting names and coach-reviewed mappings. |
| Today | Daily workout/rest information and weekly mileage are surfaced. R06 | Our date boundary, empty/error presentation, and completion widgets require design. |
| Logging | Manual distance/time entry and linking to planned sessions are documented. R07 | Retry keys, validation limits, sync states, and exact completion threshold are our decisions. |
| Adaptation | Pace recommendations may be accepted; progression has limits. R03. Workout Insights do not change the plan. R14 | Do not assume every activity or rating automatically regenerates training. |

## Screens

These 18 IDs are a proposed screen decomposition, not a claim of 18 observed Runna screens. Routes are proposed internal mobile navigation names. “Documented” means text evidence; no live screen states were observed. Every screen also needs loading, accessible focus/reading order, large text, and recoverable errors in the new app.

| ID | Screen / proposed route | Purpose and key components | Evidence / documented state | Proposed states to implement |
| --- | --- | --- | --- | --- |
| S01 | Welcome / welcome | Entry choices and original product introduction | R01 signup/login entry | Fresh install; returning account; resume setup |
| S02 | Account / account | Identity form, submit, recovery link | R01 account methods | Invalid input; expired session; offline; recovery sent |
| S03 | Goal / setup/goal | Goal cards and distance picker | R02 goal catalogue | Selected; no selection; unsupported goal explanation |
| S04 | Dates / setup/dates | Start date and optional race date/name | R02 manual race details | Invalid date order; insufficient preparation window |
| S05 | Fitness / setup/fitness | Ability, weekly distance, longest run, optional race result, units | R03 fitness inputs | Missing race result; unit conversion; invalid duration |
| S06 | Availability / setup/schedule | Weekday chips, frequency, preferred long-run day | R04 schedule controls | Conflicting selections; no feasible schedule |
| S07 | Preferences / setup/preferences | Independent volume and difficulty selectors | R05 supported-plan settings | Defaults; modified; controls unavailable for plan type |
| S08 | Preview / setup/preview | Weekly outline, summary of inputs, edit and activate | R02 preview; R13 drafts | Generating; failed; retry; ready; activating |
| S09 | Today / today | Session/rest card and weekly totals | R06 daily view | No active plan; upcoming start; rest; due; completed; stale offline data |
| S10 | Plan calendar / plan | Week strip, session list, schedule navigation | R06 plan; R04 single-session moves | Current week; future; no sessions; reschedule pending |
| S11 | Workout / workout/:id | Objective, planned targets, step list, log/link actions | R06 planned details; R08 paced guidance | Planned; skipped; completed; effort-only target |
| S12 | Manual activity / activity/new | Date, distance, elapsed duration, optional notes | R07 manual entry | Validation; saving; retry; pending offline save |
| S13 | Link activity / workout/:id/link | Activity picker and association confirmation | R07 link/redo | No eligible activities; already linked; undo; stale selection |
| S14 | History / activities | Chronological run cards | R07 Progress activity list | Empty; filled; loading; failed; pending sync |
| S15 | Run summary / activity/:id | Actual distance/time/pace, linked session, edit/delete actions | R07 saved activity/correction | Manual; recorded; unlinked; deleted; confirmation |
| S16 | Manage plan / plan/manage | Edit setup inputs and review replacement schedule | R04/R05 changes; R13 lifecycle | Unsaved; regenerate pending; preview; conflict |
| S17 | Recording setup / record/setup | Outdoor mode, permissions, cue preferences | R11 GPS; R08 recording settings | Permission denied; weak fix; ready; manual fallback |
| S18 | Live run / record/live | Timer, distance, step progress, pause/resume/end | R08 controls and cues | Active; paused; signal lost; interrupted; unsaved finish |

S17-S18 are second-stage screens. S15's direct editing of manual entries is a proposed improvement; Runna documents replacement/manual correction rather than directly editing saved distance and time. Rest, error, and permission screens above are implementation requirements, not observed layouts.

## Flows

Tap counts are proposed minimum navigation actions, excluding typing, picker interactions, system dialogs, and optional detours. Runna's actual counts remain unmeasured.

| ID | Goal and proposed path | Proposed taps | Edges to preserve |
| --- | --- | --- | --- |
| F01 | First setup: S01 → S02 → S03 → S04 → S05 → S06 → S07 → S08 → S09 | 8 advances | Resume draft; unknown race time; impossible schedule; failed generation |
| F02 | Create replacement: S10 → S16 → S03 → S04 → S05 → S06 → S07 → S08 → S09 | 8 advances | Existing active plan; retain logged runs; failed activation leaves old plan usable |
| F03 | Read today's prescription: S09 → S11 | 1 | Rest day; no plan; plan starts later; day changes while app is open |
| F04 | Log from a session: S09 → S11 → S12 → S15 | 3 | Proposed automatic link when launched from workout; save retries must not duplicate |
| F05 | Add an extra run: S14 → S12 → S15 | 2 | Extra run remains unlinked; missing optional details; date/time-zone ambiguity |
| F06 | Link an existing run: S10 → S11 → S13 → S11 | 3 | Empty picker; reused activity; unlink; partial session; duplicate import later |
| F07 | Change recurring schedule: S10 → S16 → S06 → S08 → S10 | 4 | Infeasible availability; concurrent edits; completed workout history retained |
| F08 | Record with phone, stage two: S09 → S11 → S17 → S18 → S15 | 4 plus permission dialogs and run controls | Background interruption; poor GPS; pause; accidental finish; save offline |
| F09 | Inspect and correct a manual log: S14 → S15 → S12 → S15 | 3 | Our direct manual edit; linked totals update; recorded telemetry remains separate |

For F04, “logged activity” and “completed planned workout” are separate states. Explicitly confirm completion if the actual session is partial; do not treat pressing Save as proof of meeting every target. This is proposed behavior; the original threshold is unknown.

## Components

All designs and text are independently authored. Use shared tokens; support VoiceOver/TalkBack, dynamic text, non-color status indicators, and native date/time controls.

| Component | Variants | States | Used on |
| --- | --- | --- | --- |
| Action button | Primary, secondary, destructive | Enabled, busy, disabled, focused | All |
| Wizard header | Progress, back, resume | Complete/incomplete step | S03-S08 |
| Goal/ability option | Single-select card | Selected, unavailable | S03/S05 |
| Unit-aware numeric input | Distance, duration, race result | Empty, invalid, converted | S05/S12 |
| Calendar and weekday selector | Date, week, availability | Selected, unavailable, conflict | S04/S06/S10 |
| Preference selector | Volume, difficulty | Default, modified, unavailable | S07/S16 |
| Workout card and status badge | Easy, structured, long, rest | Due, skipped, completed | S08-S11 |
| Step list | Effort, pace, timed/distance repetition | Current, upcoming, completed | S11/S18 |
| Activity card/picker | Manual, recorded, imported later | Pending, linked, unlinked | S13-S15 |
| Feedback banner | Validation, offline, retry | Pending, dismissed, failed | All |
| Confirmation sheet | Activate, delete, unlink, finish | Review, committing, failed | S08/S13/S15/S18 |
| Recording control bar | Pause, resume, end | Active, paused, interrupted | S18 |

## Inferred data model

These are proposed entities and fields. Public UX evidence supports concepts, never proves Runna's tables, field names, or service architecture. All relationships, IDs, versions, and technical storage choices below are our design.

| Entity | Proposed fields | Evidence / confidence in concept |
| --- | --- | --- |
| User | id, identity_subject, email, created_at | R01; high |
| RunnerProfile | user_id, ability, weekly_distance_m, longest_run_m, recent_result_distance_m, recent_result_seconds, result_date, units, time_zone | R03/R09 fitness; medium for proposed grouping; units/time zone are our requirements |
| PlanGoal | id, user_id, kind, target_distance_m, start_date, end_date, event_name | R02; high |
| Availability | goal_id, weekdays, runs_per_week, long_run_weekday | R04; high |
| TrainingPreferences | goal_id, volume_choice, difficulty_choice, distance_caps | R05; high |
| TrainingPlan | id, user_id, goal_id, status, active_version_id | R02/R13 lifecycle; medium |
| PlanVersion | id, plan_id, input_snapshot, generator_version, generated_at, warnings | Our proposal for reproducibility; low as an inference about original |
| PlannedWorkout | id, plan_id, version_id, local_date, type, target_distance_m, target_duration_s, status, explanation | R06/R08 session concept; medium |
| WorkoutStep | id, workout_id, sequence, type, distance_m, duration_s, pace_low_s_per_km, pace_high_s_per_km, effort_text, repetitions | R08 structured guidance; medium; exact shape proposed |
| Activity | id, user_id, source, started_at, local_date, time_zone, distance_m, elapsed_s, notes, client_save_key | R07/R11 actual activity; high concept, technical fields proposed |
| WorkoutActivityLink | workout_id, activity_id, completion_decision, linked_at | R07 association; high concept; completion decision proposed |
| RecordingSession | id, user_id, workout_id_optional, state, accumulated_elapsed_s, last_checkpoint, samples_ref | R11 recording; medium concept; recovery storage proposed |

Relationships: User owns Profile, Goals, Plans, and Activities. A goal has Availability and Preferences. Plan has versions and scheduled workouts; Workout has ordered steps. Links join workouts and activities. RecordingSession can produce one Activity. Multi-activity linking is documented with caveats in R07; start with one link per activity in our release and retain an extensible association table. These are schema proposals for architecture review.

Proposed invariants: use meters and seconds internally; render user units. Store instants separately from the workout's local calendar date. Activate a generated version atomically. Preserve past activity facts during regeneration. Repeated save requests with one client key create one activity. Ownership checks apply to every lookup and link. Define how deletions and unlinking affect completion independently from run totals.

## Training engine boundary

Public evidence describes the shape: current fitness seeds training; weekly and long-run progression are constrained separately; recovery/taper weeks occur; race results influence pace; some pace changes require acceptance. [R03](https://support.runna.com/en/articles/15231838-how-does-runna-build-your-training-plan-around-your-current-fitness), [R09](https://support.runna.com/en/articles/14666572-how-runna-calculates-your-mileage-and-how-to-adjust-it)

Build our own generator interface: validated input snapshot → candidate weeks/workouts, explanations, and warnings. Separate schedule placement, distance progression, session structure, and pace calibration so their behavior can be reviewed individually. Numeric growth limits, deload cadence, taper rules, ability bands, and pace equations remain open decisions; no copied sample-plan catalogue or guessed universal percentage should be presented as Runna's algorithm.

Use synthetic fixtures for a prototype. Before generating real training, choose documented independent methods and have qualified coaching input review baseline assumptions and infeasible-goal handling. Useful verification cases include missing race results, zero baseline mileage, too few available days, a race before the start date, unit equivalence, regeneration with completed sessions, and repeated activity saves. User feedback should first be recorded; adaptation needs explicit rules and a preview.

## Feature matrix

See `features.csv`: 25 must, 11 should, 4 could, and 4 excluded rows (44 total). Each implementation status starts at `no`, including exclusions. `original=yes` means the behavior is documented; `unknown` means our proposal has no confirmed original equivalent. A row with `SKIP:` in notes is excluded from this scope even though its priority remains `could` to preserve the skill's CSV format. Exclusion rows are not part of parity scoring.

## Out of scope

- Exact Runna generator, private services, templates, assets, branding, and proprietary datasets.
- Human coaching service, community network, race-directory partnerships, and subscriber entitlement access.
- Medical/return-from-injury/postpartum programmes; strength/video libraries; all-goal catalogue parity.
- Store billing, subscriptions and exact paywall position. Public listings show paid tiers, but this recon does not establish current regional prices or the full free/paid boundary. R10/R11.
- Watch apps, Garmin/COROS/Strava integrations, treadmill hardware, advanced insights and weather adaptations in the first release.

## Evidence gaps and next step

No phone app was downloaded or exercised. Pixel layouts, Android/iOS differences, transition timing, prompt order, permission recovery, actual tap counts, and offline behavior remain unobserved. R02 documents generation/connectivity and sync issues, but not their UI treatment. R07 notes that a manual activity generally does not rebuild the plan. R14 explicitly distinguishes feedback from plan changes. Avoid claiming algorithm or visual parity.

Architecture should decide: a new mobile client versus an extension of Hermes; shared mobile stack; existing backend capabilities after a separate audit; independent generation method; account model; versioned activation; local cache/sync policy. Pass this scoped directory explicitly to `$replica-architect`: read `replica/runna/recon.md` and `replica/runna/features.csv`, and write `replica/runna/architecture.md`. Do not let the default `replica/recon.md` resolve to the existing Strava research.

## Size

18 proposed screens (16 core, 2 recording), 9 flows (8 core, 1 recording), 12 proposed entities (11 core plus RecordingSession).

Size M for the interface/manual-logging prototype with synthetic plans; L for usable independently generated plans and reliable recording on both platforms. These are scope classes, not delivery promises. The three hardest parts are coaching-rule validation, maintaining plan/activity consistency through edits and sync, and mobile background/GPS recovery. Full Runna parity would be XL and needs rescoping.
