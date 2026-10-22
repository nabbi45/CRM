# HRM Portal

The portal runs at `/hrm` in the existing frontend and uses the existing backend,
CRM session, company branding, uploads, notifications and office-IP restrictions.
The CRM sidebar opens it in a new tab. `/dashboard/timecard` redirects to it.

## First activation

Read the plain-language [HR guide](../../../docs/HRM_HR_GUIDE.md) for opening
balance examples, activation dates and daily workflows. An administrator should
confirm the [backup and recovery checkpoint](../../../docs/DATABASE_BACKUP_AND_RECOVERY.md)
before setup. Timestamps, version counters and replica sets are not undo backups.

1. Deploy the backend and frontend together. HRM uses the **existing CRM MongoDB**,
   not a second database. The configured database was checked on 22 October 2026:
   it already supports transactions (replica set), so no database reconfiguration
   or employee reseeding is needed. Transactions keep balances, requests and audits
   consistent. A different standalone deployment would need transaction support.
2. Open **HRM Portal**. Every employee receives a one-time walkthrough; authorised
   HR/admin accounts receive additional setup and management guidance. Completion
   is saved per account in MongoDB, including across devices. **Help & tours** replays
   it. **Continue guided setup** opens the resumable setup assistant. Complete
   existing employee profiles first: joining date, department, branch and gender.
   Confirm each enabled employee's manager, WFH group and eligibility. Reporting
   manager names are retained for reference; assignments use explicit user IDs.
   Existing profiles are prefilled and the assistant can update their eligibility
   fields. For accounts without a full employee profile, the assistant collects
   the minimum HR eligibility fields against the existing account. It does not
   invent bank/personal details or create incomplete CRM profiles. Later CRM
   profile fields take precedence. No duplicate accounts, sample employees or
   invented balances are seeded. Confirmed reviews and policies persist on exit.
3. Confirm opening EL, WFH and ML balances. These represent balances on the
   activation date **including that month's credits**, after reconciling historical
   usage. Values default to zero and are recorded as opening ledger transactions.
4. A system administrator saves the initial policy effective on or before the
   intended activation date, then activates HRM from **HR policies**. Prefer the
   first day of a month. A partial activation month can be reviewed, but complete
   payroll locking starts with the next full month.
5. Automation credits the months following activation. HR records manual
   adjustments for later corrections; opening balances cannot be overwritten
   after activation. Earlier attendance remains historical and is not recalculated.

Policy edits require a future effective date after activation. Payroll uses only
locked snapshots. Unlock requires a system authority and a reason; old snapshot
versions remain stored. Existing approved legacy leaves overlapping activation
are flagged for HR review, rather than being treated as absence. HR can import
them through the historical leave review with explicit pay treatment.

Monthly review can explicitly apply a saved policy version's attendance timing
rules to an unlocked month, or restore the original effective-date rules. This
requires a reason and is audited; it never silently recredits leave or WFH.

## Important workflows

- HR enters original WhatsApp check-in times; employees cannot self-check-in.
  Automatic checkout is applied after the policy deadline and is labelled AUTO.
  Early going is tracking-only. Late numbering is recalculated chronologically.
- WhatsApp/offline requests preserve original intimation, actual approval and CRM
  entry timestamps separately. Proof is optional. Emergency cutoffs use original
  intimation. HR can record already-approved requests for other employees.
- Managers approve only their assigned team. Normal/Emergency Leave requires HR
  to select EL or unpaid treatment. Self-approval is prohibited.
- Sales WFH requires manual payment/booking verification; no booking revenue is
  automatically changed. Failed verification requires an explicit leave outcome.
- Absent/UA requires HR's channel review. UA's two-day adjustment is explicitly
  allocated between EL and unpaid units, with reversals retained in the ledger.
- Regularisation applies only after HR approval. Half-day leave with unresolved
  attendance for the remaining half blocks finalisation.
- `/timecard` and `/leaves` remain available. Active-period mutations use HRM
  services and lock checks; old status-only WFH/EL writes must use requests instead.

## Verification

Use Node 22 or newer for the isolated HRM suite:

```text
cd CRM_BACKEND
npm run test:hrm
npm run build
```

The HRM suite starts a disposable local MongoDB replica set and never reads
`Mongo_URL` or the CRM `.env`. Its first run downloads the MongoDB test binary.
`mongodb-memory-server` is a development dependency only.

```text
cd CRM_FRONTEND
npm test -- --watchAll=false --runInBand --runTestsByPath src/hrm/HRMPortal.test.js src/hrm/HRMOnboarding.test.js
npx react-scripts build
```

Known unrelated baseline test issues: the backend's existing auth/user Jest suites
mix ESM imports with a CommonJS test runtime. The frontend's existing history/app
tests expect booleans from JavaScript expressions returning strings or null, and
the old root App test cannot import Axios ESM under its Jest configuration. These
test files are not changed by the HRM implementation.
