# Slice: Accounts — Application Fee (Phase 1)

## 1. Summary

After a student's Admission Enquiry (lead), the institution collects an **application fee**; paying it
advances the lead into the pipeline. The fee is booked into a genuine (minimal) **double-entry
ledger**, so the institution's books are maintained from the first transaction — the foundation the
later tuition/finance slices grow on.

## 2. Personas

- **Cashier** — front-desk collector. Records an offline payment (Cash/UPI/DD/cheque) against an
  enquiry. Cannot cancel.
- **Accounts Manager** — per-trust finance admin. Sees all receipts and the ledger for their
  trust; can cancel (reverse) a receipt.
- **System Manager** — bench-wide super-admin.

## 3. Journeys

1. *Collect the fee.* A cashier opens an enquiry, records the application fee (amount frozen from
   `Programme Intake.application_fee`, mode of payment chosen). The receipt posts a balanced voucher
   (debit Cash/Bank, credit Application Fees), flags the lead paid, and advances it to
   *Application Submitted*. A printable ₹ receipt is produced.
2. *Guard the pipeline.* An unpaid lead cannot be moved to *Application Submitted* or beyond —
   through a direct edit **or** an Admission Follow-up's `new_status`.
3. *Correct a mistake.* An Accounts Manager cancels a receipt: the ledger is reversed with
   append-only mirror entries and the lead is unflagged. A corrected re-collection is then allowed.
4. *Read the books.* An Accounts Manager reads the Chart of Accounts and the GL Entry ledger,
   scoped to their trust.

## 4. States

`Fee Payment.status`: Draft → **Paid** (on submit) → **Cancelled** (on cancel), mirrored from
`docstatus`. `Admission Enquiry.application_fee_paid` (Check) is written only by a Fee Payment.

## 5. Masters & doctypes created

| doctype | module | why (justifying journey) |
|---|---|---|
| `Account` | Accounts | Journey 1/4 — the chart the fee books into; per-trust tree |
| `GL Entry` | Accounts | Journey 1/3/4 — the immutable double-entry ledger |
| `Mode of Payment` | Accounts | Journey 1 — how the fee was paid; maps to a Cash/Bank account |
| `Fee Payment` | Accounts | Journey 1/3 — the submittable receipt that posts, gates and prints |

Supporting: `erp/accounts/general_ledger.py` (the balance choke point), `provisioning.py` (per-
trust chart), `erp/admission/fee_gate.py` (the shared gate rule), `erp/api/accounts/fee_payment.py`
(`record_application_fee` / `cancel_application_fee`), a `Fee Payment Receipt` print format, the
`Accounts` workspace. Added: `Trust.default_currency` (₹ source), two enquiry fields.

## 6. Decisions

- **Full double-entry now** (not a receipt-only log) — the user wants the institution's books maintained.
  This introduced the first `is_submittable` pattern in the app (posted money must be immutable +
  reversible).
- **Offline receipts** — no gateway/applicant portal (deferred; no applicant-facing surface exists).
- **Trust scoping is declarative** — every accounts doctype carries `trust`; a User
  Permission scopes it. No custom `permission_query_conditions` (finance is per-tenant, not per-user).
- **`default_currency` on Trust** — one source of truth for the ₹ symbol on receipts.
- **The gate hooks both status-writers** — `enquiry.validate` and `follow_up.validate` — because the
  follow-up's `apply_status_change` uses `set_value` and bypasses the enquiry's `validate`.

## 7. Explicitly not built (later slices)

Journal Entry, Sales Invoice, Fiscal Year doctype (derive from `Trust.financial_year_start`
until a period-close journey needs it), Cost Center, taxes/GST, payment gateway, financial
statements (Trial Balance/P&L/Balance Sheet), Fee Structure/tuition, Party/Customer receivable
ledger. `GL Entry` omits `party`/`against_voucher` — safe columns to add when those arrive.
