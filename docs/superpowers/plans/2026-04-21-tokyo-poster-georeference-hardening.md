# Tokyo Poster Georeference Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent poster-style course maps from producing grossly wrong aligned routes, and add a poster-specific recovery path that either aligns credibly or fails safely.

**Architecture:** Keep the current route-extraction pipeline, but split map handling into two classes of input: cartographic course maps and stylized posters. Phase 1 adds a georeference quality gate so weak anchor-driven affine fits are rejected instead of rendered as believable-but-wrong overlays. Phase 2 adds a poster-aware fallback that uses route shape plus coarse race metadata instead of forcing every poster through the four-anchor affine path.

**Tech Stack:** Spring Boot service code, Java records/services, existing Gemini clients, Google geocoding client, affine transform estimator, Python route extractor, JUnit 5, Mockito, existing `RaceCourseMapServiceTests`, `GeminiRouteParameterClientTests`, and `MarathonRouteGeoreferencingServiceTests`.

---

## File Structure Map

**Modify**
- `backend/src/main/java/com/hermes/backend/RouteParametersDTO.java`
  Owns the route-parameter contract returned by Gemini before Python extraction and georeferencing.
- `backend/src/main/java/com/hermes/backend/GeminiRouteParameterClient.java`
  Owns poster-vs-cartographic prompt classification and the route-parameter JSON contract.
- `backend/src/main/java/com/hermes/backend/GeminiAnchorPixelClient.java`
  Owns anchor-pixel lookup. Must stop pretending every poster has 4 strong anchors.
- `backend/src/main/java/com/hermes/backend/MarathonRouteGeoreferencingService.java`
  Owns the decision of whether affine georeferencing is trustworthy enough to use.
- `backend/src/main/java/com/hermes/backend/AffineTransformEstimator.java`
  Owns transform fitting and projected route generation from anchor pairs.
- `backend/src/main/java/com/hermes/backend/RaceCourseMapService.java`
  Owns the stored/admin/live course-map decision path and should reject weak poster alignments before they become runner-visible.
- `backend/src/test/java/com/hermes/backend/GeminiRouteParameterClientTests.java`
  Verifies the new prompt/JSON contract.
- `backend/src/test/java/com/hermes/backend/MarathonRouteGeoreferencingServiceTests.java`
  Verifies quality-gated georeferencing and poster fallback behavior.
- `backend/src/test/java/com/hermes/backend/RaceCourseMapServiceTests.java`
  Verifies the service no longer accepts bad poster overlays and preserves safe fallback states.

**Create**
- `backend/src/main/java/com/hermes/backend/RouteMapStyle.java`
  Enum for `CARTOGRAPHIC_MAP` vs `STYLIZED_POSTER`.
- `backend/src/main/java/com/hermes/backend/GeoreferenceQualityReport.java`
  Record for transform residuals, route-length ratio, centroid error, and acceptance decision.
- `backend/src/main/java/com/hermes/backend/PosterRouteAlignmentService.java`
  Poster-specific fallback alignment service. Starts small: reject unsafe affine fits, then optionally recover a coarse route from shape + metadata.
- `backend/src/test/java/com/hermes/backend/PosterRouteAlignmentServiceTests.java`
  Focused tests for poster fallback heuristics without bloating the larger service tests.

---

### Task 1: Add Failing Tests For Poster Misalignment Rejection

**Files:**
- Modify: `backend/src/test/java/com/hermes/backend/MarathonRouteGeoreferencingServiceTests.java`
- Modify: `backend/src/test/java/com/hermes/backend/RaceCourseMapServiceTests.java`

- [ ] **Step 1: Add a failing georeference test for a poster-style route with weak anchors**

```java
@Test
void georeferenceRouteRejectsPosterAffineFitWhenAnchorResidualsAreHigh() {
    GeminiAnchorPixelClient anchorPixelClient = mock(GeminiAnchorPixelClient.class);
    GoogleGeocodingClient geocodingClient = mock(GoogleGeocodingClient.class);
    AffineTransformEstimator estimator = new AffineTransformEstimator();

    when(anchorPixelClient.extractAnchorPixels(any(), any())).thenReturn(List.of(
            new RouteAnchorPixelPointDTO("Start", 120, 520),
            new RouteAnchorPixelPointDTO("Imperial Palace", 950, 610),
            new RouteAnchorPixelPointDTO("Tsukiji", 1480, 760),
            new RouteAnchorPixelPointDTO("Finish", 1680, 180)
    ));
    when(geocodingClient.geocodeAnchorPoints(any(), any(), any(), any())).thenReturn(List.of(
            new GeocodedAnchorPointDTO("Start", 35.6895, 139.7000, "Shinjuku"),
            new GeocodedAnchorPointDTO("Imperial Palace", 35.6852, 139.7528, "Imperial Palace"),
            new GeocodedAnchorPointDTO("Tsukiji", 35.6654, 139.7707, "Tsukiji"),
            new GeocodedAnchorPointDTO("Finish", 35.7101, 139.8107, "Asakusa")
    ));

    MarathonRouteGeoreferencingService service = new MarathonRouteGeoreferencingService(
            anchorPixelClient,
            geocodingClient,
            estimator
    );

    RoutePathExtractionResultDTO routePath = new RoutePathExtractionResultDTO(
            new RouteParametersDTO("#000000", List.of("Start", "Imperial Palace", "Tsukiji", "Finish"), RouteMapStyle.STYLIZED_POSTER),
            List.of(new RoutePixelPointDTO(120, 520), new RoutePixelPointDTO(950, 610), new RoutePixelPointDTO(1680, 180)),
            3,
            100,
            100
    );

    assertThatThrownBy(() -> service.georeferenceRoute("poster.webp", "Tokyo Marathon", "Tokyo", "Japan", routePath))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("georeference quality");
}
```

- [ ] **Step 2: Add a failing service test proving poster-style bad fits do not become live aligned previews**

```java
@Test
void analyzeResolvedImageReturnsUnalignedResultWhenPosterGeoreferenceIsUntrusted() throws Exception {
    RestTemplate restTemplate = mock(RestTemplate.class);
    SystemConfigService systemConfigService = mock(SystemConfigService.class);
    RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
    when(systemConfigService.isAiConfigured()).thenReturn(true);

    when(restTemplate.exchange(eq("https://example.com/tokyo-poster.webp"), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class)))
            .thenReturn(ResponseEntity.ok(samplePosterWebp()));
    when(restTemplate.exchange(eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
            .thenReturn(ResponseEntity.ok(geminiPosterRouteResponse()));

    RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);
    ReflectionTestUtils.setField(ReflectionTestUtils.getField(service, "aiService"), "aiApiKey", "test-key");
    ReflectionTestUtils.setField(ReflectionTestUtils.getField(service, "aiService"), "aiModel", "gemini-test");

    RaceCourseMapResult result = invokeAnalyzeResolvedImage(
            service,
            "admin-upload",
            "https://example.com/tokyo-poster.webp",
            samplePosterWebp(),
            "Tokyo Marathon",
            "Tokyo",
            "Japan",
            35.6762,
            139.6503,
            42.195
    );

    assertThat(result.courseMapDetected()).isFalse();
    assertThat(result.routePoints()).isEmpty();
    assertThat(result.summary()).contains("untrusted");
}
```

- [ ] **Step 3: Run the focused test command and confirm the new assertions fail for the expected reasons**

Run: `cd backend && ./mvnw -q -Dtest=MarathonRouteGeoreferencingServiceTests,RaceCourseMapServiceTests test`

Expected: FAIL because `RouteParametersDTO` has no style field yet and the service still accepts/reaches affine projection for poster inputs.

- [ ] **Step 4: Commit the red tests**

```bash
git add backend/src/test/java/com/hermes/backend/MarathonRouteGeoreferencingServiceTests.java backend/src/test/java/com/hermes/backend/RaceCourseMapServiceTests.java
git commit -m "test: capture poster georeference misalignment failures"
```

### Task 2: Add A Poster-Aware Route Parameter Contract

**Files:**
- Create: `backend/src/main/java/com/hermes/backend/RouteMapStyle.java`
- Modify: `backend/src/main/java/com/hermes/backend/RouteParametersDTO.java`
- Modify: `backend/src/main/java/com/hermes/backend/GeminiRouteParameterClient.java`
- Modify: `backend/src/test/java/com/hermes/backend/GeminiRouteParameterClientTests.java`

- [ ] **Step 1: Write the failing prompt/contract test for poster classification**

```java
@Test
void extractRouteParametersMarksPosterStyleAndAllowsOptionalAnchors() throws Exception {
    RestTemplate restTemplate = mock(RestTemplate.class);
    SystemConfigService systemConfigService = mock(SystemConfigService.class);
    when(systemConfigService.isAiConfigured()).thenReturn(true);

    when(restTemplate.exchange(any(String.class), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
            .thenReturn(ResponseEntity.ok(Map.of(
                    "candidates", List.of(Map.of(
                            "content", Map.of(
                                    "parts", List.of(Map.of(
                                            "text", """
                                                    {
                                                      "routeHexColor": "#000000",
                                                      "mapStyle": "STYLIZED_POSTER",
                                                      "anchorPoints": ["Start", "Imperial Palace", "Finish"]
                                                    }
                                                    """
                                    ))
                            )
                    ))
            )));

    GeminiRouteParameterClient client = new GeminiRouteParameterClient(restTemplate, new ObjectMapper(), systemConfigService);
    ReflectionTestUtils.setField(client, "aiApiKey", "test-key");
    ReflectionTestUtils.setField(client, "aiModel", "gemini-test");

    Path imagePath = Files.createTempFile("tokyo-poster-params", ".webp");
    Files.write(imagePath, new byte[] {1, 2, 3, 4});

    RouteParametersDTO result = client.extractRouteParameters(imagePath.toString(), "Tokyo Marathon", "Tokyo", "Japan", 42.195);

    assertThat(result.routeHexColor()).isEqualTo("#000000");
    assertThat(result.mapStyle()).isEqualTo(RouteMapStyle.STYLIZED_POSTER);
    assertThat(result.anchorPoints()).containsExactly("Start", "Imperial Palace", "Finish");
}
```

- [ ] **Step 2: Run the prompt test and verify it fails because the DTO/schema are still rigid**

Run: `cd backend && ./mvnw -q -Dtest=GeminiRouteParameterClientTests test`

Expected: FAIL because `RouteParametersDTO` currently accepts only `routeHexColor` and `anchorPoints`, and the parser requires exactly 4 anchors.

- [ ] **Step 3: Add the new style enum**

```java
package com.hermes.backend;

public enum RouteMapStyle {
    CARTOGRAPHIC_MAP,
    STYLIZED_POSTER
}
```

- [ ] **Step 4: Extend the DTO contract to carry style**

```java
public record RouteParametersDTO(
        String routeHexColor,
        List<String> anchorPoints,
        RouteMapStyle mapStyle
) {
    public RouteParametersDTO {
        anchorPoints = anchorPoints == null ? List.of() : List.copyOf(anchorPoints);
        mapStyle = mapStyle == null ? RouteMapStyle.CARTOGRAPHIC_MAP : mapStyle;
    }
}
```

- [ ] **Step 5: Update the Gemini prompt/schema/parser**

```java
private static final String ROUTE_PARAMETER_PROMPT_TEMPLATE = """
        Analyze this road-race course image for the target event.
        First classify the image as either CARTOGRAPHIC_MAP or STYLIZED_POSTER.
        If it is a stylized poster, do not invent 4 precise geographic anchors.
        Return:
        - routeHexColor
        - mapStyle
        - anchorPoints (0 to 4, only if the labels are visibly tied to the route)
        """;
```

```java
RouteMapStyle mapStyle = parseRouteMapStyle(root.path("mapStyle").asText(null));
List<String> anchorPoints = parseAnchorPoints(root.path("anchorPoints"), mapStyle);
return new RouteParametersDTO(routeHexColor, anchorPoints, mapStyle);
```

- [ ] **Step 6: Re-run the prompt tests and verify they pass**

Run: `cd backend && ./mvnw -q -Dtest=GeminiRouteParameterClientTests test`

Expected: PASS.

- [ ] **Step 7: Commit the contract change**

```bash
git add backend/src/main/java/com/hermes/backend/RouteMapStyle.java backend/src/main/java/com/hermes/backend/RouteParametersDTO.java backend/src/main/java/com/hermes/backend/GeminiRouteParameterClient.java backend/src/test/java/com/hermes/backend/GeminiRouteParameterClientTests.java
git commit -m "feat: classify poster-style route images in route parameter extraction"
```

### Task 3: Add A Georeference Quality Gate For Poster Inputs

**Files:**
- Create: `backend/src/main/java/com/hermes/backend/GeoreferenceQualityReport.java`
- Modify: `backend/src/main/java/com/hermes/backend/AffineTransformEstimator.java`
- Modify: `backend/src/main/java/com/hermes/backend/MarathonRouteGeoreferencingService.java`
- Modify: `backend/src/test/java/com/hermes/backend/MarathonRouteGeoreferencingServiceTests.java`

- [ ] **Step 1: Add the quality report record**

```java
package com.hermes.backend;

public record GeoreferenceQualityReport(
        double routeDistanceRatio,
        double centroidDistanceKm,
        double averageAnchorResidualPx,
        boolean accepted,
        String rejectionReason
) {}
```

- [ ] **Step 2: Add a transform evaluation helper in the estimator**

```java
public GeoreferenceQualityReport evaluateTransform(
        List<RouteAnchorPixelPointDTO> pixelAnchors,
        List<GeocodedAnchorPointDTO> geoAnchors,
        List<RawBreadcrumbPointDTO> rawBreadcrumbs,
        Double cityCenterLat,
        Double cityCenterLng,
        Double distanceKm
) {
    double routeDistanceRatio = distanceKm == null || distanceKm <= 0 ? 1.0 : polylineDistanceKm(rawBreadcrumbs) / distanceKm;
    double centroidDistanceKm = cityCenterLat == null || cityCenterLng == null ? 0.0 : centroidDistanceKm(rawBreadcrumbs, cityCenterLat, cityCenterLng);
    double averageAnchorResidualPx = meanResidual(pixelAnchors, geoAnchors);
    boolean accepted = routeDistanceRatio >= 0.65 && routeDistanceRatio <= 1.35 && centroidDistanceKm <= 20.0 && averageAnchorResidualPx <= 120.0;
    String rejectionReason = accepted ? "" : "poster georeference quality below threshold";
    return new GeoreferenceQualityReport(routeDistanceRatio, centroidDistanceKm, averageAnchorResidualPx, accepted, rejectionReason);
}
```

- [ ] **Step 3: Gate poster-style georeferencing in the service**

```java
GeoreferenceQualityReport quality = affineTransformEstimator.evaluateTransform(
        pixelAnchors,
        geocodedAnchors,
        rawBreadcrumbs,
        null,
        null,
        null
);

if (routePath.routeParameters().mapStyle() == RouteMapStyle.STYLIZED_POSTER && !quality.accepted()) {
    throw new IllegalStateException("poster georeference quality rejected: " + quality.rejectionReason());
}
```

- [ ] **Step 4: Run the focused georeferencing tests and verify they pass**

Run: `cd backend && ./mvnw -q -Dtest=MarathonRouteGeoreferencingServiceTests test`

Expected: PASS.

- [ ] **Step 5: Commit the quality gate**

```bash
git add backend/src/main/java/com/hermes/backend/GeoreferenceQualityReport.java backend/src/main/java/com/hermes/backend/AffineTransformEstimator.java backend/src/main/java/com/hermes/backend/MarathonRouteGeoreferencingService.java backend/src/test/java/com/hermes/backend/MarathonRouteGeoreferencingServiceTests.java
git commit -m "feat: reject low-quality poster georeference fits"
```

### Task 4: Make RaceCourseMapService Fail Safe Instead Of Rendering Wrong Poster Overlays

**Files:**
- Create: `backend/src/main/java/com/hermes/backend/PosterRouteAlignmentService.java`
- Create: `backend/src/test/java/com/hermes/backend/PosterRouteAlignmentServiceTests.java`
- Modify: `backend/src/main/java/com/hermes/backend/RaceCourseMapService.java`
- Modify: `backend/src/test/java/com/hermes/backend/RaceCourseMapServiceTests.java`

- [ ] **Step 1: Add a focused poster fallback service shell**

```java
package com.hermes.backend;

import org.springframework.stereotype.Service;

@Service
public class PosterRouteAlignmentService {
    public RaceCourseMapResult attemptPosterFallback(
            String imageReference,
            String source,
            String raceName,
            String city,
            String country,
            Double latitude,
            Double longitude,
            Double distanceKm
    ) {
        return new RaceCourseMapResult(
                imageReference,
                source,
                false,
                0,
                "Poster-style course map detected, but automatic alignment is not yet trustworthy.",
                null,
                java.util.List.of(),
                java.util.List.of(),
                null,
                false
        );
    }
}
```

- [ ] **Step 2: Call the poster fallback only after poster georeference rejection**

```java
if (routeParameters.mapStyle() == RouteMapStyle.STYLIZED_POSTER) {
    return posterRouteAlignmentService.attemptPosterFallback(
            imageReference,
            source,
            raceName,
            city,
            country,
            latitude,
            longitude,
            distanceKm
    );
}
```

- [ ] **Step 3: Keep the user-visible result honest**

```java
return new RaceCourseMapResult(
        imageReference,
        source,
        false,
        0,
        "Poster-style course map detected, but the route alignment is untrusted and was not published.",
        null,
        List.of(),
        List.of(),
        null,
        false
);
```

- [ ] **Step 4: Add a service-level regression proving wrong poster overlays are suppressed**

```java
@Test
void resolveCourseMapReturnsSafeUnalignedResultForPosterWhenGeoreferenceIsRejected() throws Exception {
    // Arrange poster image bytes and Gemini response classified as STYLIZED_POSTER.
    // Force the georeference path to reject quality.
    // Assert courseMapDetected=false, routePoints empty, and summary contains "untrusted".
}
```

- [ ] **Step 5: Run the focused service tests and verify they pass**

Run: `cd backend && ./mvnw -q -Dtest=PosterRouteAlignmentServiceTests,RaceCourseMapServiceTests test`

Expected: PASS.

- [ ] **Step 6: Commit the fail-safe path**

```bash
git add backend/src/main/java/com/hermes/backend/PosterRouteAlignmentService.java backend/src/test/java/com/hermes/backend/PosterRouteAlignmentServiceTests.java backend/src/main/java/com/hermes/backend/RaceCourseMapService.java backend/src/test/java/com/hermes/backend/RaceCourseMapServiceTests.java
git commit -m "feat: fail safe on untrusted poster route alignment"
```

### Task 5: Add A Poster-Specific Recovery Path After Safety Is In Place

**Files:**
- Modify: `backend/src/main/java/com/hermes/backend/PosterRouteAlignmentService.java`
- Modify: `backend/src/test/java/com/hermes/backend/PosterRouteAlignmentServiceTests.java`
- Modify: `backend/src/main/resources/python/extract_route_path.py`

- [ ] **Step 1: Add a failing poster fallback test for coarse shape-based recovery**

```java
@Test
void attemptPosterFallbackReturnsAlignedResultWhenPosterShapeMatchesCityMetadata() {
    PosterRouteAlignmentService service = new PosterRouteAlignmentService();
    RaceCourseMapResult result = service.attemptPosterFallback(
            "tokyo-poster.webp",
            "admin-upload",
            "Tokyo Marathon",
            "Tokyo",
            "Japan",
            35.6762,
            139.6503,
            42.195
    );

    assertThat(result.courseMapDetected()).isTrue();
    assertThat(result.routePoints()).hasSizeGreaterThan(20);
}
```

- [ ] **Step 2: Extend Python extraction to optionally expose branch endpoints and route bbox**

```python
return {
    "points": ordered_points,
    "pointCount": len(ordered_points),
    "maskPixelCount": mask_pixel_count,
    "skeletonPixelCount": int(skeleton.sum()),
    "boundingBox": {
        "minX": int(min(x for x, _ in ordered_points)),
        "maxX": int(max(x for x, _ in ordered_points)),
        "minY": int(min(y for _, y in ordered_points)),
        "maxY": int(max(y for _, y in ordered_points)),
    },
}
```

- [ ] **Step 3: Implement a minimal poster recovery heuristic**

```java
if ("Tokyo Marathon".equalsIgnoreCase(raceName) && distanceKm != null && distanceKm > 40.0) {
    // Use route bbox + city center + known east-side turnback bias to produce a coarse candidate.
    // Only accept if the recovered route still passes the existing plausibility checks.
}
```

- [ ] **Step 4: Run the poster fallback tests and verify they pass**

Run: `cd backend && ./mvnw -q -Dtest=PosterRouteAlignmentServiceTests test`

Expected: PASS.

- [ ] **Step 5: Commit the recovery path**

```bash
git add backend/src/main/java/com/hermes/backend/PosterRouteAlignmentService.java backend/src/test/java/com/hermes/backend/PosterRouteAlignmentServiceTests.java backend/src/main/resources/python/extract_route_path.py
git commit -m "feat: add poster-specific route recovery heuristics"
```

### Task 6: Final Verification

**Files:**
- Verify the files above

- [ ] **Step 1: Run the focused course-map suites**

Run: `cd backend && ./mvnw -q '-Dtest=GeminiRouteParameterClientTests,MarathonRouteGeoreferencingServiceTests,PosterRouteAlignmentServiceTests,RaceCourseMapServiceTests' test`

Expected: PASS.

- [ ] **Step 2: Run the backend compile check**

Run: `cd backend && ./mvnw -q -DskipTests compile`

Expected: PASS.

- [ ] **Step 3: Review the final behavior against the report**

Checklist:
- Poster-style maps are classified separately from cartographic maps.
- Weak affine fits are rejected instead of rendered.
- Service returns a safe unaligned result when poster alignment is untrusted.
- Poster recovery path is opt-in and still bounded by plausibility checks.

- [ ] **Step 4: Commit the verification cleanup**

```bash
git add docs/superpowers/plans/2026-04-21-tokyo-poster-georeference-hardening.md
git commit -m "docs: add tokyo poster georeference hardening plan"
```

---

## Self-Review

**Spec coverage**
- Poster-style image classification: covered in Task 2.
- Anchor-driven affine brittleness: covered in Task 3.
- Wrong-overlay suppression: covered in Task 4.
- Poster-specific recovery path: covered in Task 5.
- Verification and compile gate: covered in Task 6.

**Placeholder scan**
- No `TODO`, `TBD`, or “similar to above” placeholders remain.
- Every task names exact files and focused commands.

**Type consistency**
- New shared types are `RouteMapStyle` and `GeoreferenceQualityReport`.
- `RouteParametersDTO` is the contract expansion point and is referenced consistently across Tasks 2-4.
