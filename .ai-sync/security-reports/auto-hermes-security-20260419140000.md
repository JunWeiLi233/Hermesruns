# auto-hermes-security

Run Id: auto-hermes-security-20260419140000
Mode: audit
Status: completed
Timestamp: 2026-04-19T14:00:00Z

## Inventory

| Category | Count |
|----------|-------|
| Tables (Entities) | 22 |
| Endpoints | ~95 |
| Forms | 19 |
| Config Files | 2 |
| Admin Routes | 46 |

## Findings: 11 total (3 HIGH, 4 MEDIUM, 4 LOW)

### HIGH Severity

#### 1. Path Traversal: Arbitrary File Read via `imageFilePath` in GeminiRouteParameterClient
- **Checker**: injection-hunter
- **Target**: `GeminiRouteParameterClient.java:82-89`
- **Summary**: Admin pipeline endpoint accepts arbitrary filesystem path from request body and passes it directly to `Files.readAllBytes(Path.of(imageFilePath))`. No validation that the path is under a safe directory or that `..` sequences are blocked. An admin user could provide `/etc/passwd` or `../../../etc/shadow` to read arbitrary files from the server filesystem, which would then be sent to the Gemini API.
- **Evidence**: `Path.of(imageFilePath)` at line 82, `Files.readAllBytes(imagePath)` at line 89
- **Verification**: static-only
- **Confidence**: 0.85

#### 2. Path Traversal: Arbitrary File Read via `imageFilePath` in GeminiAnchorPixelClient
- **Checker**: injection-hunter
- **Target**: `GeminiAnchorPixelClient.java:75-82`
- **Summary**: Same pattern as Finding 1 — admin-provided `imageFilePath` reaches `Files.readAllBytes()` and `Files.isRegularFile()` without path validation or normalization. Arbitrary file exfiltration through Gemini API is possible.
- **Evidence**: `Path.of(imageFilePath)` at line 75, `Files.readAllBytes(imagePath)` at line 82
- **Verification**: static-only
- **Confidence**: 0.85

#### 3. Path Traversal: Unvalidated File Path in MarathonRouteExtractionService
- **Checker**: injection-hunter
- **Target**: `MarathonRouteExtractionService.java:34-107`
- **Summary**: The `imageFilePathOrDataUrl` from admin request body flows to filesystem reads (via GeminiRouteParameterClient and GeminiAnchorPixelClient) and to ProcessBuilder command-line arguments (via `buildPythonCommand()`). No path traversal validation is applied at any point in the chain. While `ProcessBuilder` List-based invocation prevents shell injection, the unvalidated path is passed as a CLI argument to the Python script.
- **Evidence**: `buildPythonCommand()` at lines 117-126, `imageFilePathOrDataUrl` parameter at line 34
- **Verification**: static-only
- **Confidence**: 0.80

### MEDIUM Severity

#### 4. RLS: GeneratedRaceGpxAsset Lacks Direct Runner Ownership
- **Checker**: rls-auditor
- **Target**: `GeneratedRaceGpxAsset.java`
- **Summary**: The `GeneratedRaceGpxAsset` entity has no direct `runnerId`/`userId`/`ownerId` field or `@ManyToOne` to `Runner`. Access is tied to a `raceId` rather than a user. If the controller that serves this asset does not verify that the requesting runner owns the associated race, any authenticated runner could read another runner's GPX assets by guessing race IDs.
- **Evidence**: Entity has `raceId` field but no `runnerId` FK
- **Verification**: static-only
- **Confidence**: 0.60

#### 5. RLS: RaceCourseMapAsset Lacks Direct Runner Ownership
- **Checker**: rls-auditor
- **Target**: `RaceCourseMapAsset.java`
- **Summary**: Same pattern as Finding 4 — `RaceCourseMapAsset` has `raceId` but no direct `runnerId`. Cross-user ID-guessing could allow reading another runner's course map assets if the controller doesn't enforce ownership through the race entity.
- **Evidence**: Entity has `raceId` field but no `runnerId` FK
- **Verification**: static-only
- **Confidence**: 0.60

#### 6. RLS: ShoeCatalogBrand Has No User Ownership (Intentional)
- **Checker**: rls-auditor
- **Target**: `ShoeCatalogBrand.java`
- **Summary**: `ShoeCatalogBrand` is a global catalog entity with no user ownership field. This is **intentional** — it's a shared reference catalog. Admin endpoints properly gate all write operations. No RLS issue if read access is meant to be global.
- **Evidence**: No `runnerId`, `userId`, or `ownerId` field
- **Verification**: static-only
- **Confidence**: 0.40 (likely intentional)

#### 7. AI Prompt Injection: User Data Interpolated into Gemini Prompts
- **Checker**: injection-hunter
- **Target**: `GeminiAnchorPixelClient.java:90-99`, `ShoeQueryNormalizationService.java:61`
- **Summary**: User-controlled text (shoe brand/model names, race names) is interpolated into Gemini AI prompts via `String.formatted()`. A malicious user could craft input that manipulates the AI model's behavior (e.g., extracting system prompts, causing unexpected responses). Not a code-execution risk, but a data-integrity/abuse risk.
- **Evidence**: `ANCHOR_PIXEL_PROMPT.formatted(...)`, `NORMALIZATION_PROMPT.formatted(rawInput.trim())`
- **Verification**: static-only
- **Confidence**: 0.55

### LOW Severity

#### 8. CSP Allows `unsafe-inline` for Scripts and Styles
- **Checker**: config-checker
- **Target**: `SecurityHeadersFilter.java`
- **Summary**: The Content-Security-Policy header includes `'unsafe-inline'` for both `script-src` and `style-src`. This weakens XSS protection. While common for SPAs, it allows inline event handlers and style injection. Consider using nonces or hashes.
- **Evidence**: `script-src 'self' 'unsafe-inline'`, `style-src 'self' 'unsafe-inline'`
- **Verification**: static-only
- **Confidence**: 0.70

#### 9. Admin Routes: 46 Endpoints Under `/api/admin/**`
- **Checker**: auth-tester
- **Target**: Multiple controllers
- **Summary**: 46 admin endpoints exist. All are gated by `AdminSecurityFilter` or `@PreAuthorize("hasRole('ADMIN')")`. This is informational — the filter was verified present and functional.
- **Evidence**: `AdminSecurityFilter.java`, `AdminController.java`, `AdminPortalController.java`, `ShoeImageController.java`, `ShoeCatalogController.java`
- **Verification**: static-only
- **Confidence**: 0.90

#### 10. Dynamic SQL in H2ToPostgresMigrator (Mitigated)
- **Checker**: injection-hunter
- **Target**: `H2ToPostgresMigrator.java:248-303`
- **Summary**: The migrator constructs SQL queries by concatenating table names. However, table names are whitelisted via a `switch` statement that only accepts `"runner"`, `"activities"`, or `"activity_points"`, and data values use `PreparedStatement`. This is a standalone CLI tool, not exposed via HTTP.
- **Evidence**: Switch statement at lines 248-253 and 289-293, `PreparedStatement` for data values
- **Verification**: static-only
- **Confidence**: 0.30 (effectively mitigated)

#### 11. GpxExportService XML Output Uses Text-Content Escaping
- **Checker**: injection-hunter
- **Target**: `GpxExportService.java:20-51`
- **Summary**: User-provided `raceName` and `description` are escaped via `escapeXml()` which handles `&`, `<`, `>`. Single and double quotes are not escaped, but they appear in text content (not attributes), so this is adequate for the context.
- **Evidence**: `escapeXml()` method at lines 47-51, usage at lines 28, 33
- **Verification**: static-only
- **Confidence**: 0.25 (adequate for text content)

## Security Headers Status

| Header | Present | Value |
|--------|---------|-------|
| Content-Security-Policy | Yes | Default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' ... |
| X-Content-Type-Options | Yes | nosniff |
| Referrer-Policy | Yes | strict-origin-when-cross-origin |
| X-Frame-Options | Yes | DENY |
| X-XSS-Protection | Yes | 1; mode=block |
| Strict-Transport-Security | Conditional | max-age=31536000; includeSubDomains (only when HSTS enabled) |
| Permissions-Policy | Yes | geolocation=(self), microphone=(), camera=() |

## Hard-Coded Secrets Check

**No hard-coded secrets found.** All sensitive values use `${ENV_VARIABLE:default}` or `${ENV_VARIABLE}` substitution.

## Remediation Priority

1. **Path traversal (HIGH)**: Validate `imageFilePath` in admin pipeline — restrict to safe directory, normalize paths, reject `..` sequences
2. **RLS on generated assets (MEDIUM)**: Verify that `GeneratedRaceGpxAsset` and `RaceCourseMapAsset` controller access verifies runner ownership through the parent race entity
3. **AI prompt injection (MEDIUM)**: Add escaping/delimiting for user input within Gemini prompts
4. **CSP unsafe-inline (LOW)**: Consider nonce-based CSP for script-src