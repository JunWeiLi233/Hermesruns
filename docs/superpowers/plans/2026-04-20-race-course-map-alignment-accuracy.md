# Race Course Map Alignment Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `RaceCourseMapService` so course-map discovery and alignment are more accurate, more resilient to race-site variations, and able to optionally snap AI routes to roads with OSRM.

**Architecture:** Keep `RaceCourseMapService` as the pipeline owner, but strengthen each stage of the existing flow: candidate discovery, prompt construction, PDF rendering, threshold fallback, plausibility checks, and post-alignment snapping. Reuse the existing `OsrmMapMatchingClient` rather than inventing a second snapping client.

**Tech Stack:** Spring Boot service code, RestTemplate mocks, PDFBox, existing `RaceCourseMapServiceTests`, existing `OsrmMapMatchingClient`, JUnit 5, Mockito.

---

### Task 1: Add failing tests for the new discovery and prompt rules

**Files:**
- Modify: `backend/src/test/java/com/hermes/backend/RaceCourseMapServiceTests.java`

- [ ] **Step 1: Add a failing test for the richer alignment prompt**
- [ ] **Step 2: Add a failing test for the expanded search queries and official URL patterns**
- [ ] **Step 3: Run the focused test command and confirm the new assertions fail for the expected reasons**

Run: `cd backend && ./mvnw test -Dtest=RaceCourseMapServiceTests`

### Task 2: Add failing tests for PDF paging, adaptive confidence, and centroid tightening

**Files:**
- Modify: `backend/src/test/java/com/hermes/backend/RaceCourseMapServiceTests.java`

- [ ] **Step 1: Add a failing test proving later PDF pages can be used**
- [ ] **Step 2: Add a failing test for the 55+ confidence adaptive retry path**
- [ ] **Step 3: Add a failing test for the 10 km centroid gate when race coordinates are known**
- [ ] **Step 4: Run the focused test command and confirm failure stays tied to missing behavior**

Run: `cd backend && ./mvnw test -Dtest=RaceCourseMapServiceTests`

### Task 3: Add failing tests for OSRM snapping

**Files:**
- Modify: `backend/src/test/java/com/hermes/backend/RaceCourseMapServiceTests.java`

- [ ] **Step 1: Add a failing test that the resolved route uses snapped coordinates when OSRM succeeds**
- [ ] **Step 2: Add a failing test that the service falls back to unsnapped points if OSRM throws**
- [ ] **Step 3: Run the focused test command and confirm the new OSRM assertions fail before implementation**

Run: `cd backend && ./mvnw test -Dtest=RaceCourseMapServiceTests`

### Task 4: Implement the RaceCourseMapService upgrades

**Files:**
- Modify: `backend/src/main/java/com/hermes/backend/RaceCourseMapService.java`

- [ ] **Step 1: Expand candidate discovery and scoring**
- [ ] **Step 2: Enrich the alignment prompt with race-specific context from the fields that actually exist in Hermes**
- [ ] **Step 3: Raise `MAX_CANDIDATES` and add the 200x200 candidate pre-filter**
- [ ] **Step 4: Add the adaptive confidence retry path**
- [ ] **Step 5: Render PDF pages 0-2 at 200 DPI**
- [ ] **Step 6: Tighten centroid plausibility when race coordinates are known**
- [ ] **Step 7: Improve Bing query specificity**
- [ ] **Step 8: Integrate optional OSRM snapping through `OsrmMapMatchingClient`**

### Task 5: Verify and review

**Files:**
- Verify the service and test files above

- [ ] **Step 1: Re-run the focused `RaceCourseMapServiceTests` suite**
- [ ] **Step 2: Run a backend compile check**
- [ ] **Step 3: Review the final diff for truthfulness and fallback safety**

Run:
- `cd backend && ./mvnw test -Dtest=RaceCourseMapServiceTests`
- `cd backend && ./mvnw -q -DskipTests compile`
