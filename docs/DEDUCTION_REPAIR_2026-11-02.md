# Reported service deduction repair - 2 November 2026

Cause: booking creation and service edits inserted service labels into a regular
expression without escaping punctuation. Parentheses in registration service names
were interpreted as groups, so catalog lookup silently missed the fee. Matching
now escapes literal names and also supports exact catalog values. Duplicate labels
are charged once. Retained service snapshots keep their saved historical rates.

## Completed database repairs

The two user-reported bookings were inspected, backed up individually, updated
with an optimistic comparison against the original services/snapshot, and reread
to verify the result. Each update appended booking history identifying SYSTEM REPAIR.

| Booking | ID | Previous deduction snapshot | Verified deduction snapshot |
| --- | --- | --- | --- |
| GREENION ENERGY | `6acf77a497045a41505bb0c5` | Empty | UP registration: INR 9,200 |
| ANIL | `6ae846c9d037fa19345dd8df` | Startup India: INR 2,700 | UP registration: INR 9,200; Startup India: INR 2,700 |

These are booking-level fees. Employee scorecards distribute deductions using the
existing paid-term ownership and sharing percentages. Payment amounts, dates,
services, ownership and sharing were not changed. Other historical bookings were
not bulk repriced.

The private before-images are excluded from Git:

- `.local-backups/deduction-repairs/6acf77a497045a41505bb0c5-1793623689787.json`
- `.local-backups/deduction-repairs/6ae846c9d037fa19345dd8df-1793623689911.json`

The repair script is `CRM_BACKEND/scripts/repair-reported-deductions.mjs`.
Its default mode is read-only. `--apply` requires exact booking IDs. Repeating it
after the repair makes no further changes when the snapshot already matches.
For rollback, review subsequent booking history first, then restore only the
affected snapshot from its before-image and append a reversal audit entry.

## Deployment

The data corrections are already in the configured MongoDB. Refresh the scorecard
to retrieve them. Deploy the backend fix to prevent recurrence in future bookings
and service edits. Deploy the frontend and backend HRM changes for the daily-entry
absence action and disabled-account filtering.

## Verification

- Real booking-create and service-edit API tests cover registration names with brackets.
- Deduction tests cover literal punctuation, catalog values, deduplication and retained rates.
- HRM integration test checks active-only filtering before pagination and retained history.
- HRM UI test checks disabled-account hiding and reviewed unpaid absence submission.
