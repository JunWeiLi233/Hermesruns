# Backend test completion follow-up — 2026-10-21

This follow-up covers the remaining coaching and native Windows storage-validator failures discovered by the hardening full-suite run. Activity pagination implementation and its focused checks are recorded separately by the coordinating agent. Existing unrelated working-tree edits were preserved.

## Diagnosis and changes

The clean focused reproduction used `backend/target-completion-backend` and reproduced **61 tests, 9 failures, 1 error, 0 skips**. Evidence: `output/completion-backend-focused-before.log`.

- `AutomatedCoachPersonaBoundaryTests` assumed that `/api/coach/today` retained elapsed-window or manually seeded cached volumes. The current service refreshes those fields from fresh account-calendar planner history, already covered by `AutomatedCoachServiceTests.recommendationsUseFreshHistoryInsteadOfAnUndatedAggregateCache`. The fixture now independently calculates calendar totals without substituting elapsed totals when they are zero. It checks that state and planner history share those totals while preserving exact elapsed 14-day persona boundaries, DST cases, future exclusion, and persisted activity immutability. Stale cached tiny volumes must be replaced by measured history. Four additional cases exercise the existing one-decimal measured-volume rounding and resulting persona without changing the production threshold or rounding policy.
- `TrainingMetricsImportFlowTests.parallelFirstUseRequestsCreateOneUsableCoachState` expected a numeric onboarding/rest recommendation despite having no history. Existing planner and shared-evidence contract tests require `history_required`. The concurrency test now asserts that exact reason, a null prescribed distance, and zero weekly target, while retaining the concurrent state uniqueness assertions.
- `ProductionSecurityValidatorTests` supplied `/data`, which is a Linux absolute path but a drive-relative rooted path under Java's native Windows filesystem provider. The validator intentionally requires native absolute paths. Portable `@TempDir` mount fixtures now test the same relative, outside, traversal, and sibling-prefix rejection cases, along with a valid descendant. A new case rejects the native filesystem root as a persistent mount.

Only tests and this report were changed for these failures. No production coaching, training safety, numerical policy, or security-validator logic was altered. No live database, runtime restart, deployment, commit, or external account action was used.

## Verification

- Focused command, from `backend`: `.\mvnw.cmd -Dhermes.build.directory=target-completion-backend -Dtest=AutomatedCoachPersonaBoundaryTests,TrainingMetricsImportFlowTests,ProductionSecurityValidatorTests,AutomatedCoachServiceTests,AutomatedCoachClockTests,PersonalizedRunningPlannerTests,SharedRecommendationEvidenceTests test`.
- **119 tests in 7 suites passed, 0 failures, 0 errors, 0 skips.** Evidence: `output/completion-backend-focused-after.log` and `backend/target-completion-backend/surefire-reports/`.
- Full command, from `backend`: `.\mvnw.cmd -Dhermes.build.directory=target-completion-backend test`.
- **Full suite passed: 2,534 tests reported across 305 suites, 0 failures, 0 errors, 33 skips; 2,501 tests executed successfully.** Maven reported `BUILD SUCCESS` in 4 minutes 38 seconds. Evidence: `output/completion-backend-full.log`, including the summary at line 8226 and success at line 8229, and the XML reports in `backend/target-completion-backend/surefire-reports/`. An independent sum of the XML suite counts matched Maven exactly. The full run includes the stable activity-pagination source and its new unit/integration coverage.
- The 33 skips are in `ExplorerBackendIntegrationTests` (16), `ExplorerProductE2eTests` (1), `RecordedHeatmapIntegrationTests` (13), `ActivityPointLatestLocationQueryTests` (1), `WellnessProviderSchemaInitializerTests` (1), and `MarathonRouteExtractionServiceTests` (1). No test was disabled or skipped by this follow-up.
- An earlier full invocation was stopped during test compilation to wait for the parallel pagination edits; the completed command above then overwrote its log with the complete combined result.

The parallel admin source-contract repairs and their 57-file passing result are recorded in [test-pagination-admin-followup.md](test-pagination-admin-followup.md).
