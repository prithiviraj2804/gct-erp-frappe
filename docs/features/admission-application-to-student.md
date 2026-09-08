# Slice: Admission — Application to Student

## 1. Summary

A paid lead becomes an admitted **Student**. Between those two points sit the institution's own
application form, the counselling allotment, document verification, an optional offer, and a seat
check. The slice also builds the **refund** the real process needs: this institution collects the
application fee *before* counselling, so an applicant counselling sends elsewhere has to be given
their money back.

Before this slice, `Admission Enquiry.status` could be set to *Documents Verified* or *Admitted* by
typing them into a Select. Nothing stood behind either word, and nothing downstream had a record of
a student to hang off.

## 2. Personas

- **Admission Counsellor** — owns the lead. Raises the application, records the allotment, ticks
  documents off. Cannot admit.
- **Admission Manager** — per-trust admission head. Everything a counsellor can do, plus
  confirming an admission (which writes the statutory register).
- **Accounts Manager** — the only role that may pay money out, i.e. refund an application fee.
- **Cashier** — takes money in, and can read a refund but not raise one.

## 3. Journeys

1. *Apply.* The fee is already collected. The counsellor raises an application; it is seeded with
   the applicant's ranked course preferences (first choice = what they walked in asking for) and
   with the document checklist **that intake** publishes. No seat is checked here — two hundred
   people may apply for sixty CSE seats.
2. *Record the allotment.* Counselling returns. Either *Allotted To Us*, with the exam, rank and
   allotment order recorded and the programme set to **what was actually allotted** — routinely a
   different branch from any preference — or *Allotted Elsewhere* / *Not Allotted*.
3. *Verify.* The office ticks each document: a self-attested copy is filed, the original is checked
   in the applicant's presence and handed straight back. Only when every required row is verified
   may the lead reach *Documents Verified*.
4. *Offer.* Optionally, an offer is issued with an expiry and accepted or declined. A counselling
   allotment is its own offer, so this step is not forced.
5. *Admit.* On a free seat, a `Student` is written with a register number and the lead reaches
   *Admitted*. Over `total_seats` is refused.
6. *Refund.* Counselling allotted them elsewhere: an Accounts Manager refunds the fee. The ledger
   posts a genuine cash-out, the lead is flagged refunded and dropped.

## 4. States

`Admission Enquiry.status` remains **the one pipeline** a human moves a lead along. The application
adds no second one: its `application_state` is *derived* in `validate`
(`Awaiting Counselling → Documents Pending → Documents Verified → Offered → Accepted | Declined →
Admitted`, or `Not Allotted`), exactly as `follow_up_state` is. `counselling_outcome` stays a
separate field because it is *recorded evidence* — what TNEA sent back — not a conclusion.

`Fee Refund.status`: Draft → **Refunded** (on submit) → **Cancelled** (on cancel), mirrored from
`docstatus`. `Student.status`: Active / Discontinued / Alumni, and only **Active** holds a seat.

## 5. Masters & doctypes created

| doctype | module | why (justifying journey) |
|---|---|---|
| `Admission Application` | Admission | J1–J5 — the institution's own form, and the allotment recorded against it |
| `Admission Application Preference` | Admission | J1 — the ranked course choices the form collects |
| `Admission Application Document` | Admission | J3 — the checklist, verified per applicant |
| `Admission Document Type` | Master | J3 — the checklist vocabulary (seeded) |
| `Programme Intake Document` | Master | J3 — *which* documents an intake requires |
| `Student` | Student (new module) | J5 — admission produces a student and a register number |
| `Fee Refund` | Accounts | J6 — the cash-out voucher the first accounts slice deferred |

Supporting: `erp/admission/pipeline.py` (the three gates, composed), `application_state.py` (the
derived badge), `eligibility.py` (the prior-qualification rule, extracted so the application can
re-check it), `erp/api/admission/application.py` + `admission.py`, `erp/api/accounts/fee_refund.py`,
`erp/utils.ensure_module_defs` (a `before_migrate` hook). Grown: `Programme Intake` (+ age window,
+ required documents), `Admission Enquiry` (+ refund flags, `programme` relabelled *Preferred
Programme*), `provisioning.resolve_account` and `permission.assert_trust_in_scope` extracted
for reuse.

## 6. Decisions

- **The application owns its programme; the enquiry keeps what was asked for.** A student walks in
  wanting CSE and TNEA allots ECE. Both facts are true and both are kept — the lead records demand,
  the application records the seat. Nothing forces them to agree, and the `Student` follows the
  application. This is the case the slice was built around, not an edge case.
- **The school/institution difference is data, never a `institution_type` branch.** ERPNext's Education
  module uses one `Student Applicant` for both, expressing school-only concerns as per-programme
  configuration (`min_age`/`max_age` on the admission-program row); OpenEduCat runs one pipeline for
  both. This repo had already made the same call once, moving the entry requirement off a hardcoded
  UG→12th map onto `Programme.required_prior_qualification`. So the age window and the document
  checklist live on `Programme Intake`, and one `Admission Application` serves an LKG class and a B.E.
- **No document custody.** UGC and AICTE forbid an institution retaining original certificates:
  originals are verified in the applicant's presence and returned at once. The rows therefore record
  `copy_collected` / `original_verified` and have no custody or return-tracking fields — building
  those would model a prohibited practice.
- **The register number is the `Student`'s name.** The admission register is a statutory record
  (CBSE, ICSE, state SSC boards, UGC inspection): a numbered, chronological list. `autoname` runs a
  per-trust monotonic series, so the number is dense within a tenant.
- **A refund is not a cancellation.** Cancelling a Fee Payment says the receipt was a mistake and
  reverses the booking; a refund says the money was really taken and is really going back, and posts
  its own voucher (debit fee income, credit cash/bank). `application_fee_paid` is deliberately left
  set — the fee *was* paid, and the refund is the evidence of what followed.
- **Three gates, one call.** `fee_gate.py` had already noted that a lead's status has two writers
  (a direct save, and the follow-up's `set_value` path). Rather than add two more rules each writer
  must remember, `pipeline.py` composes fee + documents + admissibility into
  `assert_status_transition`, and both writers call only that.
- **The allotment failure is reported before the document failure.** An applicant counselling sent
  to another institution will never be admitted here, so telling the office to go and verify certificates
  first would send them down a road that ends nowhere.
- **Seats count Active students only**, so the later withdrawal slice frees a seat by flipping a
  status with no change to the gate.
- **An offer is optional.** A counselling allotment is its own offer and a management-quota seat is
  settled across a desk; but an offer that *was* issued must have been accepted, and not after it
  lapsed.

## 7. What this slice taught us

`bench migrate` does **not** create a Module Def for a module newly added to `modules.txt` —
`add_module_defs` runs only on `install_app`. The `Student` doctype was imported and then deleted in
the same migrate, because `remove_orphan_doctypes` calls `get_controller`, which fails without the
Module Def and reads as "the code is gone". Migrate reported success throughout. Fixed for good with
a `before_migrate` hook rather than a patch, so the next module costs one line in `modules.txt`.

## 8. Explicitly not built (later slices)

Quota seat matrix (Government/Management/NRI as separate pools — one pool for now); in-app merit
computation and merit lists (allotments are recorded, never recalculated); withdrawal *after*
admission and TNEA round-2 re-admission; post-admission branch transfer; an applicant-facing web
portal; an entrance-exam master; Guardian/Sibling child tables; tuition fee structure;
`Programme Enrolment` (student ↔ term, needed once attendance and exams arrive — `Student` here is
the person, not the per-year enrolment); offer-letter and refund print formats; admission-register
PDF export; AICTE slab-based refund policy (the amount is bounded by what was paid, but no engine
computes the deduction).
