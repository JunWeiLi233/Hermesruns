# Auto-Hermes Docker Gate

Generated: 2026-06-06T01:36:10.896Z
Passed: yes
Git Head: ec14f93de36f73a594eac949bb3080e7eb334304
Command: docker build -f C:\Users\Junwei\Downloads\Hermes\Dockerfile -t hermes-autohermes-gate:local .
Reason: Docker publish gate passed for the current working tree.

## Status Snapshot
```text
M  .ai-sync/AGENT_SYNC.md
 M .ai-sync/AUTO_HERMES_DOCKER_GATE.json
 M .ai-sync/AUTO_HERMES_DOCKER_GATE.md
M  .ai-sync/CONTEXT_LEDGER.md
 M .codex/config.toml
M  .tools/audit-marathon-coursemaps.mjs
M  .tools/auto-commit.ps1
M  backend/pom.xml
M  backend/src/main/java/com/hermes/backend/AdminRacePortalController.java
A  backend/src/main/java/com/hermes/backend/AthensMarathonOfficialCourse.java
A  backend/src/main/java/com/hermes/backend/BostonMarathonOfficialCourse.java
A  backend/src/main/java/com/hermes/backend/BusanMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/ChicagoMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/ChongqingMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/CopenhagenMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/DalianMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/DohaMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/DubaiMarathonKnownCourse.java
M  backend/src/main/java/com/hermes/backend/GoogleGeocodingClient.java
A  backend/src/main/java/com/hermes/backend/HelsinkiMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/IstanbulMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/JakartaMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/JerusalemMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/KualaLumpurMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/LisbonMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/LondonMarathonKnownCourse.java
M  backend/src/main/java/com/hermes/backend/LosAngelesMarathonOfficialCourse.java
A  backend/src/main/java/com/hermes/backend/ManchesterMarathonKnownCourse.java
M  backend/src/main/java/com/hermes/backend/MarathonRouteExtractionService.java
M  backend/src/main/java/com/hermes/backend/MarathonRouteGeoreferencingService.java
A  backend/src/main/java/com/hermes/backend/MarineCorpsMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/MarrakechMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/MexicoCityMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/MilanMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/MumbaiMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/MunichMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/NairobiCityMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/NiceCannesMarathonKnownCourse.java
M  backend/src/main/java/com/hermes/backend/NycMarathonOfficialCourse.java
M  backend/src/main/java/com/hermes/backend/OfficialCourseStartupSeedConfiguration.java
M  backend/src/main/java/com/hermes/backend/OsakaMarathonOfficialCourse.java
A  backend/src/main/java/com/hermes/backend/ParisMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/PortoMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/PragueMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/QingdaoMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/QueenstownMarathonKnownCourse.java
M  backend/src/main/java/com/hermes/backend/RaceCourseMapBulkSeedService.java
M  backend/src/main/java/com/hermes/backend/RaceCourseMapGeometryService.java
M  backend/src/main/java/com/hermes/backend/RaceCourseMapImageService.java
M  backend/src/main/java/com/hermes/backend/RaceCourseMapSearchService.java
M  backend/src/main/java/com/hermes/backend/RaceCourseMapService.java
A  backend/src/main/java/com/hermes/backend/RomeMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/StandardCharteredNairobiMarathonKnownCourse.java
A  backend/src/main/java/com/hermes/backend/SupplementalMarathonKnownCourses.java
M  backend/src/main/java/com/hermes/backend/TerritoryService.java
M  backend/src/main/java/com/hermes/backend/TokyoMarathonOfficialCourse.java
A  backend/src/main/java/com/hermes/backend/WuxiMarathonOfficialCourse.java
M  backend/src/main/resources/application.properties
M  backend/src/main/resources/python/extract_route_path.py
M  backend/src/main/resources/python/test_extract_route_path.py
M  backend/src/test/java/com/hermes/backend/AdminRacePortalControllerTests.java
A  backend/src/test/java/com/hermes/backend/BostonMarathonOfficialCourseTests.java
A  backend/src/test/java/com/hermes/backend/BusanMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/ChicagoMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/ChongqingMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/CopenhagenMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/DalianMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/DohaMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/DubaiMarathonKnownCourseTests.java
M  backend/src/test/java/com/hermes/backend/GoogleGeocodingClientTests.java
A  backend/src/test/java/com/hermes/backend/HelsinkiMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/IstanbulMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/JakartaMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/JerusalemMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/KualaLumpurMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/LisbonMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/LondonMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/ManchesterMarathonKnownCourseTests.java
M  backend/src/test/java/com/hermes/backend/MarathonRouteExtractionServiceTests.java
M  backend/src/test/java/com/hermes/backend/MarathonRouteGeoreferencingServiceTests.java
A  backend/src/test/java/com/hermes/backend/MarineCorpsMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/MarrakechMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/MexicoCityMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/MilanMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/MumbaiMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/MunichMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/NairobiCityMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/NiceCannesMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/OfficialCourseStartupSeedConfigurationTests.java
A  backend/src/test/java/com/hermes/backend/ParisMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/PortoMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/PragueMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/QingdaoMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/QueenstownMarathonKnownCourseTests.java
M  backend/src/test/java/com/hermes/backend/RaceCourseMapBulkSeedServiceTests.java
A  backend/src/test/java/com/hermes/backend/RaceCourseMapImageServiceTests.java
M  backend/src/test/java/com/hermes/backend/RaceCourseMapManualAssetTests.java
M  backend/src/test/java/com/hermes/backend/RaceCourseMapSearchServiceTests.java
M  backend/src/test/java/com/hermes/backend/RaceCourseMapServiceTests.java
A  backend/src/test/java/com/hermes/backend/RomeMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/StandardCharteredNairobiMarathonKnownCourseTests.java
A  backend/src/test/java/com/hermes/backend/SupplementalMarathonKnownCoursesTests.java
M  backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java
A  backend/src/test/java/com/hermes/backend/TokyoMarathonOfficialCourseTests.java
A  backend/src/test/java/com/hermes/backend/WuxiMarathonOfficialCourseTests.java
M  frontend/src/data/worldRaceCatalog.json
M  frontend/src/i18n/locales/en/pages.js
M  frontend/src/i18n/locales/zh-CN/pages.js
M  frontend/src/pages/RacesDetail.jsx
M  frontend/src/pages/Territory.jsx
M  frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js
M  frontend/src/pages/raceDetailElevationPerKm.smoke.test.js
M  frontend/src/pages/territoryBackendWiring.smoke.test.js
M  frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js
?? .tools/InspectPdfPages.class
?? .tools/InspectPdfPages.java
?? backend_err.txt
```

## Output

none

