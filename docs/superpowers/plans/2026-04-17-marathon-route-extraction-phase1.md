# Marathon Route Extraction Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first internal-only scaffold for marathon course image extraction by adding a Spring Boot Gemini parameter-extraction service and a callable Python CLI for color masking, skeletonization, and ordered pixel-path extraction.

**Architecture:** Add a new bounded backend slice next to the existing race course-map flow instead of extending `RaceCourseMapService` directly. Java owns orchestration, Gemini structured-output parsing, and Python process invocation; Python owns image masking, skeletonization, and pixel-path ordering.

**Tech Stack:** Spring Boot 4 / Java 17, Jackson, RestTemplate, JUnit 5, Python 3, OpenCV, NumPy, scikit-image

---

### Task 1: Plan And Shared State

**Files:**
- Create: `docs/superpowers/plans/2026-04-17-marathon-route-extraction-phase1.md`
- Modify: `.ai-sync/AGENT_SYNC.md`

- [ ] **Step 1: Record the active implementation plan**

Create this plan file with the scoped Phase 1 architecture, bounded tasks, and verification commands.

- [ ] **Step 2: Claim the work unit**

Add an `Active Claims` entry to `.ai-sync/AGENT_SYNC.md` for the marathon route extraction Phase 1 scaffold and list the owned files/modules.

### Task 2: Step 1 Gemini Route Parameters

**Files:**
- Create: `backend/src/main/java/com/hermes/backend/RouteParametersDTO.java`
- Create: `backend/src/main/java/com/hermes/backend/RoutePixelPointDTO.java`
- Create: `backend/src/main/java/com/hermes/backend/RoutePathExtractionResultDTO.java`
- Create: `backend/src/main/java/com/hermes/backend/GeminiRouteParameterClient.java`
- Create: `backend/src/main/java/com/hermes/backend/MarathonRouteExtractionService.java`
- Test: `backend/src/test/java/com/hermes/backend/GeminiRouteParameterClientTests.java`
- Test: `backend/src/test/java/com/hermes/backend/MarathonRouteExtractionServiceTests.java`

- [ ] **Step 1: Write the failing Gemini client test**

Add a test that mocks `RestTemplate`, feeds a strict Gemini JSON response, and expects parsed `routeHexColor` plus exactly four anchor strings.

- [ ] **Step 2: Run the Gemini client test to verify it fails**

Run: `cmd /c "set MAVEN_OPTS=-Xmx256m -Xms128m && cd /d backend && mvnw.cmd -q -Dtest=GeminiRouteParameterClientTests test"`
Expected: FAIL because the client and DTOs do not exist yet.

- [ ] **Step 3: Write the minimal DTOs and Gemini client**

Implement DTOs and a focused client that:
- uses existing `app.ai.*` config
- sends the marathon-map prompt plus inline image bytes
- requests JSON output
- parses the returned text into `RouteParametersDTO`

- [ ] **Step 4: Run the Gemini client test to verify it passes**

Run: `cmd /c "set MAVEN_OPTS=-Xmx256m -Xms128m && cd /d backend && mvnw.cmd -q -Dtest=GeminiRouteParameterClientTests test"`
Expected: PASS

- [ ] **Step 5: Write the failing orchestration-service test**

Add a service test that:
- writes a temporary PNG
- stubs the Gemini client result
- stubs the Python process result
- expects a combined `RoutePathExtractionResultDTO`

- [ ] **Step 6: Run the orchestration-service test to verify it fails**

Run: `cmd /c "set MAVEN_OPTS=-Xmx256m -Xms128m && cd /d backend && mvnw.cmd -q -Dtest=MarathonRouteExtractionServiceTests test"`
Expected: FAIL because the service/process wrapper is incomplete.

- [ ] **Step 7: Write the minimal orchestration service**

Implement a service that:
- accepts image bytes or a file path
- calls `GeminiRouteParameterClient`
- invokes the Python CLI wrapper
- returns a combined internal result object

- [ ] **Step 8: Run the orchestration-service test to verify it passes**

Run: `cmd /c "set MAVEN_OPTS=-Xmx256m -Xms128m && cd /d backend && mvnw.cmd -q -Dtest=MarathonRouteExtractionServiceTests test"`
Expected: PASS

### Task 3: Step 2 Python Route Skeleton CLI

**Files:**
- Create: `backend/src/main/resources/python/extract_route_path.py`
- Create: `backend/src/main/resources/python/requirements-route-extraction.txt`
- Test: `backend/src/main/resources/python/test_extract_route_path.py`

- [ ] **Step 1: Write the failing Python CLI test**

Add a focused test that creates a tiny synthetic image with a colored route, runs the module entrypoint, and expects JSON containing ordered pixel points.

- [ ] **Step 2: Run the Python CLI test to verify it fails**

Run: `python -m pytest backend/src/main/resources/python/test_extract_route_path.py -q`
Expected: FAIL because the script does not exist yet or does not implement the CLI contract.

- [ ] **Step 3: Write the minimal Python CLI**

Implement:
- `--image` and `--route-hex-color` arguments
- BGR/HSV mask generation around the requested color
- skeletonization via `skimage.morphology.skeletonize`
- ordered coordinate extraction over the skeleton graph
- JSON stdout with `points` and small diagnostic fields

- [ ] **Step 4: Run the Python CLI test to verify it passes**

Run: `python -m pytest backend/src/main/resources/python/test_extract_route_path.py -q`
Expected: PASS when OpenCV and scikit-image are installed; otherwise fail with missing dependency evidence and keep the scaffold honest.

### Task 4: Focused Verification

**Files:**
- Modify: `.ai-sync/AGENT_SYNC.md`

- [ ] **Step 1: Run the focused backend test suite**

Run: `cmd /c "set MAVEN_OPTS=-Xmx256m -Xms128m && cd /d backend && mvnw.cmd -q -Dtest=GeminiRouteParameterClientTests,MarathonRouteExtractionServiceTests test"`
Expected: PASS

- [ ] **Step 2: Run backend compile**

Run: `cmd /c "set MAVEN_OPTS=-Xmx256m -Xms128m && cd /d backend && mvnw.cmd -q -DskipTests compile"`
Expected: PASS

- [ ] **Step 3: Run the focused Python verification**

Run: `python -m pytest backend/src/main/resources/python/test_extract_route_path.py -q`
Expected: PASS if dependencies are installed, otherwise fail with clear missing-package output that is reported honestly.

- [ ] **Step 4: Update shared state**

Move the claim out of `Active Claims`, add a compact `Recently Completed` entry, and note any dependency blocker if Python packages remain unavailable.
