# Booking Repair Log

Date: 2026-07-23
Booking ID: `6a38e72a125c6b8bb1d6bc49`
Company: `KAUSTUBHA SOLUTIONS PRIVATE LIMITED`

## Reason

User-reported continuation-share mismatch and payment-date pollution.

Verified from live DB and linked approval records:

- Original approved booking approval: `6a38e42b125c6b8bb1d682e3`
- Approved continuation approval: `6a477bb2ee1240f66d7e0151`

## Current Live Record Before Repair

- `payment_date`: `2026-07-03T00:00:00.000Z`
- `term_shares.term_1.payment_date`: `2026-07-03T00:00:00.000Z`
- `term_shares.term_2`: missing

Current top-level sharing:

```json
[
  {
    "user_id": "6a06d255c6fb36025caa6fff",
    "user_name": "SHIVAM SAINI",
    "percentage": 50
  }
]
```

## Source-of-Truth Approval Data

### Term 1

- Creator: `SURAJ SHARMA`
- Amount: `20000`
- Payment date: `2026-06-22`
- Payment mode: `IDFC BANK`
- Shared with: `SHIVAM SAINI (50%)`

### Term 2

User-reported intended value to restore:

- Creator: `SHIVAM SAINI`
- Amount: `30000`
- Payment date: `2026-07-03`
- Payment mode: `IDFC BANK`
- Shared with: `SURAJ SHARMA (50%)`

## Repair To Apply

1. Restore booking-level `payment_date` to `2026-06-22T00:00:00.000Z`
2. Restore `term_shares.term_1.payment_date` to `2026-06-22T00:00:00.000Z`
3. Add `term_shares.term_2`:

```json
{
  "creator": {
    "user_id": "6a06d255c6fb36025caa6fff",
    "user_name": "SHIVAM SAINI"
  },
  "payment_date": "2026-07-03T00:00:00.000Z",
  "payment_mode": "IDFC BANK",
  "shared_with": [
    {
      "user_id": "69e08cd412c7650e8713947d",
      "user_name": "SURAJ SHARMA",
      "percentage": 50
    }
  ]
}
```

4. Append `updatedhistory` note describing the manual production repair.

## Undo Reference

If rollback is ever needed, restore these pre-repair values:

- `payment_date`: `2026-07-03T00:00:00.000Z`
- `term_shares.term_1.payment_date`: `2026-07-03T00:00:00.000Z`
- `term_shares.term_2`: `null / missing`
