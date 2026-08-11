# Taxi Management Module — Design Spec

Source of truth: `Taxi Usage Policy 160626.pdf` (TotalEnergies Marketing Mauritius Ltd, CR-PROC-MU-RH-12, v3, effective June 2026).

This module is designed to be **standalone now, pluggable later** into a modular HR platform. It owns its own schema and exposes clean seams (employee reference, approver resolution, notifications) so it can later bind to a shared Employee/Org/Auth core instead of managing those itself.

---

## 1. Domain model

### 1.1 Core entities

**Employee** (external reference — stubbed locally until a core HR module exists)
- `EmployeeId`, `Name`, `Position`, `Department`, `ManagerId` (N+1), `IsManCom` (bool), `HasCompanyVehicle` (bool), `HasTransportAllowance` (bool)
- The eligibility rule ("not eligible for a company vehicle or transport allowance") is checked directly off this record for reason codes A and C.

**TaxiBookingRequest** — the digitised Appendix 1 form
- `RequestId`
- `EmployeeId` (requester / "Booked by")
- `Position`, `Department` (snapshot at time of booking, not live-joined — matches the paper form's intent as a point-in-time record)
- `ReasonCode` (enum: A–H, see §1.2)
- `DeclarationConfirmed` (bool, must be `true` to submit — "all alternative transport options exhausted")
- `JourneyFrom`, `JourneyTo`
- `TravelDate`, `PickupTime`
- `TaxiContactNumber` (nullable until vendor assigns)
- `SharedWithRequestIds` (list, nullable — links to other requests sharing the same ride, see §3.4)
- `Status` (enum, see §2)
- `SubmittedAt`
- `ApproverId` (resolved N+1, or ManCom member for G/H)
- `ApprovedAt`, `ApprovalSignatureRef` (digital signature/e-signoff, replaces wet signature)
- `RejectionReason` (nullable)
- `ActualPickupAt`, `ActualDropoffAt` (filled post-trip, from vendor report or manual close-out)
- `PersonalUseFlag` (bool, set during monitoring §5)
- `PersonalUseChargeId` (nullable FK)

**ReasonCode** (enum A–H) — each carries its own eligibility precondition, see table below.

**TaxiVendorInvoiceLine** — one row per trip from the monthly vendor report
- `InvoiceLineId`, `InvoiceId` (batch), `VendorTripRef`, `Date`, `From`, `To`, `Amount`, `WaitingTimeCharge`
- `MatchedRequestId` (nullable FK to `TaxiBookingRequest` — matching is the core of §5 monitoring)
- `MatchStatus` (enum: Matched, Unmatched, Disputed)

**TaxiVendorInvoiceBatch**
- `BatchId`, `Month`, `ReceivedAt`, `TotalAmount`, `ValidatedByHRId`, `ValidatedAt`, `EscalatedToManCom` (bool)

**PersonalUseCharge**
- `ChargeId`, `RequestId`, `EmployeeId`, `Amount`, `RecoveryMethod` (enum: CashierPayment, SalaryDeduction), `EmployeeConsentRef` (required if SalaryDeduction), `Status` (Pending/Recovered), `DisciplinaryFlag` (bool — set on repeat abuse per policy §4)

### 1.2 Reason codes (from Appendix 1 / "Approved Reasons for Taxi Use")

| Code | Reason | Eligibility precondition encoded in validation |
|---|---|---|
| A | Overtime | `!HasCompanyVehicle && !HasTransportAllowance`, time ≥ 16:30, overtime ≥ 2h and authorised by N+1. **Sharing becomes mandatory** if ≥2 open requests share destination locality + overlapping time window. |
| B | Night shift | Working past 16:30, normal public transport route unavailable/ceased. |
| C | Appointment | `!HasCompanyVehicle`, off-site appointment during working hours, declaration must be checked. |
| D | Company event | After-hours/weekend TEMML event, declaration must be checked. |
| E | Airport transfer | Official travel outside normal hours, Messenger/Driver pool unavailable. |
| F | Medical | Sent home — ill health or compassionate grounds. No declaration/exhaustion requirement (urgency overrides). |
| G | Emergency work | Requires `ApproverId` to be a ManCom member, and approval timestamp **must precede** both work attendance and booking (two-step: attend-work authorisation + booking authorisation). |
| H | Exceptional case | Requires `ApproverId` to be a ManCom member. Free-text justification required (no other structured precondition). |

---

## 2. Status workflow (state machine)

```
Draft → PendingApproval → Approved → Booked → Completed
                 │                       
                 ├─→ Rejected
                 └─→ Cancelled (by requester, only from Draft/PendingApproval)

Completed → (optional) FlaggedForReview → PersonalUseConfirmed / Cleared
```

- **Draft**: employee filling the form.
- **PendingApproval**: submitted, awaiting N+1 (or ManCom for G/H) sign-off. Booking timing rules (§3) determine the deadline by which this must resolve.
- **Approved**: signed off, not yet handed to vendor.
- **Booked**: taxi contact number captured, trip scheduled.
- **Completed**: trip taken (either self-reported or reconciled against vendor invoice line).
- **FlaggedForReview**: raised during monthly monitoring (§5) when invoice details don't cleanly match an approved request, or usage pattern looks like personal use.
- **PersonalUseConfirmed**: triggers `PersonalUseCharge` creation.

State transitions should be logged as an append-only audit trail (who, when, from→to) — this replaces the paper form's wet-signature audit trail and is what HR/ManCom scrutiny (§5, §6 of the policy) will actually query.

---

## 3. Business rules to enforce in code

### 3.1 Declaration gate
`DeclarationConfirmed` must be `true` before a request can leave `Draft`, **except** for reason F (medical/compassionate) where urgency overrides the exhaustion-of-alternatives requirement — model this as a per-reason-code rule table, not a hardcoded `if`.

### 3.2 Approver resolution
- Default approver = `Employee.ManagerId` (N+1).
- For G and H, approver must have `IsManCom = true` — if the resolved N+1 isn't ManCom, the UI must route to a ManCom member picker instead.
- For G specifically: capture two distinct authorisations — "cleared to attend work" and "cleared to book taxi" — the policy treats these as separate gates even though both come from the same ManCom member.

### 3.3 Booking deadlines (validation, not just UI hints)
| Scenario | Deadline |
|---|---|
| Weekday overtime / night shift | Booked by 15:00 same day |
| Airport drop-off/pick-up, weekend/public holiday | ≥2 days before travel date |
| Weekend/public-holiday overtime | 15:00 on the prior working day |

Late submissions shouldn't be silently accepted — flag them (`LateBooking = true`) so HR monitoring can see policy exceptions, rather than hard-blocking (real overtime emergencies happen — reason G exists precisely for that).

### 3.4 Mandatory sharing (reason A)
When a new reason-A request is submitted, check for other `Approved`/`Booked` requests with overlapping `TravelDate` + `PickupTime` window and same destination locality. If found, surface a "share this ride?" prompt to the approver rather than silently auto-merging — the policy says sharing is mandatory but doesn't remove human judgment about feasibility.

### 3.5 Waiting-time charge awareness
Not a hard rule, but worth surfacing: if `ActualPickupAt` is materially later than `PickupTime`, tag the request so it's visible during invoice reconciliation (vendor waiting-time charges tie back to policy §3.1d).

---

## 4. Roles & permissions

| Role | Capabilities |
|---|---|
| Employee | Create/edit own Draft requests, submit, view own history, view own `PersonalUseCharge`s |
| N+1 Manager | Approve/reject requests for direct reports (reasons A–F) |
| ManCom member | Approve/reject G/H requests; receive escalated monitoring reports (§5) |
| HR Admin/Manager | Import vendor invoice batches, run matching, validate costs, flag personal use, initiate salary deduction/cashier recovery, view all requests |
| Taxi Vendor | External — no login; interacts via booking phone call + monthly invoice/report ingestion (file upload or API, TBD with vendor) |

---

## 5. Monitoring & reconciliation (policy §5)

Monthly cycle:
1. Ingest vendor `TaxiVendorInvoiceBatch` (manual upload initially — CSV/PDF from vendor; API integration is a future enhancement, not assumed).
2. Auto-match each `TaxiVendorInvoiceLine` to a `TaxiBookingRequest` by date + employee + route (fuzzy match on From/To).
3. Unmatched lines → `MatchStatus = Unmatched` → HR must investigate (could indicate unauthorised/personal use, or a request that was never digitised e.g. phone-only booking under reason G/H urgency).
4. HR validates the batch (`ValidatedByHRId`, `ValidatedAt`).
5. Batches (or specific flagged lines) can be pushed to ManCom for further scrutiny (`EscalatedToManCom`).
6. Confirmed personal-use lines generate a `PersonalUseCharge`; repeated occurrences per employee should surface a "repeat abuse" indicator (count of `PersonalUseCharge` records in trailing 12 months) to support the disciplinary-action clause.

---

## 6. Notifications (not in the PDF, but implied by the workflow)

- Request submitted → notify approver.
- Approaching booking deadline (§3.3) with no approval yet → notify approver + employee.
- Approved/Rejected → notify employee.
- Personal-use charge raised → notify employee + their manager.
- Unmatched invoice lines after N days → notify HR.

---

## 7. Digitised form vs. paper Appendix 1

The digital `TaxiBookingRequest` create/edit screen should mirror Appendix 1 field-for-field so approvers who know the paper form recognise it immediately:

Employee Name · Position · Section/Dept. · Declaration checkbox · Reason (single-select A–H, with inline description shown, from the "Approved Reasons" table) · Journey From/To · Date · Pick-up Time · Taxi contact number · Booked-by identity (auto-filled from logged-in user) · Authorised-by (resolved approver, digital signature = approval action + timestamp, not a drawn signature).

The red banner — "Taxi services are strictly for business use only. Personal use is prohibited." — should persist as a visible constant on the form, not just a policy footnote.

---

## 8. Integration seams for the future modular HR platform

Kept deliberately thin so this module can be lifted into a larger platform later:
- **Employee/Org data**: currently a local stub table; replace with a call to the shared Employee module once it exists (same shape: manager chain, ManCom flag, vehicle/allowance eligibility).
- **Auth**: assume an injected `CurrentUser` context (employee identity + roles); no auth logic lives in this module.
- **Notifications**: assume an injected notification port (email/Teams/etc.); this module only decides *when* to fire, not *how* to deliver.
- **Payroll**: `PersonalUseCharge.RecoveryMethod = SalaryDeduction` should emit an event/record for a future Payroll module to consume — this module should not implement payroll deductions itself.

---

## 9. Open questions (for the user / policy owner, not assumed)

- Is taxi vendor invoice data available electronically (CSV/API) or only as PDF/paper — determines how much automation is realistic for §5.
- Should "exceptional circumstances" (reason H) require free-text justification stored against the request for audit purposes? The policy doesn't specify a field for this beyond ManCom approval.
- Multi-company-vehicle-pool interaction: is there an existing "Messenger/Drivers" booking system this module should check availability against before allowing reasons C/D/E (policy requires "all other options exhausted" before taxi)?
