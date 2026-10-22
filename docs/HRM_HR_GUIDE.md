# HRM Portal guide for HR and employees

This guide explains the setup screens and everyday work in the HRM Portal. The
portal is part of your existing CRM: employees use the same account, and HRM reads
the existing employees and profiles from MongoDB. Do not recreate employees just
to use HRM. This guide describes the configured defaults; a saved company policy
may change those defaults from its effective date.

## Before you begin

Have the administrator confirm a database backup before making setup changes.
Opening balances and eligibility must come from HR records, not guesses. Keep
attendance sheets, previous leave balances, joining dates and approvals available
while reviewing employees.

Opening HRM does not activate the new rules. Setup reviews can be saved first.
A system administrator must explicitly choose the activation date and activate.

## What the setup terms mean

### Activation date

The date from which the new HRM attendance and entitlement rules apply. It is
not the employee's joining date and not the date the CRM was installed. Attendance
before this date keeps its historical meaning; it is not silently recalculated.

Example: if HR chooses 1 November 2026, October records remain historical and the
new rules begin on 1 November. The first day of a month is recommended because it
gives a complete payroll period. If activation is mid-month, the partial month
cannot be finalised as a complete HRM payroll month; locking begins with the next
full month. Ask the administrator if the activation date is wrong. There is no
safe one-click reset after activation.

### Opening balance

The confirmed number of unused entitlement days an employee brings into HRM on
the activation date. It is not salary, a lifetime total of leave earned, or the
number of days already taken. Use day units: 1 means one day and 0.5 means half a
day. Confirm EL, WFH and ML separately.

Opening balances must include the activation month's entitlement, where the
employee is eligible, after reconciling earlier usage. HRM starts automatic
monthly credits from the following month to avoid crediting the first month twice.

Example: an eligible employee has 5 EL days unused on 31 October. HR activates on
1 November and confirms another 1 EL day for November. Enter an opening EL balance
of 6, not 5. Do not add that November credit again using a manual adjustment.
Automatic credits start in December. If the employee is not eligible for that
credit, do not add it.

Zero is a starting value on the form, not a verified balance. Check it before
confirming. Do not assume an empty portal means the employee has no entitlement.
Old attendance and leave statuses cannot reliably establish historical balances.
Reconcile future approved requests too, so their usage is not counted both in the
opening balance and again when HRM approval is posted.

WFH opening balances must respect the current financial-year quarter and the
quarterly cap. Menstrual Leave opening balances concern the current month, not
unused days from older months. After activation, correct balances using a
reasoned ledger adjustment; do not try to overwrite the opening entry.

### EL or earned leave

Paid leave entitlement tracked as a balance. The default monthly credit is 1 day
for eligible employees. The partial joining month does not receive EL; joining on
the first qualifies for that month. Unused EL carries forward. Opening balances
cover the activation month; normal automatic credits start afterward.

### WFH or work from home

A request to work remotely, not a check-in and not automatically a leave day.
Default entitlement is 2 days per month from the second joining month, with carry
forward only inside a financial-year quarter and a maximum entitlement of 6 days
per quarter. The quarters are April to June, July to September, October to December,
and January to March. Unused units expire at the quarter boundary.

### ML or Menstrual Leave

A separate allowance, not EL. The default is 0.5 day monthly for eligible female
employees. Unused allowance expires at month-end; it is not accumulated indefinitely.
Missing eligibility information needs HR review.

### Eligibility

Whether an employee qualifies for HRM entitlements. Review joining date, gender,
active status and any exit date before confirming. Eligibility is not a substitute
for account access permissions. An unchecked entitlement setting does not delete
the CRM employee or disable their login.

### Policy group

The rule group used for WFH pay treatment. Sales defaults to Sales verification
rules; other existing departments default to Operations. HR must review the mapping.
Changing this does not rename the employee's CRM department.

### Reporting manager

The specific employee account assigned to approve a person's requests and view
their team. Existing free-text manager names are shown for reference, but HR must
choose the correct account. Do not select someone merely because their name looks
similar. Unassigned means HR handles approval. No one may approve their own request.

### Policy effective date

The date a policy version begins to apply. This is different from activation:
activation turns on HRM, while an effective date determines which saved rules apply
to a particular date. The initial policy must be effective on or before activation.
Later policy changes are prospective. Recalculating an unlocked historical month
is a separate authorised action with a reason; it does not recreate entitlements.

## Complete setup using the assistant

1. Sign in with an authorised HR/admin account and open **HRM Portal**. Complete
   the welcome walkthrough, then choose **Continue guided setup**. A senior title
   alone does not grant setup access; the account must have the appropriate role
   or HRM management permission.
2. On **Existing data**, review the database status. The configured Atlas database
   was checked on 22 October 2026 and already supports transactions. No additional
   database or employee seeding is needed for that deployment.
3. On **Employees**, select each enabled CRM employee. Existing profile values
   are prefilled. Confirm department, branch, gender and joining date. Existing
   profile corrections are saved and audited. If there is no full employee profile,
   enter the minimum HR eligibility fields here; this does not invent personal or
   bank details. A full CRM profile can be completed later, and its fields then
   take precedence.
4. Choose the reporting manager and WFH policy group. Check eligibility. Confirm
   EL, WFH and ML opening balances against HR records. Tick the review confirmation
   and press **Save employee review**. Repeat for the next employee. Disabled
   accounts are excluded from activation checks; enabled accounts need review.
5. On **Policy**, a system administrator reviews the effective date and timing
   defaults, then saves the initial policy. **Open all policy settings** provides
   the remaining fields and department schedules. HR can prepare employees without
   being allowed to activate the portal.
6. On **Activation**, verify all employee reviews, profiles, balances and the saved
   policy. Choose the activation date, tick the final confirmation and activate.
   Resolve any server validation message rather than bypassing it.

**Continue later** closes the assistant. Saved employee reviews and policy versions
remain in MongoDB; unsaved form edits do not. **Help & tours** replays the walkthrough.
Tour completion is saved per employee account, including across devices. An employee
who later receives HR authority receives the additional administrator guidance.
After activation, the setup review and normal settings remain available.

## Understand the daily screens

- **Dashboard** shows today's status, monthly totals, balances and pending work.
  Future leave and WFH are scheduled, not completed attendance.
- **My attendance** shows the calendar and individual day details. Employees cannot
  enter their own check-in or check-out.
- **Today's entry** lets HR enter actual attendance times. Policy calculations use
  Asia/Kolkata. The default office start is 10:00, late begins after 10:15, the fourth
  and subsequent monthly late arrivals are half days, and check-in after 11:00 is a
  half day unless HR records an override.
- **AUTO checkout** means the system supplied checkout after the policy deadline
  when a valid check-in existed. Default checkout is 18:30. A manual HR checkout
  takes precedence. AUTO does not prove the employee physically left at that time.
- **Early going** tracks checkout before 18:30. It has no automatic pay penalty by
  default. Missing check-in remains Pending until reviewed; it is not automatically
  treated as absence.
- **Team attendance** is limited to the assigned team, unless the viewer has HR
  authority. **Holiday calendar** includes applicable weekly offs and holidays.
  Sunday is the default weekly off. There is no sandwich deduction.
- **Regularisation** means an attendance correction request, not extra leave.
  Employees provide the date, proposed times and reason; HR reviews it before any
  correction takes effect. HR overrides require a recorded reason.

Backdated attendance can change monthly late numbering. Check the affected month
after correcting an earlier day. A half-day leave request still needs attendance
or a justified decision for the remaining half day.

## Leave and WFH requests

**Pending** means submitted but not approved. It does not consume a balance.
**Approved** means the required approvals and pay decisions have been applied.
**Rejected** means the request was declined. **Cancelled** means it was withdrawn
or reversed; authorised reversals remain visible in the ledger and audit.
Availability is checked again at approval, so a pending request is not a guarantee
that entitlement will still be available later.

Employees apply under Leave or Work from home. HR can also add a request for an
employee, including an already-approved WhatsApp or offline request. Optional proof
can be attached. Enter the source accurately; no WhatsApp integration is required.

Keep these three times separate:

| Field | Meaning | Example |
| --- | --- | --- |
| Original intimation | When the employee first informed the company | WhatsApp sent at 09:10 on Monday |
| Actual approval | When the manager or HR actually approved | Manager approved at 09:25 on Monday |
| CRM entry | When HR entered the request in the portal | HR entered it at 14:00 on Tuesday |

Emergency timing is evaluated using original intimation, not late CRM entry.
The default cutoff is 09:30; exceptions need HR review. Do not backdate the CRM
entry time to make a request look timely.

For Normal or Emergency Leave, HR must choose how each day is treated: EL or
unpaid. Approval alone is not enough if pay treatment is unresolved. Half-day
leave uses half-day units. Overlapping approved requests are not permitted.

For Operations WFH, approved days within entitlement are paid; approved extra WFH
is half-paid by default. For Sales WFH, HR must record payment/booking verification
and a reference, then finalise Present or an explicit leave/attendance adjustment.
Verification-pending is not a final payroll result.

Default consecutive limits are 5 EL days, 5 WFH days and 8 combined working days.
Intervening non-working days bridge the sequence but are not charged. Extended
combinations are limited to once per quarter and require the recorded HR override.
Use the validation message and policy settings if unsure; do not split requests to
hide a continuous absence.

## Balances and the ledger

The ledger is the history behind a balance. A **credit** adds entitlement; **usage**
subtracts it; **expiry** removes an unused allowance at its boundary; **reversal**
undoes a previously posted effect; and **adjustment** is a reasoned HR correction.
Old entries are retained for audit instead of silently deleted. A displayed available
balance can account for future approved usage, not just leave already taken.

If a balance is wrong, check opening entries, approved future requests, cancellations
and expiries before adjusting. Record the reason and supporting information. Do not
approve twice or manually credit a cancelled request that already posted a reversal.

## Absence and month end

**UA** means unauthorised absence confirmed by HR after checking CRM requests,
WhatsApp/offline intimation, emergencies and WFH records. Pending attendance is not
UA. Do not mark a person absent simply because a request was entered late.

For each confirmed UA day, HR allocates the required **total two-day adjustment**
between EL and unpaid units. For example, 1 EL unit plus 1 unpaid unit totals 2.
The screen shows the total impact. Do not add a second manual deduction for the
same UA event. Ask HR management if the treatment is uncertain.

Before locking a completed month, resolve attendance, approvals, leave pay treatment,
Sales WFH verification and required reviews. Locking freezes a versioned attendance
and payroll snapshot. Payroll exports use locked snapshots only; an unlocked live
report is not a final payroll export. Salary disbursement is outside HRM's scope.

Unlocking requires a system authority and a reason. Older snapshots are retained.
Locking is not a database backup and unlocking is not a database restore.

## If something goes wrong

Do not delete employees, clear HRM collections, reset activation or restore the
entire database yourself. First record the employee, date, request ID, expected
result and actual result. Check the ledger and audit history with HR management.
Use a reasoned correction when possible.

Ask the administrator to handle database recovery. Restoring an old full database
can also roll back new bookings, documents, user changes and notifications. A
separate restore-and-review database is safer than replacing the running CRM.
See the [administrator backup and recovery guide](DATABASE_BACKUP_AND_RECOVERY.md)
for the recovery procedure.
