---
paths:
  - "frontend/src/**/*.jsx"
  - "frontend/src/**/*.js"
  - "frontend/src/**/*.css"
---

# Frontend Rules
- Match existing React 19 + Vite patterns in this repo.
- Preserve routing and auth flows wired through `frontend/src/App.jsx`, contexts, and page components.
- Prefer shared UI components in `frontend/src/components` before creating new one-off wrappers.
- Keep charts and Leaflet views readable on mobile and desktop.
- Do not introduce a new design system or styling paradigm unless the task asks for it.
