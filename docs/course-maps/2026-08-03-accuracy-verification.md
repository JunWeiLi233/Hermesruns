# Race-detail course-map accuracy verification — 2026-08-03

## Scope and result

This verification separates two different promises:

1. **Rendering:** does every `/races/details/:raceId` page show a usable map?
2. **Course accuracy:** does the displayed polyline have evidence that it is the
   organizer's current course rather than an approximation?

The original visual pass found that all **77 of 77** distance-qualified
full-marathon race-detail pages could render the map surface. A later backend
accuracy pass changed the publication boundary: the live H2 audit now reports
72 clean routes, five quarantined routes, and zero known-bad synthetic routes
still published.

Rendering availability is no longer allowed to override route accuracy. When
an organizer-landmark extraction is incomplete, the backend withholds the
polyline until complete organizer-aligned geometry is available.

## Routes that must not be described as exact courses

These routes were the synthetic watchlist in the original audit. Berlin and
Bergen have since been replaced with organizer-backed GPX routes. The other
five are now quarantined, so their inaccurate polylines are no longer served:

| Race | Current source | Current polyline | Organizer material found online |
| --- | --- | ---: | --- |
| Barcelona Marathon | `quarantined-unverified-course:barcelona-marathon` | Withheld | [official route page](https://www.zurichmaratobarcelona.es/en/course/) |
| Bergen City Marathon | `verified-official-gpx:bergen-city-marathon` | 42.2 km | [official course-map page](https://www.bergencitymarathon.no/en/distances-and-course-map/sport-1-marathon/) |
| Berlin Marathon | `verified-official-gpx:berlin-marathon` | 42.2 km | [official course page](https://www.bmw-berlin-marathon.com/en/your-race/course/) |
| Chengdu Marathon | `quarantined-unverified-course:chengdu-marathon` | Withheld | Organizer material does not yet yield a complete checked 42.195 km line. |
| Dublin Marathon | `quarantined-unverified-course:dublin-marathon` | Withheld | [official route page and map download](https://irishlifedublinmarathon.ie/course-and-start-finish/) |
| Guangzhou Marathon | `quarantined-unverified-course:guangzhou-marathon` | Withheld | Official event material establishes checkpoints, but the present extraction is incomplete. |
| Hangzhou Marathon | `quarantined-unverified-course:hangzhou-marathon` | Withheld | Current organizer material does not yet establish a complete machine-readable marathon course. |

Osaka is no longer in this synthetic-fallback set after the current-course
correction below. The five withheld rows still require complete
organizer-backed geometry before republishing.

## Osaka correction in this round

The prior Osaka row was a 45.4 km synthetic street loop (and an earlier
landmark extraction was only 24.2 km). Both were wrong because they omitted the
course's three official out-and-back sections. The route seed now follows the
ordered checkpoints from the [official 2026 course page](https://www.osaka-marathon.com/2026/en/info/course/)
and its [official course PDF](https://www.osaka-marathon.com/2026/en/info/course/pdf/course_en.pdf):

- Osaka Prefectural Government start → Tenjinbashi 6 → Nakanoshima/Midosuji → Namba;
- Kyocera Dome → Ichioka Motomachi 3 turnaround → return;
- Naniwasuji → Yanagi-dori turnaround → return;
- Matsuyamachi-suji → Koenkitaguchi turnaround → return;
- Imazato-suji → Shiginohigashi 2 → Osaka Castle Park finish.

`RaceCourseMapService` refreshes only seed-owned stale Osaka rows on the next
detail-page request, so an existing synthetic or shortened official row cannot
mask the corrected route. Admin-uploaded sources are left untouched. This is
an official landmark corridor, not a dense organizer GPS trace; the PDF remains
the provenance reference for any future dense-track replacement.

## Confirmed false-positive: Amsterdam

The Amsterdam route passes the present audit because its polyline is 42.2 km
with 267 points. Computer Use showed it as a near-rectangular city corridor.
That does not agree with the organizer's stated route features: start/finish
inside the Olympic Stadium, passage under the Rijksmuseum, the Heineken
Experience, the Amstel, and Vondelpark. See the [organizer programme](https://www.tcsamsterdammarathon.nl/programma).

This is a concrete false positive: a plausible length, high point count, and a
``known-official-course`` source tag are not enough to establish course
accuracy.

### Resolved on 2026-08-07

The backend now rejects the stale 267-point Amsterdam rectangle unless the
route reaches the organizer-defined Olympic Stadium, Amstel / Ouderkerk,
Science Park, Rijksmuseum, and Vondelpark corridors. The live row was reseeded
with a deterministic 543-point route and source
`verified-official-map:amsterdam-marathon`. The regression suite retains the
old rectangle as a negative fixture so broad distance plausibility cannot
promote it again.

## Extraction-algorithm issue identified in this audit

The flaw is in trust promotion, not Leaflet rendering:

- `RaceCourseMapBulkSeedService` promotes a route to
  `known-official-course:<race-id>` with 90% confidence after local ordered
  geometry passes only broad distance plausibility.
- `RaceCourseMapService` and `RacesDetail.jsx` treat that prefix as an official
  source, so the runner-facing page calls it "official course".
- `SupplementalMarathonKnownCourses` stores encoded polylines and free-form
  notes, but it does not consistently store a per-route organizer URL, route
  edition, retrieval date, source-file checksum, official checkpoint set, or
  a geometry comparison result.
- The current audit validates distance, point count, city proximity, and large
  segment ratio. A rectangle can satisfy all of those tests while tracing the
  wrong streets.
- Synthetic fallbacks are shown with wording that implies a detected course
  map. They should be identified as generated street/geographic approximations.

## Original correction plan

1. Replace the boolean/prefix trust model with explicit source classes:
   `verified-official-gpx`, `verified-official-geojson`,
   `verified-official-pdf-georeferenced`, `official-landmark-corridor`, and
   `synthetic-fallback`.
2. Require provenance before the UI can say "official": organizer URL, route
   edition/date, extraction method, retrieval date, and checksum or immutable
   source reference.
3. Add validation beyond total distance: start/finish proximity, organizer
   checkpoints/landmarks in order, route-to-reference corridor distance, and
   an alert for rectangular/loop-like geometry when the official route is
   point-to-point or has known out-and-back sections.
4. Downgrade every unproven `known-official-course` record to a neutral
   verified-pending label until a versioned organizer source passes the new
   checks. Amsterdam now has a race-specific checked replacement.
5. Import dense organizer-backed GPX/GeoJSON where available, starting with
   Berlin and Barcelona. Georeference official PDFs only when a machine-readable
   file is unavailable; retain the PDF and its validation checkpoints as
   evidence.

## Current acceptance boundary

The system serves 72 course lines that pass the current source and geometry
audit. Five incomplete reconstructions are deliberately unavailable rather
than represented by convincing but wrong synthetic loops. The next route round
should replace those quarantines only with complete organizer-aligned geometry.
