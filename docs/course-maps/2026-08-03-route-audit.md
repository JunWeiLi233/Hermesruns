# Race-detail course-map audit — 2026-08-03

## Finding

The map layout was not removed from the race-detail page. The API returned an
empty `routePoints` array for most catalog races because the local database had
only 8 live course-map assets for 77 full-marathon catalog entries. The page
correctly fell back to the city map, which made the course layer look missing.

The audit also found one bad promoted extraction:

- `osaka-marathon`: the previous 24.2 km extracted polyline for a 42.195 km
  race (600 points, ratio 0.57) omitted the official out-and-back sections.

Computer Use visual QA also found a second geometry problem that the numeric
distance gate cannot detect:

- `amsterdam-marathon`: the persisted `known-official-course` polyline is a
  near-rectangular corridor around the city. It is 42.2 km and therefore passes
  the length check, but it does not match the organizer's street-by-street
  course. Treat this as a geometry-extraction issue, not an official track.

The official Osaka Marathon 2026 outline specifies a 42.195 km certified
course starting in front of the Osaka Prefectural Government Building and
finishing inside Osaka Castle. The organizer's runner guide links the detailed
running-course PDF from its course-material page. See the
[official outline](https://www.osaka-marathon.com/2026/en/info/gist/),
[official course page](https://www.osaka-marathon.com/2026/en/info/course/),
and [official runner guide PDF](https://www.osaka-marathon.com/2026/en/entry/guidance/pdf/Info_on_participation_en_0212.pdf).

## Fix shipped in this round

1. `RaceCourseMapService` now invokes the existing bulk-seed geometry pipeline
   on demand when a catalog race has no usable stored route. This persists the
   route before the image/AI search path and keeps the existing Leaflet map
   layout intact.
2. Hand-curated official routes are now checked against the race distance
   before promotion. A short extraction is rejected instead of being labelled
   as an official course; the page receives a clearly labelled synthetic route
   until a dense official track is available.
3. The same distance gate is used by bulk seeding and runtime storage lookup,
   so an invalid persisted route cannot mask the repair path.
4. The read-only OSM tile proxy is now public because Leaflet image requests
   cannot carry the runner bearer token. This restores the basemap instead of
   leaving the route card as an empty beige panel.
5. Page-scroll wheel events no longer count as map interaction, so the final
   responsive fit keeps the route centered while real drag interaction still
   disables automatic refits.
6. Osaka now uses the official 2026 checkpoint order, including the Kyocera
   Dome/Ichioka Motomachi 3, Yanagi-dori, and Koenkitaguchi turnarounds. A
   stale seed-owned Osaka row is refreshed on the next detail-page request;
   admin-uploaded rows remain protected.

## Amsterdam follow-up resolved on 2026-08-07

The rectangular Amsterdam catalog corridor is now quarantined by an
organizer-specific geography gate. A deterministic 543-point route aligned to
the Olympic Stadium, Vondelpark, Rijksmuseum, Amstel / Ouderkerk, Science Park,
Zeeburgerdijk, and Wibautstraat corridors replaced the stale live row. See the
[full-marathon source audit](./2026-08-07-full-marathon-source-audit.md) for the
current verification record. Other unproven routes still need organizer-backed
dense course tracks where available.

## Verification scope

The audit script reads the frontend race catalog and the local H2 asset store;
it is a data-availability audit, not a claim that synthetic routes match every
temporary race-day lane. Checked official references are recorded in
[`official-sources.md`](./official-sources.md). Synthetic routes remain
explicitly labelled and are intended as a usable map fallback until an
organizer-published track is added.
