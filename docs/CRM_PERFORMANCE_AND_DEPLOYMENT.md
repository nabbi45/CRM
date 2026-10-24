# CRM and HRM loading changes

The dashboard now uses `GET /dashboard/summary`. It returns calculated cards, charts,
current-month deductions and six recent bookings. It uses the existing revenue
helpers for GST, sharing, service deductions, refunds and ten payment terms. Full
booking details are fetched only when opened. The old booking/user endpoints remain
available to existing screens. Business-month grouping uses Asia/Kolkata.

HRM passes `section` to `/hrm/bootstrap`. This loads the data needed for the open
section, rather than all history. Requests, ledger transactions and team attendance
use pages of 100. Balances and ledger period summaries are aggregated over the full
eligible history, independently of pagination. Exports and locked payroll snapshots
retain their complete calculations. The legacy bootstrap response remains available
for older clients during rollout.

Operational dropdowns, HRM and dashboard calculations do not select original user
photos at all. These views use initials. Shrinking a photo after downloading it
from MongoDB did not remove the expensive database transfer. Original photos and
their profile/upload/edit endpoints are retained.

Dashboard financial source reads, company calculations and account-scoped summaries
share a bounded process-local cache (128 entries, 15-second TTL per layer). Successful
booking, approval, service, employee and user changes invalidate it on the serving
process; activity pings/login/logout do not. A generation guard prevents older reads
from repopulating it after a write. Independent server processes or external database
edits rely on TTL expiry; do not use these overview summaries as a payroll snapshot.
Authorization and disabled-account checks always read the current account and are
never cached. Browsers do not cache financial responses.

MongoDB projects only financial fields and omits empty term-share defaults before
transfer. Concurrent employee dashboards share that source read and the company
service calculation. Full booking documents are only fetched when opened. HRM's
month data is loaded once for the selected employee batch and indexed in memory;
workspace reads reuse their existing directory. Team views, monthly locking,
attendance exports and active legacy daily reads use the same batch calculation.
Transactions keep their reads sequential on their MongoDB session.

Failed CRM summary requests display a retryable error instead of zero-valued cards.
Leads retains the last loaded page during refresh, ignores superseded filter
responses, and pages at 100 with deterministic newest-first ordering. Notification
polling skips hidden tabs and overlapping polls; audio is enabled by a user gesture.

## Deployment

1. Deploy the backend first. Its build requires the repository checkout, including
   `CRM_FRONTEND/src/utils/bookingRevenue.js` and `dashboardSummary.js` which are
   shared pure calculation modules. Build from `CRM_BACKEND` with `npm run build`.
2. Deploy the frontend from `CRM_FRONTEND` using its production build. Ensure the
   hosting output directory is `CRM_FRONTEND/build` (or `build` if this is the root).
3. Static files must be served before the SPA fallback. `/crm.webmanifest?v=2` must
   return JSON, not `index.html`. The build includes both the new manifest and the
   previous `/manifest.json` for compatibility.
4. Hard-refresh an existing browser tab after the deployments.
5. Verify the backend response header `X-CRM-Read-Version: 2026-10-25` to confirm
   that this read-path fix is actually running. An old frontend asset hash alone
   cannot explain or prove the current backend performance.

New non-unique query indexes are declared for bookings, HR requests, HR ledgers and
legacy leave. The existing Mongoose configuration creates declared indexes. If
automatic index creation is disabled in production, have the database operator
create these declared indexes through the existing database deployment process.
Do not run `syncIndexes` or remove old indexes as part of this rollout.

## Production verification

Use the Network panel to check `/dashboard/summary`, `/hrm/bootstrap?section=dashboard`
and `/hrm/attendance/team`. Opening CRM should no longer request `/user/all`,
`/user/options` or `/booking/all` for dashboard calculations. Team attendance should
be one request, not one per employee. Confirm the manifest response is JSON.

Backend requests taking at least one second log `slow_api`, with route, status and
duration, without tokens or request bodies. Compare those logs with browser request
timings: a long browser delay with a short server duration indicates time before
the application handler, transport, or host startup. A long server duration requires
checking the corresponding MongoDB query and Render CPU/memory metrics. Local query
timings do not prove performance between Render and Atlas; verify deployment regions
and resource usage there before changing hosting plans.

Read-only checks during implementation found 681 bookings and 74 users; basic local
database operations were fast. Embedded user photo text totalled about 5.3 MB,
including one photo about 4.7 MB. No production records or indexes were modified by
these diagnostic checks.

## Measured regression and verification (25 October 2026, IST)

Authenticated live requests reproduced a 51.8-second dashboard response and an HRM
workspace timeout after 55 seconds. The live Leads bootstrap returned in 483 ms.
The old directory read downloaded original photos and took 53.7 seconds against
the connected database; the old workspace reloaded it and took 107.8 seconds.

The corrected code, tested locally against the same database with automatic index
creation disabled, read the directory in 340–358 ms, HRM workspace in 646–720 ms,
and the full team month in 435–492 ms. The cold projected booking source still took
about 5.5 seconds over that connection (582 KB for 674 live bookings), so cold-load
latency and Render-to-Atlas transport must be measured after deployment. These
local database measurements are not production response-time guarantees.

`npm run test:performance` in `CRM_BACKEND` creates an isolated temporary database
with 5,000 bookings, 5,000 leads, 5,000 requests/ledger entries and 100 users. It
verifies 100 concurrent, permission-scoped dashboards share one booking source
read; current test runs completed those responses in about 1.1–1.6 seconds locally.
A 100-person HRM month used 13 queries including authentication/directory reads.
The test also verifies paging, balances, cache invalidation and disabled accounts.
It never uses the CRM database. Full HRM and financial regression tests remain
available through `test:hrm`, `test:dashboard` and `test:leads`.

`scripts/diagnose-performance.mjs` is an opt-in, read-only timing script using the
backend's existing MongoDB connection settings; it disables automatic collection
and index creation and does not run automation. It prints counts/timings only.
`scripts/measure-api.mjs` uses explicitly provided `CRM_DIAGNOSTIC_URL`,
`CRM_DIAGNOSTIC_EMAIL` and `CRM_DIAGNOSTIC_PASSWORD`, signs in normally (updating
normal login activity), then performs only GET requests. Neither script prints or
saves passwords, tokens or business records.
