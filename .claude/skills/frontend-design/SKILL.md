---
name: frontend-design
description: Apply Hermes UI standards to product and marketing surfaces.
user-invocable: true
---

Use this skill when designing or refactoring Hermes UI.

Visual direction
- Keep the interface athletic, data-rich, and premium rather than generic SaaS.
- Favor strong contrast, clear hierarchy, and purposeful color over decorative gradients.
- Treat charts, tables, and maps as first-class UI, not afterthoughts.

Layout
- Design for desktop and mobile from the start.
- Use generous spacing between sections, but keep dense data views scannable.
- Prefer reusable building blocks in `frontend/src/components/ui`.

Interaction
- Forms should feel straightforward and forgiving.
- Loading, empty, and error states should explain what the runner can do next.
- Motion should be subtle and functional, especially around charts, cards, and navigation.

Implementation
- Follow existing JSX, CSS, and context patterns already present in Hermes.
- Avoid adding new UI frameworks unless the task explicitly requires it.
