# Hermes Domain Glossary

This file is the glossary for the Hermes domain model. It defines the
ubiquitous language used across code, docs, and conversations. It contains
**only** terminology — no implementation details, specs, or decisions (those
live in ADRs or code comments).

## Strength Training

### Today's Strength Focus

The **recommended** `StrengthFocus` for the current day — the muscle-training
area the coach believes the runner should train today, derived from their
running load, recovery state, soreness, and schedule. It is a *suggestion*,
not an imposition: the runner sees it as the default selection on the
muscle-training page and may override it.

Distinct from:
- **Manual Muscle Pick** — the 6 anatomical chips (chest/back/legs/shoulders/
  arms/core) the runner can click to browse exercises. Today's Strength Focus
  is *purpose-oriented* (recovery, load, stability), not anatomical; it maps
  to one or more anatomy chips as a derived view.
- **Session Type** — the coach's day-level plan (Foundation Strength /
  Resilience Capacity / Optional Elasticity). Today's Strength Focus
  *consumes* the session type as an input and translates it into a muscle
  area; it never competes with the session plan.
- **Check-in Strength Focus** — the value persisted in the daily check-in.
  It starts pre-filled with Today's Strength Focus (via `COACH_PICK`) but is
  only committed when the runner taps save.

### StrengthFocus (enum)

The purpose-oriented vocabulary for muscle-training recommendations and
check-ins:

| Value | Meaning | Example trigger |
|---|---|---|
| `COACH_PICK` | "Use the recommended focus" — the pre-fill sentinel | default check-in state |
| `LEG_DAY` | Compound leg strength (squats, RDLs) | steady load, no flags |
| `POSTERIOR_CHAIN` | Glutes + hamstrings (deceleration support) | recent hard run |
| `CALVES_ANKLES` | Lower-leg resilience (calf raises, tibialis) | high volume or recovery gate |
| `CORE_STABILITY` | Trunk anti-rotation / anti-extension | recovery capacity session |
| `MOBILITY_RESET` | Hip/ankle mobility, activation | protect gate, race week |

### StrengthDose (enum)

The intensity/volume modifier for a strength session:

| Value | Meaning |
|---|---|
| `MICRO` | Reduced dose (1–2 sets) — recovery or time-constrained |
| `STANDARD` | Normal dose (3 sets) — the default |
| `STRONG` | Full dose (4+ sets) — fresh, high-capacity day |

### Recovery Gate

The coach's assessment of the runner's current recovery state, derived from
sleep, HRV, RHR, and stress. Values: `OPEN` (ready), `CAUTION` (proceed with
care), `PROTECT` (prioritize recovery). Computed in
`MuscleTrainingMetricsService.deriveRecoveryGate`.

### Load Status

The coach's assessment of the runner's current training-load context, derived
from ACWR, weekly volume, and HR-zone distribution. Values: `STEADY`,
`HIGH_VOLUME`, `RACE_WEEK`, `LOW_VOLUME`. Computed in
`MuscleTrainingMetricsService.deriveLoadStatus`.
