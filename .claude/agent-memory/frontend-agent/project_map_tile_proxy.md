---
name: Map tile source strategy
description: OSM direct browser requests work fine; backend proxy is the fallback, not primary
type: project
---

OSM direct (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`) is the primary tile source on the race detail route map. The backend proxy at `/api/maps/tiles/{z}/{x}/{y}.png` is the fallback (triggered by `tileerror` or the 2200ms timeout).

**Why:** The prior assumption that OSM blocks direct browser requests was incorrect. OSM's CDN allows browser requests with standard User-Agent headers. Using the proxy as primary caused blank map tiles in environments where the proxy was unavailable or misconfigured, while OSM direct worked reliably. Confirmed at git history: OSM direct worked at `db49a17`; proxy-as-primary introduced the regression at `c331e7d`.

**How to apply:** In `RacesDetail.jsx`, `attachTileLayer(fallbackTileUrl)` (OSM direct) is the initial call (~line 723); `switchToFallbackTiles()` falls back to `attachTileLayer(tileUrl)` (proxy). The `tileerror` guard reads `if (url === tileUrl) return` to prevent double-fallback when already on the proxy. Do not revert this order without confirming OSM direct is broken.
