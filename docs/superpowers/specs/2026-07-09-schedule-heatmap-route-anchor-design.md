# Schedule Heatmap Route Anchor

## Goal

Make Schedule's recommended route start in the runner's all-time highest-use running area, rather than using only the latest activity's first GPS point. The generated route must remain a runner-owned, street-graph-backed route matched to the current scheduled distance.

## Design

Add an authenticated `GET /api/route/plan/anchor` endpoint. It will read only the requesting runner's recorded `RUN` GPS points, using the same ownership boundary as `/api/profile/heatmap`.

The server will aggregate all valid GPS points into approximately 100 m geographic cells. A cell's primary score is the number of distinct activities that cross it; raw points are only a tie-breaker. This prevents a single long or densely recorded activity from overpowering places the runner visits repeatedly. The endpoint returns the winning cell's centroid, its activity count, and `source: "heatmap-hotspot"`. It returns an empty result when no valid heatmap point exists.

Schedule will request this anchor before auto-planning. When present, it becomes `startLat` and `startLng` for `POST /api/route/plan`; otherwise, Schedule keeps the current most-recent GPS-run fallback. The scheduled workout continues to determine target distance, and the runner's recent runs continue to determine elevation preference. Generated routes retain the chosen anchor in local state so they satisfy the runnable-route predicate immediately, before the next `/api/route/plan/recent` load.

## Contracts

- The anchor API never exposes another runner's activity IDs or coordinates.
- A heatmap anchor is advisory only. Route planning still rejects non-street-graph routes and Schedule only recommends a route with valid start coordinates, route geometry, positive distance, and a close distance match.
- Failure, an empty heatmap, or an invalid anchor falls back to the most recent GPS-backed run without blocking Schedule.
- `route_planner_source` will describe the heatmap-based anchor in both English and Simplified Chinese.

## Verification

- Add backend tests proving repeated activity coverage wins over a single dense activity and invalid coordinates are ignored.
- Add a Schedule smoke assertion for the heatmap-anchor request and fallback.
- Run targeted backend tests, frontend smoke test, frontend lint, production build, and frontend runtime-sync verification.
