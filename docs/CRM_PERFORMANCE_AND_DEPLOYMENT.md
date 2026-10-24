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

Dropdowns, HRM and dashboard avatars use 96-pixel thumbnails for embedded photos.
Original photo records and upload/edit endpoints are unchanged. Only thumbnail
conversion results are cached in memory; financial summaries and authorization
results are not cached. Concurrent identical frontend reads share an in-flight
request and fetch fresh data after completion.

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
