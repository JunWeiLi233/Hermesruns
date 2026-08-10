# Full-marathon source audit - 2026-08-07

## Scope

- `frontend/src/data/worldRaceCatalog.json` currently contains 79 marathon-labeled rows.
- Distance-based filtering excludes `delhi-half-marathon`, `gyeongju-marathon`, and the
  89 km `comrades-marathon`, while including `rio-marathon` (`Maratona do Rio`). The
  full-marathon audit scope is therefore 77 rows.
- The 2026-08-03 route-audit note is stale in two ways:
  - the catalog is larger than 77 rows
  - Osaka is no longer a synthetic or shortened outlier; it now has an official course class

## Current coverage

The exact per-race official URLs are stored with the checked course definitions
in `backend/src/main/java/com/hermes/backend/*Course.java`,
`MarathonOfficialLandmarkCourseCatalog.java`, and
`SupplementalMarathonKnownCourses.java`, and the organizer links are mirrored
in `docs/course-maps/official-sources.md`.

| Bucket | Race IDs | Evidence status | Notes |
| --- | --- | --- | --- |
| Official-course classes | `tokyo-marathon`, `osaka-marathon`, `boston-marathon`, `chicago-marathon`, `new-york-city-marathon`, `london-marathon`, `berlin-marathon`, `bergen-city-marathon`, `wuxi-marathon`, `athens-marathon`, `los-angeles-marathon`, `amsterdam-marathon` | Direct official course page, PDF, GPX, or organizer-aligned deterministic geometry in the course class | These are the strongest rows in the catalog. |
| Official landmark corridors | `big-sur-marathon`, `honolulu-marathon`, `bangkok-marathon`, `buenos-aires-marathon`, `brussels-airport-marathon`, `rio-marathon`, `beijing-marathon`, `hong-kong-marathon`, `auckland-marathon`, `cape-town-marathon`, `fukuoka-marathon`, `ho-chi-minh-city-marathon` | Organizer route page, course map page, or first-party PDF with ordered landmarks | These routes pass both their organizer-corridor reconstruction and marathon-distance gates. |
| Checked ordered routes | `manchester-marathon`, `munich-marathon`, `paris-marathon`, `nice-cannes-marathon`, `rotterdam-marathon`, `rome-marathon`, `milan-marathon`, `valencia-marathon`, `lisbon-marathon`, `porto-marathon`, `melbourne-marathon`, `gold-coast-marathon`, `queenstown-marathon`, `shanghai-marathon`, `xiamen-marathon`, `nairobi-city-marathon`, `marrakech-marathon`, `vancouver-marathon`, `santiago-marathon`, `stockholm-marathon`, `copenhagen-marathon`, `helsinki-marathon`, `vienna-marathon`, `warsaw-marathon`, `prague-marathon`, `jerusalem-marathon`, `istanbul-marathon`, `dubai-marathon`, `doha-marathon`, `toronto-waterfront-marathon`, `mexico-city-marathon`, `taipei-marathon`, `seoul-marathon`, `singapore-marathon`, `kuala-lumpur-marathon`, `mumbai-marathon`, `sydney-marathon`, `nairobi-marathon`, `marine-corps-marathon`, `wuhan-marathon`, `qingdao-marathon`, `shenzhen-marathon`, `chongqing-marathon`, `dalian-marathon`, `xian-marathon`, `busan-marathon`, `zurich-marathon`, `jakarta-marathon` | Official map, PDF, GPX, or route-posting cross-check recorded in code | These rows are checked course geometry, not the synthetic fallback. |
| Quarantined pending exact geometry | `barcelona-marathon`, `chengdu-marathon`, `dublin-marathon`, `guangzhou-marathon`, `hangzhou-marathon` | Organizer material exists, but the current landmark extraction does not reconstruct a complete 42.195 km route | The startup seeder now clears the old synthetic geometry instead of publishing it as a course map. |
| Unverified full marathon | `gyeongju-marathon` | Official site pages exist, but the course page still says the route will be revealed later | No published defining corridor was found in this pass. |

## Watchlist

| raceId | official source URL(s) | defining checkpoints / corridors | evidence status | suspected mismatch |
| --- | --- | --- | --- | --- |
| `amsterdam-marathon` | <https://www.tcsamsterdammarathon.nl/parcours-highlights>, <https://www.tcsamsterdammarathon.nl/programma>, <https://www.tcsamsterdammarathon.nl/huidig-marathonparcours-blijft-gehandhaafd> | Olympic Stadium, Vondelpark, Rijksmuseum, Amstel / Ouderkerk, Science Park, Zeeburgerdijk, Wibautstraat, stadium return | The deterministic 543-point backend course passes the Amsterdam organizer-corridor gate and distance gate | Resolved 2026-08-07: the stale 267-point rectangle was rejected and the live row was reseeded as `verified-official-map:amsterdam-marathon` |
| `gold-coast-marathon` | <https://goldcoastmarathon.com.au/marathon-course/>, <https://goldcoastmarathon.com.au/races-2/course-maps/>, <https://goldcoastmarathon.com.au/races/marathon/> | Southport Broadwater Parklands start/finish, Miami turn point, Runaway Bay, Broadwater return | Official course pages include GPX / download links; backend supplemental note still refers to a reviewed sidecar provenance | Provenance warning only; no route mismatch confirmed in this pass |
| `gyeongju-marathon` | <https://www.gyeongjumarathon.com/course>, <https://en.gyeongjumarathon.com/51>, <https://en.gyeongjumarathon.com/57> | Gyeongju Civic Stadium, downtown Gyeongju, full / half / 10 km event pages | Course is still unpublished on the official site | Unverified until the organizer publishes a route or map |

## What is complete

- The old Osaka mismatch is resolved in the current source tree.
- The Amsterdam false positive is resolved: the stale rectangular route is
  rejected by a race-specific organizer-corridor validator and replaced by a
  deterministic 543-point route.
- The local Amsterdam live row was reseeded on 2026-08-07 with source
  `verified-official-map:amsterdam-marathon`; the old live image was cleared so
  the UI renders the corrected route geometry.
- Berlin and Bergen now use organizer-backed GPX geometry instead of synthetic
  fallbacks.
- The live H2 audit on 2026-08-07 enumerated all 77 distance-qualified catalog
  marathons: 72 passed the source, distance, point-count, and geometry checks;
  five were quarantined; zero known-bad routes remained published.
- Quarantine is fail-closed. When an official-landmark reconstruction is
  incomplete, the seeder clears a previous synthetic route, image, bounds,
  elevation, and confidence instead of silently installing another city loop.

## What remains unverified

- `barcelona-marathon`, `chengdu-marathon`, `dublin-marathon`,
  `guangzhou-marathon`, and `hangzhou-marathon` need complete organizer-aligned
  geometry before a course line is republished. Their old synthetic lines are
  no longer live.
- `gyeongju-marathon` needs a published official course map or corridor description before it can be treated as source-backed.
- `delhi-half-marathon` was excluded from the full-marathon audit because it is not a marathon.
