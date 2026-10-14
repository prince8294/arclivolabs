<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Conventions

## Stack
- Next.js App Router + Turbopack (default in this version), TypeScript, Tailwind CSS v4 (CSS-first config, no `tailwind.config.ts`).
- MongoDB via Mongoose. Always use `src/lib/db/mongoose.ts` for the connection (never create another connection utility).
- `src/models` for Mongoose schemas, `src/types` for shared TS types, `src/lib/constants` for app-wide constants, `src/config/app.ts` for app metadata.

## Roles & Portals
- Roles live in `src/types/auth.ts` (`USER_ROLES`, `UserRole`): ADMIN, MARKETING, EMPLOYEE, CLIENT.
- Each role has a portal under `src/app/<role>/` with a protected layout that renders `DashboardShell` (sidebar + topbar).
- Navigation is defined in `src/lib/constants/navigation.ts`; routes in `src/lib/constants/routes.ts`.

## Authentication (Part 3)
- Sessions are signed JWTs (`jose`, HS256, `AUTH_SECRET`) in an HTTP-only cookie `arclivo_session`; 7-day expiry enforced server-side. No remember-me, no public registration, no password reset yet.
- Three enforcement layers (all server-side): `src/proxy.ts` (cookie check on every request — layouts are cached across client-side navigations, so the proxy covers those), role layouts via `requireRole`, and per-page `requireRole` re-checks.
- `getCurrentUser()` (`src/lib/auth/current-user.ts`) re-reads the User document on every request — suspensions and role changes apply immediately; it returns `null` (fail closed) when the DB is unreachable.
- Login/logout are Server Actions (`src/lib/actions/auth.ts`). Login returns one generic "Invalid email or password." for unknown email AND wrong password (no account enumeration).
- `passwordHash` is `select: false` on the User schema; only login explicitly requests it (`.select('+passwordHash')`).
- Initial admin: `npm run seed:admin` (reads `SEED_ADMIN_NAME/EMAIL/PASSWORD` + `MONGODB_URI` from `.env.local`; idempotent; never logs the password).
- Rate limiting on login is a documented future improvement, not yet implemented.

## Admin User Management (Part 4)
- Admin screens under `/admin/employees` and `/admin/marketing` (list with server-side search/filter/pagination, `new`, `[id]` detail, `[id]/edit`). URLs are keyed by USER id; all admin mutations are Server Actions in `src/lib/actions/admin-users.ts` that start with `requireRole(ADMIN)`.
- Admin can manage EMPLOYEE + MARKETING accounts only. No admin-creation UI, no client-creation UI, no hard delete (lifecycle: ACTIVE ↔ SUSPENDED, INACTIVE for ended engagements; marking INACTIVE also moves the profile to its terminal status).
- Account + profile creation is atomic: MongoDB transaction when available (probe cached in `areTransactionsSupported()`), otherwise documented manual rollback (delete the orphaned User if the profile write fails).
- Readable codes (`EMP-0001`, `MKT-0001`) come from the reusable `Counter` model + `generateSequentialCode(key, prefix)` (`src/lib/db/generate-code.ts`) — an atomic `findOneAndUpdate($inc, upsert)`; never `countDocuments()+1`.
- New accounts and admin password resets set `User.mustChangePassword`; `requireRole` then routes the user to `/change-password` (verify current + new + confirm) before any portal page renders.
- Salary (`Employee.baseAmount`, `select: false`) and marketing commission data are admin-only in this phase; list rows never include them.

## Lead Communication & Meetings (Part 5)
- Communication and Meeting models live in `src/models`. Communications are immutable; meetings are mirrored into the Communication timeline for audit.
- Server Actions in `src/lib/actions/communications.ts` and `src/lib/actions/meetings.ts` handle all mutations with role checks and ownership re-verification.
- Internal notes always use `visibility=INTERNAL` and are excluded from client-facing views.
- Marketing ownership is re-verified on every read/write; a lead reassigned away immediately stops returning data to the former owner.
- Transactions are used where supported, with manual compensation fallback documented in the action files.
- Lead detail pages (`/admin/crm/leads/[id]` and `/marketing/leads/[id]`) now use tabbed routing (`overview`, `communication`, `followups`, `meetings`) via `LeadSectionTabs`.
- Communication timeline (`CommunicationTimeline`) supports server-backed pagination, type filters, and sort with shareable URL state.
- Meetings (`MeetingList`, `MeetingCard`, `MeetingActions`) split into upcoming and past, capped server-side, with lifecycle actions (complete, cancel, no-show).
- Marketing and admin dashboards now show real `ActivityFeed` data instead of placeholders.
- Follow-up actions (`FollowUpActions`) allow scheduling and completing follow-ups with optional lead status changes.

## Testing
- No test runner configured. Verify with `npm run lint` and `npm run build`.
- Manual smoke test: seed admin, run `next start` (or `npm run dev`), then check `/` (redirects to `/login` or the role dashboard), `/login`, `/api/health`. For Part 4: create an employee at `/admin/employees/new`, verify `EMP-0001` + detail notice, suspend/reactivate, reset password, then sign in as that employee and verify the forced `/change-password` flow.
