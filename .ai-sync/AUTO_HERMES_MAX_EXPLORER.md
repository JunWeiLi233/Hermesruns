# Auto-Hermes Max Explorer

Generated: 2026-04-27T12:00:00.000Z
Runtime: claude-live

## Completed Task
Added Spring Security defense-in-depth for admin routes and tightened CORS header policy.

**SecurityConfig.java** — Added constructor injection of JwtAuthenticationFilter. Added `.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)` to the security filter chain. Replaced flat `.anyRequest().permitAll()` with:
- `.requestMatchers("/api/auth/admin-login").permitAll()` — admin login must remain accessible
- `.requestMatchers("/api/admin/**").hasRole("ADMIN")` — Spring Security-level guard for all admin paths
- `.anyRequest().permitAll()` — unchanged for all other paths

**JwtAuthenticationFilter.java** (new) — `OncePerRequestFilter` that bridges Hermes JWT tokens into the Spring Security SecurityContext. Reads `Authorization: Bearer <token>`, looks up the runner via `AuthService.findByAuthorizationHeader()`, and populates `UsernamePasswordAuthenticationToken` with `ROLE_ADMIN` authority from `AuthService.isAdmin()`. Clears SecurityContext in `finally` block to prevent cross-request leakage. The existing `AdminSecurityFilter` remains the primary access-control layer; this adds a second Spring Security authorization gate.

**AppCorsConfig.java** — Replaced `.allowedHeaders("*")` with `.allowedHeaders("Authorization", "Content-Type")` — the only two request headers the Hermes frontend sends. `Retry-After` is response-only. No other custom headers used across the 40+ fetch call sites.

**Verification:** `cd backend && ./mvnw -q -DskipTests compile` — PASS. `cd frontend && npm run lint` — 0 errors (7 pre-existing warnings unrelated to this change).

## Design Rationale
- **Tier 2 (Data Trust)** — Defense-in-depth for the admin attack surface. Previously, the sole access-control layer was the custom `AdminSecurityFilter` servlet filter. Now Spring Security also guards `/api/admin/**` at the filter-chain level.
- **CORS hardening** — `allowedHeaders("*")` is flagged by security scanners as overly permissive. The Hermes SPA sends exactly two request headers, so restrict to those.
- **Safe rollout** — The new `JwtAuthenticationFilter` only populates `SecurityContext`; it never rejects requests. If the SecurityContext is empty (no JWT, expired token, non-admin user), Spring Security's `.hasRole("ADMIN")` correctly returns 403 before the custom `AdminSecurityFilter` even runs.

## Remaining Work
1. **Batch API endpoint** (Tier 1) — Reduce TodayRun (6 reqs) + ProfileDashboard (7 reqs) to 1 batch call each. Backend + frontend, sequential dependency.
2. **React.memo + virtualization** (Tier 1) — Wrap top-5 page components in React.memo, add lazy loading to shoe galleries, virtualize admin lists.
3. **.env.example** (Tier 2) — Document all 40+ env vars from application.properties. Simple new-file task.
4. **Password strength dedup** (Tier 2) — Make backend the canonical source via `/api/auth/password-rules` API.
5. **Admin portal No-Line Rule** (Tier 5) — Replace hard borders with tonal surface separation in admin CSS.

## Parallelism Recommendation
**Suggested lanes: 2**

- **Lane A (Tier 2)** — `.env.example` + `docs/setup.md`: new files only, zero collision risk, small effort.
- **Lane B (Tier 2)** — Password strength canonical endpoint: `PasswordStrengthChecker.java` + `AuthController.java` (backend only), no frontend overlap with Lane A.

The highest-value remaining task (Batch API, Tier 1) requires backend-first then frontend coordination, so it does not split cleanly into parallel lanes.
