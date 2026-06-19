# Continuation Booking Audit

Generated at: 2026-06-19T10:30:46.034Z

This is a read-only audit report. No database records were changed while producing this file.

Approved continuation approvals scanned: **15**
Suspicious parent bookings found: **12**

## How To Use

Review each booking below before any repair. Proposed repairs are suggestions only, based on approval history and term-level data.

## 1. DHEER OIL MILL

- Booking ID: `6a11460df357a7539d6445f0`
- BDM: SHLOK RAI
- Total Amount: 17700
- Term 1 / Term 2 / Term 3: 4500 / 3000 / 4100
- Sum of Terms: 11600
- Top-level Payment Date: 2026-06-18
- Term 1 Payment Date: 2026-05-23
- Term 2 Payment Date: 2026-06-15
- Term 3 Payment Date: 2026-06-18

### Suspicion Reasons

- Field: `payment_date` | Type: `history-change` | Note: Term 2 approved from booking approval queue
  - Old/Expected: `"2026-05-23T00:00:00.000Z"`
  - Current/New: `"2026-06-15"`
- Field: `payment_date` | Type: `history-change` | Note: Term 3 approved from booking approval queue
  - Old/Expected: `"2026-06-15T00:00:00.000Z"`
  - Current/New: `"2026-06-18"`
- Field: `payment_date` | Type: `heuristic` | Note: Top-level payment_date differs from term_1 payment_date.
  - Old/Expected: `"2026-05-23T00:00:00.000Z"`
  - Current/New: `"2026-06-18T00:00:00.000Z"`
- Field: `shared_with` | Type: `heuristic` | Note: Top-level shared_with differs from term_1 shared_with.
  - Old/Expected: `[{"user_id":"69e0897b12c7650e87139414","user_name":"SHLOK RAI","percentage":100,"_id":"6a11460df357a7539d6445f2"}]`
  - Current/New: `[{"user_id":"69e0897b12c7650e87139414","user_name":"SHLOK RAI","percentage":100,"_id":"6a11460df357a7539d6445f1"}]`

### Related Continuation Approvals

- Approval ID: `6a33e8f4484fb8b42965c209` | Term: Term 3 | Reviewed At: 2026-06-19
  - Approval Payment Date: 2026-06-18
  - Approval Term Amount: 4100
  - Approval Total Amount Payload: 17700
- Approval ID: `6a2f96af78975355ea6ffda1` | Term: Term 2 | Reviewed At: 2026-06-15
  - Approval Payment Date: 2026-06-15
  - Approval Term Amount: 3000
  - Approval Total Amount Payload: 17700

### Proposed Repair Fields

- Field: `payment_date`
  - Current Value: `"2026-06-18T00:00:00.000Z"`
  - Proposed Value: `"2026-05-23T00:00:00.000Z"`
  - Source: term_1 payment_date fallback

---

## 2. VIVEKANAND EDUCATION AND SOCIAL WELFARE TRUST

- Booking ID: `6a2d090790a492369797baa2`
- BDM: PRIYANKA SINGH
- Total Amount: 5900
- Term 1 / Term 2 / Term 3: 5900 / 5900 / 0
- Sum of Terms: 11800
- Top-level Payment Date: 2026-06-17
- Term 1 Payment Date: 2026-06-12
- Term 2 Payment Date: 2026-06-17
- Term 3 Payment Date: N/A

### Suspicion Reasons

- Field: `total_amount` | Type: `history-change` | Note: Term 2 approved from booking approval queue
  - Old/Expected: `11800`
  - Current/New: `5900`
- Field: `payment_date` | Type: `history-change` | Note: Term 2 approved from booking approval queue
  - Old/Expected: `"2026-06-12T00:00:00.000Z"`
  - Current/New: `"2026-06-17"`
- Field: `payment_date` | Type: `heuristic` | Note: Top-level payment_date differs from term_1 payment_date.
  - Old/Expected: `"2026-06-12T00:00:00.000Z"`
  - Current/New: `"2026-06-17T00:00:00.000Z"`
- Field: `total_amount` | Type: `heuristic` | Note: Sum of term amounts is greater than top-level total_amount.
  - Old/Expected: `5900`
  - Current/New: `11800`
- Field: `shared_with` | Type: `heuristic` | Note: Top-level shared_with differs from term_1 shared_with.
  - Old/Expected: `[{"user_id":"69cb7d24d19c32b585e3ccc5","user_name":"PRIYANKA SINGH","percentage":100,"_id":"6a2d090790a492369797baa5"}]`
  - Current/New: `[{"user_id":"69cb7d24d19c32b585e3ccc5","user_name":"PRIYANKA SINGH","percentage":100,"_id":"6a2d090790a492369797baa4"}]`

### Related Continuation Approvals

- Approval ID: `6a3286233fbd4f1dc6924f99` | Term: Term 2 | Reviewed At: 2026-06-18
  - Approval Payment Date: 2026-06-17
  - Approval Term Amount: 5900
  - Approval Total Amount Payload: 5900

### Proposed Repair Fields

- Field: `payment_date`
  - Current Value: `"2026-06-17T00:00:00.000Z"`
  - Proposed Value: `"2026-06-12T00:00:00.000Z"`
  - Source: term_1 payment_date fallback

---

## 3. LUMINARACORP LLP

- Booking ID: `6a32e45ca23741f1aeffde4c`
- BDM: TEST1
- Total Amount: 11800
- Term 1 / Term 2 / Term 3: 11800 / 1000 / 0
- Sum of Terms: 12800
- Top-level Payment Date: 2026-06-17
- Term 1 Payment Date: 2026-06-17
- Term 2 Payment Date: 2026-06-17
- Term 3 Payment Date: N/A

### Suspicion Reasons

- Field: `payment_date` | Type: `history-change` | Note: Term 2 approved from booking approval queue
  - Old/Expected: `"2026-06-17T00:00:00.000Z"`
  - Current/New: `"2026-06-17"`
- Field: `shared_with` | Type: `history-change` | Note: Term 2 approved from booking approval queue
  - Old/Expected: `[{"user_id":"6a083d3f5b875b1903c9ff45","user_name":"TEST2","percentage":40,"_id":"6a32e45ca23741f1aeffde4f"}]`
  - Current/New: `[{"user_id":"6a083d3f5b875b1903c9ff45","user_name":"TEST2","percentage":0}]`
- Field: `total_amount` | Type: `heuristic` | Note: Sum of term amounts is greater than top-level total_amount.
  - Old/Expected: `11800`
  - Current/New: `12800`
- Field: `shared_with` | Type: `heuristic` | Note: Top-level shared_with differs from term_1 shared_with.
  - Old/Expected: `[{"user_id":"6a083d3f5b875b1903c9ff45","user_name":"TEST2","percentage":40,"_id":"6a32e45ca23741f1aeffde50"}]`
  - Current/New: `[{"user_id":"6a083d3f5b875b1903c9ff45","user_name":"TEST2","percentage":0,"_id":"6a32e5e1861c47482526cf97"}]`

### Related Continuation Approvals

- Approval ID: `6a32e51ba23741f1aeffe572` | Term: Term 2 | Reviewed At: 2026-06-17
  - Approval Payment Date: 2026-06-17
  - Approval Term Amount: 1000
  - Approval Total Amount Payload: 11800

### Proposed Repair Fields

- Field: `payment_date`
  - Current Value: `"2026-06-17T00:00:00.000Z"`
  - Proposed Value: `"2026-06-17T00:00:00.000Z"`
  - Source: updatedhistory old value

---

## 4. GYAN TAXATION &CO.

- Booking ID: `6a211f3fba64cb52003f44b0`
- BDM: DEEKSHA DUBEY
- Total Amount: 14160
- Term 1 / Term 2 / Term 3: 5900 / 8260 / 0
- Sum of Terms: 14160
- Top-level Payment Date: 2026-06-16
- Term 1 Payment Date: 2026-05-28
- Term 2 Payment Date: 2026-06-16
- Term 3 Payment Date: N/A

### Suspicion Reasons

- Field: `payment_date` | Type: `history-change` | Note: Term 2 approved from booking approval queue
  - Old/Expected: `"2026-05-28T00:00:00.000Z"`
  - Current/New: `"2026-06-16"`
- Field: `payment_date` | Type: `heuristic` | Note: Top-level payment_date differs from term_1 payment_date.
  - Old/Expected: `"2026-05-28T00:00:00.000Z"`
  - Current/New: `"2026-06-16T00:00:00.000Z"`

### Related Continuation Approvals

- Approval ID: `6a313c74964fd984ff49b3ef` | Term: Term 2 | Reviewed At: 2026-06-16
  - Approval Payment Date: 2026-06-16
  - Approval Term Amount: 8260
  - Approval Total Amount Payload: 14160

### Proposed Repair Fields

- Field: `payment_date`
  - Current Value: `"2026-06-16T00:00:00.000Z"`
  - Proposed Value: `"2026-05-28T00:00:00.000Z"`
  - Source: term_1 payment_date fallback

---

## 5. NAVAAHAR FOODS PRIVATE LIMITED

- Booking ID: `6a2f86f278975355ea6ee7f7`
- BDM: ANUPAM KATERIYA
- Total Amount: 14160
- Term 1 / Term 2 / Term 3: 2000 / 5900 / 0
- Sum of Terms: 7900
- Top-level Payment Date: 2026-06-16
- Term 1 Payment Date: 2026-06-13
- Term 2 Payment Date: 2026-06-16
- Term 3 Payment Date: N/A

### Suspicion Reasons

- Field: `payment_date` | Type: `history-change` | Note: Term 2 approved from booking approval queue
  - Old/Expected: `"2026-06-13T00:00:00.000Z"`
  - Current/New: `"2026-06-16"`
- Field: `payment_date` | Type: `heuristic` | Note: Top-level payment_date differs from term_1 payment_date.
  - Old/Expected: `"2026-06-13T00:00:00.000Z"`
  - Current/New: `"2026-06-16T00:00:00.000Z"`
- Field: `shared_with` | Type: `heuristic` | Note: Top-level shared_with differs from term_1 shared_with.
  - Old/Expected: `[{"user_id":"69e73b220172857fff6e22fd","user_name":"ANUPAM KATERIYA","percentage":0,"_id":"6a2f86f278975355ea6ee7fa"}]`
  - Current/New: `[{"user_id":"69e73b220172857fff6e22fd","user_name":"ANUPAM KATERIYA","percentage":0,"_id":"6a2f86f278975355ea6ee7f9"}]`

### Related Continuation Approvals

- Approval ID: `6a30ef11964fd984ff45ef40` | Term: Term 2 | Reviewed At: 2026-06-16
  - Approval Payment Date: 2026-06-16
  - Approval Term Amount: 5900
  - Approval Total Amount Payload: 14160

### Proposed Repair Fields

- Field: `payment_date`
  - Current Value: `"2026-06-16T00:00:00.000Z"`
  - Proposed Value: `"2026-06-13T00:00:00.000Z"`
  - Source: term_1 payment_date fallback

---

## 6. COMFORT AURA (OPC) PRIVATE LIMITED

- Booking ID: `6a2ba1fd219e08d75aa062e1`
- BDM: PRIYANKA SINGH
- Total Amount: 46020
- Term 1 / Term 2 / Term 3: 5900 / 46020 / 0
- Sum of Terms: 51920
- Top-level Payment Date: 2026-06-15
- Term 1 Payment Date: 2026-06-11
- Term 2 Payment Date: 2026-06-15
- Term 3 Payment Date: N/A

### Suspicion Reasons

- Field: `payment_date` | Type: `history-change` | Note: Term 2 approved from booking approval queue
  - Old/Expected: `"2026-06-11T00:00:00.000Z"`
  - Current/New: `"2026-06-15"`
- Field: `payment_date` | Type: `heuristic` | Note: Top-level payment_date differs from term_1 payment_date.
  - Old/Expected: `"2026-06-11T00:00:00.000Z"`
  - Current/New: `"2026-06-15T00:00:00.000Z"`
- Field: `total_amount` | Type: `heuristic` | Note: Sum of term amounts is greater than top-level total_amount.
  - Old/Expected: `46020`
  - Current/New: `51920`
- Field: `shared_with` | Type: `heuristic` | Note: Top-level shared_with differs from term_1 shared_with.
  - Old/Expected: `[{"user_id":"69cb7d24d19c32b585e3ccc5","user_name":"PRIYANKA SINGH","percentage":100,"_id":"6a2ba1fd219e08d75aa062e3"}]`
  - Current/New: `[{"user_id":"69cb7d24d19c32b585e3ccc5","user_name":"PRIYANKA SINGH","percentage":100,"_id":"6a2ba1fd219e08d75aa062e2"}]`

### Related Continuation Approvals

- Approval ID: `6a2ff43978975355ea76eb16` | Term: Term 2 | Reviewed At: 2026-06-16
  - Approval Payment Date: 2026-06-15
  - Approval Term Amount: 46020
  - Approval Total Amount Payload: 46020

### Proposed Repair Fields

- Field: `payment_date`
  - Current Value: `"2026-06-15T00:00:00.000Z"`
  - Proposed Value: `"2026-06-11T00:00:00.000Z"`
  - Source: term_1 payment_date fallback

---

## 7. FITTARA

- Booking ID: `6a23b8d0f4dd80de49860ea3`
- BDM: DEEKSHA DUBEY
- Total Amount: 11800
- Term 1 / Term 2 / Term 3: 2360 / 7440 / 2000
- Sum of Terms: 11800
- Top-level Payment Date: 2026-06-15
- Term 1 Payment Date: 2026-06-05
- Term 2 Payment Date: 2026-06-15
- Term 3 Payment Date: 2026-06-15

### Suspicion Reasons

- Field: `payment_date` | Type: `history-change` | Note: Term 2 approved from booking approval queue
  - Old/Expected: `"2026-06-05T00:00:00.000Z"`
  - Current/New: `"2026-06-15"`
- Field: `payment_date` | Type: `history-change` | Note: Term 3 approved from booking approval queue
  - Old/Expected: `"2026-06-15T00:00:00.000Z"`
  - Current/New: `"2026-06-15"`
- Field: `payment_date` | Type: `heuristic` | Note: Top-level payment_date differs from term_1 payment_date.
  - Old/Expected: `"2026-06-05T00:00:00.000Z"`
  - Current/New: `"2026-06-15T00:00:00.000Z"`

### Related Continuation Approvals

- Approval ID: `6a2fee6778975355ea769187` | Term: Term 3 | Reviewed At: 2026-06-15
  - Approval Payment Date: 2026-06-15
  - Approval Term Amount: 2000
  - Approval Total Amount Payload: 11800
- Approval ID: `6a2fece778975355ea766fae` | Term: Term 2 | Reviewed At: 2026-06-15
  - Approval Payment Date: 2026-06-15
  - Approval Term Amount: 7440
  - Approval Total Amount Payload: 11800

### Proposed Repair Fields

- Field: `payment_date`
  - Current Value: `"2026-06-15T00:00:00.000Z"`
  - Proposed Value: `"2026-06-05T00:00:00.000Z"`
  - Source: term_1 payment_date fallback

---

## 8. SANJVI NURSURY

- Booking ID: `6a2673191fe671c0526cd3fb`
- BDM: KAVYA RASTOGI
- Total Amount: 23600
- Term 1 / Term 2 / Term 3: 5900 / 5900 / 11800
- Sum of Terms: 23600
- Top-level Payment Date: 2026-06-15
- Term 1 Payment Date: 2026-06-08
- Term 2 Payment Date: 2026-06-15
- Term 3 Payment Date: 2026-06-15

### Suspicion Reasons

- Field: `payment_date` | Type: `history-change` | Note: Term 2 approved from booking approval queue
  - Old/Expected: `"2026-06-08T00:00:00.000Z"`
  - Current/New: `"2026-06-15"`
- Field: `payment_date` | Type: `history-change` | Note: Term 3 approved from booking approval queue
  - Old/Expected: `"2026-06-15T00:00:00.000Z"`
  - Current/New: `"2026-06-15"`
- Field: `payment_date` | Type: `heuristic` | Note: Top-level payment_date differs from term_1 payment_date.
  - Old/Expected: `"2026-06-08T00:00:00.000Z"`
  - Current/New: `"2026-06-15T00:00:00.000Z"`

### Related Continuation Approvals

- Approval ID: `6a2febc878975355ea765ba3` | Term: Term 3 | Reviewed At: 2026-06-15
  - Approval Payment Date: 2026-06-15
  - Approval Term Amount: 11800
  - Approval Total Amount Payload: 23600
- Approval ID: `6a2fa58778975355ea715690` | Term: Term 2 | Reviewed At: 2026-06-15
  - Approval Payment Date: 2026-06-15
  - Approval Term Amount: 5900
  - Approval Total Amount Payload: 23600

### Proposed Repair Fields

- Field: `payment_date`
  - Current Value: `"2026-06-15T00:00:00.000Z"`
  - Proposed Value: `"2026-06-08T00:00:00.000Z"`
  - Source: term_1 payment_date fallback

---

## 9. ECOVIVE SYSTEMS PRIVATE LIMITED

- Booking ID: `6a2673101fe671c0526cd1f3`
- BDM: DEEKSHA DUBEY
- Total Amount: 23600
- Term 1 / Term 2 / Term 3: 11800 / 23600 / 0
- Sum of Terms: 35400
- Top-level Payment Date: 2026-06-15
- Term 1 Payment Date: 2026-06-05
- Term 2 Payment Date: 2026-06-15
- Term 3 Payment Date: N/A

### Suspicion Reasons

- Field: `payment_date` | Type: `history-change` | Note: Term 2 approved from booking approval queue
  - Old/Expected: `"2026-06-05T00:00:00.000Z"`
  - Current/New: `"2026-06-15"`
- Field: `payment_date` | Type: `heuristic` | Note: Top-level payment_date differs from term_1 payment_date.
  - Old/Expected: `"2026-06-05T00:00:00.000Z"`
  - Current/New: `"2026-06-15T00:00:00.000Z"`
- Field: `total_amount` | Type: `heuristic` | Note: Sum of term amounts is greater than top-level total_amount.
  - Old/Expected: `23600`
  - Current/New: `35400`

### Related Continuation Approvals

- Approval ID: `6a2fd59578975355ea74f0fa` | Term: Term 2 | Reviewed At: 2026-06-15
  - Approval Payment Date: 2026-06-15
  - Approval Term Amount: 23600
  - Approval Total Amount Payload: 23600

### Proposed Repair Fields

- Field: `payment_date`
  - Current Value: `"2026-06-15T00:00:00.000Z"`
  - Proposed Value: `"2026-06-05T00:00:00.000Z"`
  - Source: term_1 payment_date fallback

---

## 10. NAVPLACT

- Booking ID: `6a2f988e78975355ea703a9f`
- BDM: SHIFALI JAISWAL
- Total Amount: 53100
- Term 1 / Term 2 / Term 3: 4720 / 21000 / 0
- Sum of Terms: 25720
- Top-level Payment Date: 2026-06-15
- Term 1 Payment Date: 2026-06-15
- Term 2 Payment Date: 2026-06-15
- Term 3 Payment Date: N/A

### Suspicion Reasons

- Field: `total_amount` | Type: `history-change` | Note: Term 2 approved from booking approval queue
  - Old/Expected: `53100`
  - Current/New: `48380`
- Field: `payment_date` | Type: `history-change` | Note: Term 2 approved from booking approval queue
  - Old/Expected: `"2026-06-10T00:00:00.000Z"`
  - Current/New: `"2026-06-15"`
- Field: `shared_with` | Type: `heuristic` | Note: Top-level shared_with differs from term_1 shared_with.
  - Old/Expected: `[{"user_id":"69e088cc12c7650e871393fe","user_name":"SHIFALI JAISWAL","percentage":100,"_id":"6a2f9d3278975355ea709e14"}]`
  - Current/New: `[{"user_id":"69e088cc12c7650e871393fe","user_name":"SHIFALI JAISWAL","percentage":100,"_id":"6a2f9d3278975355ea709e15"}]`

### Related Continuation Approvals

- Approval ID: `6a2f9c1b78975355ea707707` | Term: Term 2 | Reviewed At: 2026-06-15
  - Approval Payment Date: 2026-06-15
  - Approval Term Amount: 21000
  - Approval Total Amount Payload: 48380

### Proposed Repair Fields

- Field: `total_amount`
  - Current Value: `53100`
  - Proposed Value: `53100`
  - Source: updatedhistory old value
- Field: `payment_date`
  - Current Value: `"2026-06-15T00:00:00.000Z"`
  - Proposed Value: `"2026-06-10T00:00:00.000Z"`
  - Source: updatedhistory old value

---

## 11. MATHURA BIO ENERGY PVT LTD

- Booking ID: `6a23b8e6f4dd80de4986109f`
- BDM: SNEHA SETIYA
- Total Amount: 41300
- Term 1 / Term 2 / Term 3: 5900 / 23600 / 0
- Sum of Terms: 29500
- Top-level Payment Date: 2026-06-10
- Term 1 Payment Date: 2026-06-10
- Term 2 Payment Date: 2026-06-10
- Term 3 Payment Date: N/A

### Suspicion Reasons

- Field: `payment_date` | Type: `history-change` | Note: Term 2 approved from booking approval queue
  - Old/Expected: `"2026-05-06T00:00:00.000Z"`
  - Current/New: `"2026-06-10"`

### Related Continuation Approvals

- Approval ID: `6a2d475f90a49236979b790f` | Term: Term 2 | Reviewed At: 2026-06-15
  - Approval Payment Date: 2026-06-10
  - Approval Term Amount: 23600
  - Approval Total Amount Payload: 47200

### Proposed Repair Fields

- Field: `payment_date`
  - Current Value: `"2026-06-10T00:00:00.000Z"`
  - Proposed Value: `"2026-05-06T00:00:00.000Z"`
  - Source: updatedhistory old value

---

## 12. COMPANY TEST

- Booking ID: `6a2dcfeb50db03d376c8e882`
- BDM: PRIYANKA SINGH
- Total Amount: 20000
- Term 1 / Term 2 / Term 3: 12000 / 12000 / 0
- Sum of Terms: 24000
- Top-level Payment Date: 2026-06-13
- Term 1 Payment Date: 2026-06-14
- Term 2 Payment Date: 2026-06-13
- Term 3 Payment Date: N/A

### Suspicion Reasons

- Field: `payment_date` | Type: `history-change` | Note: Term 2 approved from booking approval queue
  - Old/Expected: `"2026-06-14T00:00:00.000Z"`
  - Current/New: `"2026-06-13"`
- Field: `payment_date` | Type: `heuristic` | Note: Top-level payment_date differs from term_1 payment_date.
  - Old/Expected: `"2026-06-14T00:00:00.000Z"`
  - Current/New: `"2026-06-13T00:00:00.000Z"`
- Field: `total_amount` | Type: `heuristic` | Note: Sum of term amounts is greater than top-level total_amount.
  - Old/Expected: `20000`
  - Current/New: `24000`

### Related Continuation Approvals

- Approval ID: `6a2dd09b50db03d376c8ee63` | Term: Term 2 | Reviewed At: 2026-06-13
  - Approval Payment Date: 2026-06-13
  - Approval Term Amount: 12000
  - Approval Total Amount Payload: 20000

### Proposed Repair Fields

- Field: `payment_date`
  - Current Value: `"2026-06-13T00:00:00.000Z"`
  - Proposed Value: `"2026-06-14T00:00:00.000Z"`
  - Source: term_1 payment_date fallback

---

