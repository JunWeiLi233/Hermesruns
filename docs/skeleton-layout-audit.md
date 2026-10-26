# Page skeleton layout audit

Compared the current route and data-loading fallbacks in `frontend/src/App.jsx`
and `components/PageSkeleton.jsx` with the page JSX and its final CSS cascade.
The current working-tree page designs are the reference.

| Route / variant | Loaded composition | Loading correction |
| --- | --- | --- |
| `/` | Full-width photo hero, overlaid nav, sync strip, five goals, feature pairs, app, promises, pricing, FAQ, CTA, footer | Replace floating shoe and three generic cards |
| `/login`, `/signup` | Split brand/form, 2/3 fields, submit, two providers, switch and legal links | Retain current account skeleton |
| `/forgot-password` | Split brand/form, one field, submit, return link, exterior footer | Retain current reset skeleton |
| `/terms` | Header, editorial intro, six numbered rows, footer | Add missing header/meta/footer and numbered rows |
| `/privacy` | Header, two-column intro, shield panel, four signals, eight numbered rows, footer | Use privacy-specific composition |
| `/profile` | Greeting/readiness, workout, three metrics, training pair, progression, digest, three lower cards, rewards | Retain existing matched composition |
| `/runs` | Heading/actions, five figures with weekly bars, compact toolbar, monthly activity ledger | Replace obsolete cockpit, six statistic cards and thumbnail grid |
| `/runs/:id` | Map and summary side by side, coach strip, telemetry, pace, effort/zones, intervals, condition comparison, splits with gear/effect/form rail | Replace obsolete overview-first stack; share route and initial data skeleton |
| `/analysis` | Intro, VO2 chart with prediction ladder, four checks, measured zones and pace reference | Replace full-width VO2, reference grid and obsolete tables |
| `/analysis/load-balance` | Verdict/window pair, timeline, four metrics, driver list | Replace previous profile layout |
| `/analysis/intensity` | Intro/stat hero, chart and two side cards, three sample cards | Retain matched composition |
| `/analysis/injury-risk` | Verdict/todo pair, three signals, chart and recent-run list | Replace previous cinematic layout |
| `/analysis/coach-insight` | Verdict/today pair, three signals, load/recent pair, phase/reasons pair | Replace previous long workbench |
| Other `/analysis/:key` | Intro, primary chart/reference pair, signals, summary cards | Match generic insight fallback |
| `/prediction/:distance` | Forecast and distance ladder, three levers, trend chart | Replace obsolete four metrics, weather and training grids |
| `/heatmap` | Map, topbar/search, four-band legend and quick/map controls | Retain map-specific skeleton |
| `/weather` | Hero/four metrics, hourly forecast, engine/coach pair | Retain matched composition |
| `/today-run` | Readiness gate beside session/three targets/phase bar/actions, three support cards | Move readiness into hero and match support count |
| `/rewards` | Season ring/copy/closest reward, five badge tracks | Retain matched composition |
| `/settings` | Identity/setup/seven-section index beside one selected settings group | Replace all-sections-at-once legacy layout; honor `section` query |
| `/settings/import-data` | Title/sync actions, source selector and dropzone, guide rail | Replace four provider cards |
| `/shoes` | Heading/actions and count summary, tabs/filters, rotation shelf | Remove obsolete summary tiles and match the rotation shelf |
| `/shoes/add` | Brand selection, model board, two-field configuration | Correct configuration field count |
| `/shoe-catalog` | Brand rail/model browser and three side cards | Retain matched composition |
| `/races` | Hero/next race pair, season calendar, PBs, discovery | Correct section order and add missing season layout |
| `/races/details/:id` | Summary/countdown card beside map, course metrics/elevation | Replace obsolete horizontal hero; use shared skeleton for data load too |
| `/schedule` | Plan hero, seven weekdays, readiness/next/route and coach/gear rails | Retain matched composition |
| `/muscle-training` | Week heading/seven days, exercise list and coverage/activity rail | Replace body selector/reference/library layout |
| Admin overview | Four metrics, four queues, three charts, paired lists, six actions | Retain matched composition |
| Admin users | Hero/story, four KPIs, filters/bulk actions/roster | Retain matched composition |
| Admin course maps | Hero, catalog rail and map review workspace | Retain matched composition |
| Admin shoes | Catalog browser/brand rail/model cards/published section | Retain catalog-first layout |
| Admin jobs | Hero, four metrics, spotlight, queue/detail pair | Retain matched composition |
| Admin audit | Hero, four metrics, toolbar/table/pagination, two CTAs | Retain matched composition |
| Admin settings | Hero/three stats, three preference cards | Retain matched composition |

Shared rules: loading placeholders remain inert and hidden from assistive
technology beneath one busy status; preserve reduced-motion support, theme
colors, the 96px collapsed desktop rail, 88px topbar, and mobile navigation.
Route-chunk and data-loading fallbacks must select the same composition.

Verification: 94 browser checks cover desktop/mobile compositions, all seven
admin destinations, all seven settings groups, both legal pages, representative
dark themes, inert placeholders, reduced motion, and visible headings. The 61
skeleton component tests and the loading, run-detail and race-detail contracts
pass. Production build, typecheck and lint pass (two existing i18n hook warnings).
The broader contract run also reported unrelated auth URL persistence,
landing translation usage, and Today Run dark-theme scoping failures.
