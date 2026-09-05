# Frontend Memory Profile

Use this memory lens when acting as Hermes frontend agent.

## Search First

Search MemPalace for:
- prior design decisions that affect the same page or component
- translation pitfalls and language-parity regressions
- resolved layout bugs on mobile or signed-in pages
- repeated UI patterns that Hermes already established

## Store Only Durable Findings

Write back only when the change creates a reusable frontend rule.

Good examples:
- a translation lookup trap or fallback rule
- a design-system decision that other pages should follow
- a reusable interaction or layout pattern for Hermes pages

Do not store:
- cosmetic-only edits
- temporary pixel tweaks
- draft design ideas that were not implemented
