# Hermesruns × Apple Health redesign brief (2026-09-04)

Research sources: Apple HIG principles (Clarity / Deference / Depth), SF Dynamic Type scale,
semantic system colors, Liquid Glass guidance (chrome only), Activity rings HIG, Apple Health
Summary reference screenshot, Health dashboard viz patterns (headline → compare → sparse chart).

## 1. Principles (must obey)

1. **Clarity** — One glance answers: what is the metric, what is the value, is it good?
2. **Deference** — Chrome (sidebar, topbar, tabs) recedes; content cards lead.
3. **Depth** — Soft layers only: canvas → white cards → sparse data marks. No heavy frames.
4. **Consistency** — Every overview card shares one anatomy. Learn once, scan everywhere.
5. **5-second glance** — Default view = headline + status + quiet pattern. Details on interact.

## 2. Visual tokens (web adaptation of Apple system roles)

| Role | Light approx | Use |
| --- | --- | --- |
| canvas | `#F2F2F7` + soft peach/blue top wash | Page background |
| surface | `#FFFFFF` | Cards |
| label | `#000000` / `#1C1C1E` | Primary text |
| secondaryLabel | `rgba(60,60,67,0.6)` | Timestamps, helpers |
| tertiaryLabel | `rgba(60,60,67,0.3)` | Captions |
| systemBlue | `#007AFF` | Links / Edit / primary interactive |
| category tints | coral / green / cyan / purple / orange | Card category icons+labels only |
| separator | `rgba(60,60,67,0.12)` | Hairlines inside cards if needed |

Typography (SF / system-ui):
- Page Large Title ≈ 34px bold, tracking tight
- Card category label ≈ 15–16px semibold, **tinted**
- Headline value ≈ 28–34px bold/black
- Body / compare ≈ 15–17px secondaryLabel
- Meta time ≈ 13–15px secondaryLabel

Layout:
- 8px rhythm; card gap ≈ 12–16px; page inset ≈ 16–20px (mobile) / larger desktop lane
- Card radius ≈ **20–28px** (Health Summary large continuous corners)
- Soft shadow, **no thick borders**
- Tap targets ≥ 44px
- Liquid Glass **only** on floating nav / sidebar chrome — never on data cards

## 3. Apple Health Summary card anatomy (canonical)

```
[ tinted icon ] Category label          Today / 9:41 AM  >
Headline value or short status
quiet graphic / rings / bars (optional, right or below)
compare line (optional, secondary)
```

Rules:
- Category color encodes meaning; do not rainbow-paint values.
- One primary headline per card.
- Charts are sparse: few labels, one accent, progressive disclosure.
- Stack cards vertically on phone; desktop may use calm grids but keep the same anatomy.

## 4. What was wrong in our previous pass

- Mixed brand-coral chrome with Health language → muddy identity.
- Hover “lift carnival” feels non-Apple (Apple prefers press/opacity, not floating cards).
- Card headers inconsistent (missing icon+tint+time+chevron grammar).
- Today grid wash fought Deference.
- Profile dark poster hero competed with content (anti-Deference).
- Charts/labels still denser than Health’s 5-second glance standard.

## 5. Hermes mapping (new round)

| Hermes surface | Health analogue | Focus |
| --- | --- | --- |
| Today Run | Summary pinned stack | Convert coaching tiles to Health card anatomy |
| Profile | Summary home | Light canvas; today session as white Health card |
| Analysis | Browse/detail cards | Headline metric + sparse chart; tinted kickers |
| Runs | History list under Summary | Quiet list rows; summary band as Health metrics |

Do **not** invent Sleep Score / Medications. Keep running metrics; change presentation only.

## 6. Acceptance

- Soft peach→blue→`#F2F2F7` canvas, no grid paper.
- Large Title pages; white continuous-corner cards; soft shadows.
- Every primary card: tinted category row + headline + optional sparse graphic.
- Chrome frosted; content opaque white.
- No decorative multi-color charts; color = category/status only.
- Screenshots after login on :8080 for Today / Profile / Analysis / Runs.
