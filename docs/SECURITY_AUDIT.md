# Arclivo Labs Security Audit

Date: 2026-10-07 (Asia/Calcutta)

## Result

No known critical vulnerability remains in the code paths inspected and executed. Complete IDOR acceptance testing remains blocked by missing multi-user disposable fixtures.

## Authentication and sessions

- Signed HS256 session token with server-only secret and expiry.
- Secret length is validated at runtime.
- Session cookie is HTTP-only and secure in production.
- Current user is re-read from MongoDB for authoritative status/role checks.
- Portal proxy denies unauthenticated access and redirects wrong-role sessions.
- Browser login for the Admin fixture passed.

## Authorization and ownership

- Admin-only financial verification, settings, audit, employee-payment, commission, and reporting mutations use server-side role checks.
- Marketing CRM mutations re-check lead ownership in MongoDB.
- Client routes use the authenticated Client profile and owner-scoped queries.
- Client profile resolution returns only ACTIVE profiles, including direct file/invoice API authorization paths; missing or blocked profiles fail closed.
- Employee task/project/file actions use project/task permission helpers.
- Support internal notes are Admin-only and excluded from non-Admin reads.
- File download routes authenticate and verify access before generating delivery responses.
- New file versions must reference a parent in the same authorized project; Clients may version only their own `CLIENT_UPLOADED` files, and archived files are denied.

## Financial integrity

- Client submissions remain SUBMITTED/UNDER_REVIEW until Admin verification.
- Invoice balances use verified active allocations only.
- Over-allocation and duplicate invoice allocation are rejected.
- Payment receipts have a unique payment ID.
- Processed payment references now have both an application check and a unique partial database index covering VERIFIED and REVERSED records.
- Payment reversal invalidates the receipt, reverses allocations, reconciles invoices, and adjusts linked commissions.
- Commission payout creation now uses a transaction where supported and compensates the payout insert on standalone MongoDB if the guarded commission update fails.
- Payouts are records only; no banking API is called.

## Input and output safety

- Server actions validate roles, IDs, enums, dates, money, and resource ownership.
- Search regex values use escaping helpers.
- CSV exports neutralize spreadsheet formula prefixes.
- Uploads use explicit extension/MIME/size allowlists, validate category/visibility enums, and reject prohibited executable/script formats.
- Non-multipart upload requests return 400.
- Invalid parent IDs return controlled 400 responses before any database/provider mutation.
- Employee/Marketing account schemas load safely under Zod v4 and retain password-match and commission-range refinements.
- No `eval`, `new Function`, `dangerouslySetInnerHTML`, JavaScript URL, or credential logging pattern was found by the executed source scan.
- Password hashes are excluded by default and stripped from serialized User output.

## Auditability

- Financial, settings, support, workforce, payout, and status changes write audit or domain activity records.
- Receipts and issued invoices preserve immutable seller/customer snapshots.
- Communication, meeting, payment, payout, and reversal histories are preserved rather than deleted.

## Remaining security verification

- BLOCKED: cross-client IDOR matrix with CLIENT_A/CLIENT_B.
- BLOCKED: cross-marketing lead access with MARKETING_A/MARKETING_B.
- BLOCKED: cross-employee task mutation with EMPLOYEE_A/EMPLOYEE_B.
- BLOCKED: confidential Cloudinary delivery using a live test provider.
- VERIFIED: unit policy tests cover Admin/Employee allow rules, Client ownership/visibility rules, archived-file denial, and Marketing denial.
- REQUIRED BEFORE DEPLOYMENT: create/review the `uniq_processed_payment_reference` index through a controlled migration and check for conflicting legacy records first.
- RECOMMENDED: add automated browser/API security tests once the isolated fixture database exists.
