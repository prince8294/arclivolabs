# Arclivo Labs Test Results

Date: 2026-10-07 (Asia/Calcutta)

## Automated commands

- `npm run typecheck`: PASS
- `npm test`: PASS after final retest; 18 tests expected, 0 failed
- `npm run lint`: PASS with 0 errors and 265 warnings in the final full run
- `npm run build`: PASS; 115/115 static-generation steps and 164 page modules represented in the application route tree
- `npm run test:e2e`: NOT RUN; script is not defined and Playwright is not installed
- `npm run audit:routes`: PASS; 164 route paths and 63 literal application links checked, 0 unmatched
- Declared-route coverage: PASS; 80/80 literal Admin/Marketing/Employee/Client destinations have page modules, 0 missing
- `npm run audit:interactions`: PASS; 297 TSX files checked, 0 handlerless buttons, missing link targets, or nested forms detected

## Unit coverage executed

- Integer minor-unit conversion
- Percentage application and rounding
- Invoice unpaid/partial/paid settlement
- Negative outstanding prevention
- Transaction-reference normalization
- Processed payment status reservation contract
- Attendance duration, including overnight sessions
- Negative attendance duration rejection
- Company-timezone date calculation
- Working-day leave calculation with holidays/weekends
- Half-day leave calculation
- Invalid date and invalid multi-day half-leave rejection
- Admin/employee file-version authorization after project access
- Client file-version ownership and visibility restriction
- Archived-file and Marketing-role version denial
- Employee/Marketing create-schema composition under Zod v4
- Password confirmation and percentage-commission refinements after schema composition

## HTTP and runtime checks

- Public health: 200
- Login page: 200
- Unauthenticated portal access: 307 to login
- Unauthenticated report export: 403
- Unauthenticated private file/receipt endpoints: 401 or login redirect
- Authenticated Admin invalid IDs: controlled 400/404
- Authenticated malformed upload: 400
- Authenticated invalid parent-file version upload: controlled 400
- Authenticated Admin CSV exports: five of five returned 200
- Role route crawl: 141 requests, 0 server errors
- Active Admin: 88/88 static and placeholder-dynamic routes returned 200
- Active Marketing: 14/14 static and placeholder-dynamic routes returned 200
- Inactive Employee: 22/22 routes returned controlled 307 denial
- Client account without an active profile: 17/17 routes returned controlled 307 denial
- Admin browser login: PASS; redirected to `/admin`
- Admin notification bell target: PASS; `/admin/notifications` rendered in authenticated dashboard markup
- User-menu account placeholder removed; Clients link to `/client/profile`, internal roles link to `/change-password`
- Runtime server log after final role/API crawl: clean (no Zod composition crash, duplicate-index warning, or client-profile exception)
- Browser console errors/warnings on key Admin pages: 0
- New-page production runtime: Admin proposals, proposal creation and communication plus seven Marketing proposal/communication/follow-up/meeting/performance pages returned 10/10 HTTP 200 with no embedded render error
- Client portal pages compile and enforce the active-profile guard; the available Client login correctly returns 307 because it has no active Client profile fixture

## Responsive browser checks

Viewport widths: 375, 768, 1280, and 1920 pixels.

Pages checked at every width:

- Admin Dashboard
- Payments
- Attendance
- Support
- Sales Report
- Settings

Result: 24 page/viewport combinations had no document-level horizontal overflow. The mobile menu trigger was visible at 375/768, hidden at 1280/1920, and opened the Admin navigation successfully.

## Database read-only checks

- MongoDB ping: PASS
- Duplicate processed payment groups: 0
- Verified payment/allocation mismatches: 0
- Receipt/payment amount mismatches: 0
- Invoice/allocation balance mismatches: 0

The business collections are empty, so these are structural/empty-state checks rather than populated-data acceptance tests.

## Blocked or not run

- Full Lead → Payment → Receipt → Commission journey: BLOCKED, no isolated seeded business data.
- Employee role E2E: BLOCKED, no active Employee user.
- Client role E2E: BLOCKED, active Client user has no active Client profile.
- Cross-client and cross-employee IDOR tests using two users per role: BLOCKED, fixtures absent.
- Live quotation/invoice/receipt PDF content and A4 visual review: BLOCKED, records absent.
- Live Cloudinary upload/download/version workflow: BLOCKED, safe provider test environment not established.
- Destructive rejection/reversal/concurrency tests: BLOCKED, dedicated test database not configured.
