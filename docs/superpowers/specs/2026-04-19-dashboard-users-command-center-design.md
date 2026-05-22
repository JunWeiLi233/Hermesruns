# Dashboard Users Command Center Design

Date: 2026-04-19
Surface: `frontend/src/pages/Dashboard.jsx` -> `/dashboard/users`
Status: approved in chat, implementation in progress

## Goal

Redesign the admin users tab into a stronger Hermes-adapted command center that tells a roster story first, then transitions into operator actions and the working table.

## Preserve

- keep the existing admin sidebar, topbar, and route-driven `/dashboard/users` shell
- keep real data wiring from `/api/admin/users`, `/api/admin/queues`, saved filters, notes, impersonation, export, and bulk actions
- keep the users table as the primary working surface after the hero and KPI layers
- keep the redesign within the Hermes Kinetic Editorial system instead of introducing a disconnected visual dialect

## Chosen Direction

Use the "roster command deck" layout direction.

Why:
- it best matches the approved "roster story first" hierarchy
- it balances growth and access signals without letting queue pressure dominate the page
- it stays closest to a real operator console once the hero is scanned

## Structure

1. Hero
   Show the roster story in a dominant dark command-center hero:
   - total users
   - visible Pro mix
   - visible admin coverage
   - recent visible signup momentum

2. Operator KPI band
   Show balanced roster-operation cards for:
   - recent signup issues
   - billing exceptions
   - selected users for bulk actions
   - current filter pressure / filtered results

3. Command strip
   Keep search, role filter, queue filter, refresh, save-filter, and export actions in one integrated control band.

4. Bulk actions band
   Keep grant Pro, revoke Pro, and soft delete in a dedicated action deck tied to current selection count.

5. Premium roster table
   Restyle the users table into a denser editorial roster board with:
   - stronger email / identity hierarchy
   - role and tier badges
   - cleaner action treatment
   - page summary and pagination preserved

6. Saved filter lane
   Keep saved filters visible on the users surface, but fold them into the command-center composition rather than leaving them in a generic shared footer.

## Testing

- dashboard smoke tests for route shell and kinetic shell must still pass
- frontend build must pass
- frontend runtime sync verification must run before claiming the website changed
