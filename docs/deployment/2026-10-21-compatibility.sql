-- PostgreSQL psql entry point. The canonical packaged migration is shared with tests.
-- Back up and rehearse first; this migration contains its own transaction.
\set ON_ERROR_STOP on
\ir ../../backend/src/main/resources/db/compatibility/V001__runtime_schema.sql
