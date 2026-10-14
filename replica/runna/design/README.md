> Current delivery is the Hermes website: [web-delivery.md](../web-delivery.md). This native gallery remains a design reference.

# Hermes mobile design system

Date: 2026-10-13. Inputs: `../recon.md`, `../architecture.md`, `../features.csv`.

This is an original light-theme proposal for the Expo/React Native client. No Runna screenshot pixels were available or measured, so color, spacing, typography, layouts, and wording below are authored choices. Documented behaviors come from the recon; visual parity is unverified. The neutral dark accent is a placeholder role for a later original brand palette.

## Deliverables

| File | Purpose |
| --- | --- |
| `tokens.json` | Single source for roles, type, spacing, geometry, motion, and contrast pairs |
| `tokens.ts` | Generated native values used by primitives |
| `tokens.css` | Generated web custom properties |
| `tailwind.config.cjs` / `tailwind.theme.css` | Optional Tailwind 3/4 web adapters; native app does not use Tailwind |
| `components.md` | Component behavior, states, native accessibility and usage |
| `screens.md` | S01-S16 build-ready hierarchy/copy/actions; S17-S18 later-stage notes |
| `playground/primitives.tsx` | Working React Native primitives, without backend calls |
| `playground/Gallery.tsx` | Interactive isolation gallery: Today, Setup, manual log, and component states |
| Contrast check | 43 pairs passed previously; raw outputs were not retained |
| `validation.md` | Checks actually performed and remaining native verification |

## Design decisions

The visual hierarchy is date/context, session title, targets, and one next action. Planned and logged totals are separate, and a saved activity is distinct from a completed workout. Use three production bottom tabs: **Today**, **Plan**, **Runs**. Account/settings open from an explicitly labeled header action. The gallery's four demo tabs are only a way to inspect components.

Use platform system fonts without shipping font files. Body text starts at 16 logical units, helper text at 14. Labels wrap; controls use minimum heights rather than fixed text boxes. Preserve native font scaling without a global cap. Tabular numeric figures are used for metrics only. No borrowed icons, illustrations, sounds, photos, or logos are included. A future icon choice should use an approved open set and retain textual names.

Use a 4-unit base with 20-unit screen gutters and a centered 560-unit maximum reading width. Controls have at least 48-unit targets; bottom tabs at least 56. Large text turns side-by-side targets into vertical groups. Pages scroll above the keyboard; safe areas and keyboard insets are owned by the eventual Expo shell. Do not bake a fake status bar or device bezel into the app.

The gallery has a second column above its 840-unit breakpoint; it is presentation chrome, not tablet app navigation. Core production layouts remain one column in this first mobile scope. Background/surface/border are neutral; states include text and a symbol or explicit label rather than color alone. The subtle `border` role is decorative. Inputs and actionable outlines use the contrasting `border-input` role.

Do not animate critical information. Motion tokens are available for short nonessential transitions; reduced motion sets these to zero. The current gallery uses no animated transitions, including its confirmation sheet. Reserve content space for loading, maintain visible labels, and announce results once rather than each elapsed second. [React Native accessibility](https://reactnative.dev/docs/accessibility)

## Run the gallery

From this directory, regenerate adapters with Python, then use the isolated playground package:

```powershell
python .\generate-tokens.py
cd .\playground
npm ci --ignore-scripts
npm run typecheck
npm run build
npm start
```

The default preview is `http://127.0.0.1:4317`. Override with `RUNNA_DESIGN_PORT` if that port is occupied. This server only serves the gallery's static build; it neither connects to Hermes nor stores real runner information. Native primitives are rendered through React Native Web for this visual check. Gallery versions are locked for reproducibility; when integrating into `mobile/`, match the chosen Expo SDK's supported React/React Native versions.

After editing tokens, regenerate every adapter and run the installed skill checker:

```powershell
python C:\Users\Junwei\.codex\skills\replica-design\contrast.py .\tokens.json
```

All body text pairs use a 4.5:1 floor; input and focus boundaries use 3:1. Contrast checking is one accessibility check, not a full compliance claim. The gallery does not verify native VoiceOver/TalkBack, OS permission prompts, signing, or background recording. [Contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

## Integration handoff

Use `$replica-build` with this directory plus `replica/runna/recon.md` and `replica/runna/architecture.md`. Move/adapt primitives into the mobile app's shared UI after the Expo scaffold exists, retaining roles and behavior. Replace gallery callbacks with the architected API/outbox operations. Keep `features.csv` implementation statuses `no` until the actual end-to-end feature is delivered. This design stage creates no mobile account flow, training generator, or deployed backend.
