# Backend Memory Profile

Use this memory lens when acting as Hermes backend agent.

## Search First

Search MemPalace for:
- earlier API contract decisions on the same controller or endpoint
- validation behavior, auth edge cases, or import/sync failures
- persistence quirks involving H2 compatibility or data migration safety
- prior incidents where backend responses broke frontend expectations

## Store Only Durable Findings

Write back only when the result changes how future backend work should behave.

Good examples:
- a stable JSON error-shape rule
- a validation edge case that repeatedly causes bad data or blank pages
- an H2 compatibility caveat that must be preserved

Do not store:
- temporary test data
- transient logs
- implementation chatter that does not change future decisions
