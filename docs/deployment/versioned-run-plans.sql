-- RETIRED: this historical proposal has narrower CHECK constraints than the running application.
-- Do not apply it to a new or existing deployment.
-- Use backend/src/main/resources/db/training/V001..V005 through the reviewed release process.
-- See docs/deployment/pr178-release-manifest.md for prerequisites and checksum handling.
DO $$ BEGIN
    RAISE EXCEPTION 'Retired run-plan proposal: use the PR178 release manifest and canonical versioned migrations';
END $$;
