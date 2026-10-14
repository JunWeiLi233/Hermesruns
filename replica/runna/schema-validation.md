# Schema validation record

Date: 2026-10-13.

`schema.sql` executed successfully on a newly initialized, disposable PostgreSQL **17.10** cluster bound to an ephemeral port on **127.0.0.1**. The cluster was separate from Hermes's existing server/database, and was stopped after checks. The fixture provided only the prerequisite `runner(id)` and `activities(id, runner_id)` tables.

The accompanying `schema-checks.sql` is reproducible with psql **only against a new, empty disposable database**. It creates fixture tables and includes the proposed DDL. It must not be run against an application database.

Automatic approval review blocked removal of the stopped cluster's temporary files, giving only “blocked by policy.” The directory remains at `C:\Users\Junwei\AppData\Local\Temp\runna-schema-d213fc0b5afe415d9c9b632c69c6f952`. No alternate removal was attempted.

Verified:

- All nine new tables, their foreign keys, indexes, checks, and update triggers were created successfully.
- A second active plan for one runner and a second active version for one plan were rejected.
- Cross-owner plan versions and activity links were rejected by compound foreign keys.
- A step with both duration and distance targets was rejected; an effort-based timed step was accepted.
- Reusing an owner's manual-save UUID was rejected by uniqueness.
- A UTC instant near midnight resolved to the stored New York capture date.
- Deleting an activity removed its link while preserving the receipt, owner, and deleted replay marker.
- Archiving the old plan permitted activation of its replacement.
- Hard owner deletion cascaded through plan, step, and receipt rows.
- Document structure: nine flow tables, 34 unique method/path pairs (10 existing, 24 proposed), and valid screen/flow references. All 44 feature implementation statuses remain `no`.

These are database/structure checks, not application tests. The fixture does not establish compatibility with every existing Hibernate mapping or production migration state. Authentication, soft-delete purging, ETags, API idempotency responses, lifecycle transactions, immutable payload enforcement, analytics integration, and offline sync still need implementation and targeted tests. H2 compatibility has not been tested. No product source, live schema, hosting setting, or mobile dependency was changed by this architecture stage.
