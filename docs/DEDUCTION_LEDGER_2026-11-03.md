# Term dates and service deduction ledger — 3 November 2026

The implementation uses one pure financial calculator for booking writes, previews,
employee scores, dashboard totals, rankings and recovery previews. Cash treatment
is determined separately for every received term. Editing a payment requires an
explicit term; an older request is accepted only when its target is unambiguous.
Continuation edits and approvals preserve earlier payment dates, modes and shares.

## Deduction rules

- Every new term uses its maximum available credit after GST and the existing
  disbursement-refundable clause. Service costs can consume the entire term.
- Fees are applied in saved service order. A partially paid fee remains pending
  and is collected from later terms, through Term 10. Any final remainder stays
  visible. A new service added during continuation starts at that term.
- Catalog IDs deduplicate names/aliases. Retained services keep their saved rate,
  including when the selected label changes to a catalog alias.
- Blank percentages for all selected coworkers mean equal sharing with the
  creator. Otherwise every coworker percentage is required, and the creator gets
  the remainder. An explicit zero remains an access-only entry. All allocations
  use integer paise and conserve employee and booking totals.
- Employees see official, applied and pending fees, plus the term's projected
  credit. Employees cannot select a smaller deduction.

For a new taxable INR 5,900 receipt with INR 2,700 and INR 17,200 fees, INR 5,000
is applied, the term's net credit is zero, and INR 14,900 carries forward. For
cash, INR 5,900 is applied and INR 14,000 carries forward.

## Historical records and recovery

Legacy records do not automatically acquire extra deductions in already received
terms. Their actual capped deduction allocations become a baseline on review or
the next financial write. Confirmed pending fees apply to future terms. A reviewed
recovery is used to correct old scores. Per-term cash and date interpretation is
corrected by the shared read calculator; a legacy booking-wide GST flag no longer
overrides a term's recorded payment mode.

Director, dev, srdev and sr dev can open **Scorecard → Audit booking deductions**,
review saved fees against the catalog, and confirm a proposal with a reason.
Per-booking **Deduction details** is also available from scorecard history and the
dashboard deduction table. That detail includes term payment modes, GST, actual
allocations, pending balances and paginated financial events.

After reviewing fees, choose a service, originating received term, original/current
month, and an optional recovery amount. Blank amount means maximum pending.
**Preview capped recovery** shows each participant's available score and proposed
cut. The posting rechecks that capacity in a transaction. It cannot spend more
than each employee's positive score across the chosen month; unused shares stay
pending and are not moved to a coworker. Original-month recovery requires a known
originating payment date. Recoveries do not change payment amounts or dates.

Recovery requests carry a unique request ID and expected booking revision. Replays
are idempotent; stale edits return 409. Employee/month guards serialize competing
recoveries across different source bookings. Reversals append linked events and
restore the pending balance, retaining the original posting period. Reasons and
actors are retained. Every review, recovery and reversal stores an exact booking
before-image in the private `financial_backups` collection within the transaction.

Financial state uses additive `financial_version`, `financial_revision`,
`deduction_baseline`, `deduction_allocations`, `deduction_recoveries` and
`financial_events` fields. Generic booking updates cannot overwrite these fields.
Automatic recalculations append before/after states. The old one-off deduction
repair scripts refuse to apply to version 2 records.

Historical date mismatches and possible simultaneous earlier/later date overwrites
are flagged with history evidence. Verify the original record and use Edit Booking
for the specific term. Fee review does not guess or modify payment dates.

## Read-only live audit

The audit examined 701 non-deleted bookings. The initial fee/mode audit flagged
223 bookings, including 73 with missing matched catalog fee snapshots and 161
with unmatched historical service labels; these categories overlap. The proposed
pending total for matched catalog services was INR 236,667.12. Unknown labels are
flagged rather than assigned guessed rates. These amounts are proposals for review,
not deductions posted to production.

| Reported record | Booking ID | Verified finding |
| --- | --- | --- |
| KO GREEN ENERGY PVT LTD, 15 October | `6ad1b67ae41ce17715ab911f` | INR 2,700 applied; missing MP registration fee INR 17,200. Review proposes INR 19,900 official and INR 17,200 pending while retaining existing credit. |
| HARISH METRI, 21 October | `6ad865c9f54827454ad0f110` | Missing Karnataka registration fee INR 20,000; two received terms already exist. |
| JAY MAA KALI TRADING COMPANY, 17 October | `6ad33fbec6a18a7cf3401df1` | Chhattisgarh registration fee INR 9,700 is already saved; no missing matched fee remains on this record. |
| GREENION ENERGY | `6acf77a497045a41505bb0c5` | Previously repaired INR 9,200 fee remains saved. |
| ANIL | `6ae846c9d037fa19345dd8df` | Previously repaired INR 11,900 total remains saved. |
| VITAL DIAGONASTICS, 11 September booking | `6aa77a2d9445bd32664f9dab` | Terms 1–2 are bank payments. Terms 3–4 are cash receipts of INR 15,500 and INR 19,060 and have zero GST removal in the new calculator. |

Several companies have multiple bookings; use the IDs above, rather than names
alone. The private report is under `.local-backups/deduction-audits/`; it is ignored
by Git. This implementation did not change production bookings, scores or indexes.

Run `npm run audit:deductions` from `CRM_BACKEND` for a read-only audit. The script
does not start the application, background jobs or automatic index creation.
Optional `--booking-id=<id>` restricts records; `--report=<path>` saves a new local
JSON report and refuses to overwrite an existing file.

The final report, including history checks, is
`.local-backups/deduction-audits/2026-11-03-final-read-only.json`; it confirmed the
same counts and pending total. No production mutations were performed.

## APIs and deployment

- `GET /booking/scorecard-source`: projected financial records, permission-scoped.
- `GET /booking/deduction-audit?page=1&booking_id=<optional-id>`: director/dev
  catalog audit, 50 bookings per page.
- `GET /booking/:id/deductions?page=1`: current breakdown and 20 financial events
  per page; booking access is required.
- `POST /booking/:id/deduction-review`: `snapshot_hash`, `expected_revision`,
  `request_id`, `reason`. Confirms catalog fees and freezes legacy allocations.
- `POST /booking/:id/deduction-recoveries/preview`: `service_key`, `term_key`,
  `period` (`original` or `current`), optional `amount`.
- `POST /booking/:id/deduction-recoveries`: preview fields plus
  `expected_revision`, `request_id`, `reason`.
- `POST /booking/:id/deduction-recoveries/:eventId/reverse`: revision, unique
  request ID and reason. Mutation roles are checked against authenticated accounts.

Deploy the backend first, then the frontend, from the full repository checkout.
The backend bundle imports the shared frontend financial modules. Review/recovery
requires transaction-capable MongoDB (the configured Atlas deployment supports it).
The response marker is `X-CRM-Read-Version: 2026-11-03`. Hard-refresh old clients.
Historical fee confirmations/recoveries remain an explicit director/dev action.

Summary reads retain sparse MongoDB projections, a shared booking source, bounded
15-second caching and write invalidation. Detailed financial events/backups are
not downloaded for initial dashboard or scorecard calculations. CSV imports use
the same financial write helper; `--sync`/`--update-shares` require `--commit`.

Validation commands: backend `npm run test:financials`, `npm run test:performance`,
`npm run build`; frontend focused component tests and `npm run build`. The isolated
5,000-booking/100-user dashboard run used one shared source read and completed in
2,701 ms, compared with the pre-change 2,707 ms local baseline. These are local
regression measurements, not production network latency guarantees.

Final verification: 27 financial/API tests, 5 performance/access/cache tests and
8 focused UI tests passed. Both production builds passed; the frontend retains
the repository's existing dependency/lint warnings.
