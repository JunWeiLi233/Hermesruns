# Marathon course-map sources

The race-detail map uses ordered latitude/longitude routes, not a city-sized
ellipse. Routes in the checked catalog are local, reviewable data so the map
does not depend on a live image OCR result at request time.

## Reference extraction: TCS London Marathon

- Official course reference: <https://www.londonmarathonevents.co.uk/london-marathon/course>
- The organizer describes the route from the three Greenwich-area starts through
  Woolwich, Greenwich, Cutty Sark, Tower Bridge, Canary Wharf, Tower Hill,
  Westminster, Birdcage Walk, Buckingham Palace, and The Mall.
- The ordered polyline is stored in
  `backend/src/main/java/com/hermes/backend/LondonMarathonKnownCourse.java` as
  an encoded polyline. It is labelled `Start - Greenwich` and
  `Finish - The Mall` and is promoted by the bulk seeder with a
  `known-official-course:london-marathon` source tag.

## Landmark corridors

Several organizers publish a route map or landmark description without a
downloadable GPX track. These races use the checked landmark catalog in
`backend/src/main/java/com/hermes/backend/MarathonOfficialLandmarkCourseCatalog.java`.
Each consecutive landmark pair is routed through pedestrian OSRM; when the
public router is unavailable, the same pair is retained as a straight corridor
between the official landmarks. The persisted source is
`known-official-course:<race-id>` and the official reference URL is stored with
the map asset.

| Race | Official course reference |
| --- | --- |
| Big Sur Marathon | <https://www.bigsurmarathon.org/races/marathon/> |
| JAL Honolulu Marathon | <https://www.honolulumarathon.org/our-events/jal-honolulu-marathon> |
| Zurich Marató Barcelona | <https://www.zurichmaratobarcelona.es/en/course/> |
| Amazing Thailand Marathon Bangkok | <https://amazingthailandmarathon.com/wp-content/uploads/ATMBKK2026_MAP_COURSE_42K.pdf> |
| Comrades Marathon | <https://comrades.com/dynamic-route-map> |
| Buenos Aires Marathon | <https://www.maratondebuenosaires.com/> |
| Bergen City Marathon | <https://www.bergencitymarathon.no/en/distances-and-course-map/sport-1-marathon/> |
| Brussels Airport Marathon | <https://pressroom.brusselsairport.be/en-brussels-airport-marathon-2025> |
| Maratona do Rio | <https://www.maratonadorio.com.br/en/corrida/42k-2026> |
| Beijing Marathon | <https://en.beijing-marathon.com/> |
| Standard Chartered Hong Kong Marathon | <https://www.hkmarathon.com/zh-hant/course-maps> |
| Auckland Marathon | <https://aucklandmarathon.co.nz/race-info/full-marathon/> |
| Sanlam Cape Town Marathon | <https://capetownmarathon.com/marathon/> |
| Fukuoka Marathon | <https://www.f-marathon.jp/en/course.php> |
| Guangzhou Marathon | <https://www.eguangzhou.gov.cn/gzwhatson/content/post_39242.html> |
| Chengdu Marathon | <https://www.chengdu-marathon.com/> |
| Hangzhou Marathon | <https://www.ehangzhou.gov.cn/2024-09/02/c_290710.htm> |
| Irish Life Dublin Marathon | <https://irishlifedublinmarathon.ie/maps/> |
| Techcombank Ho Chi Minh City Marathon | <https://marathonhcmc.com/en/ban-do-duong-chay-chinh-thuc-trinh-lang/> |

These are corridor-level coordinates derived from the linked organizer
references, not claims that the public router reproduces every race-day lane,
temporary closure, or aid-station detour. Replace a corridor with an official
GPX/GeoJSON track when the organizer publishes one.

## Deterministic organizer-aligned course: TCS Amsterdam Marathon

- Organizer confirmation that the current marathon route remains in use:
  <https://www.tcsamsterdammarathon.nl/huidig-marathonparcours-blijft-gehandhaafd>
- Organizer route highlights:
  <https://www.tcsamsterdammarathon.nl/parcours-highlights>
- Organizer programme and stadium start/finish reference:
  <https://www.tcsamsterdammarathon.nl/programma>
- The checked route is stored in
  `backend/src/main/java/com/hermes/backend/AmsterdamMarathonOfficialCourse.java`.
  It follows the Olympic Stadium, Vondelpark, Rijksmuseum, Zuidas, Amstel /
  Ouderkerk, Science Park, Zeeburgerdijk, Wibautstraat, and stadium-return
  corridors. The route is deterministic at seed time and does not depend on a
  live router.
- `RaceKnownOrderedCourseCatalog` applies Amsterdam-specific geography checks;
  the old length-plausible rectangle is retained only as a rejected regression
  fixture.

## Promotion rule

`RaceKnownOrderedCourseCatalog` and
`MarathonOfficialLandmarkCourseCatalog` are the checked route lookups. Bulk and
startup seeding use both catalogs before the synthetic fallback, so every race
with checked geometry renders its local course route. A race without checked
geometry remains explicitly marked as synthetic until an official route is
added; it is never presented as an official route.
