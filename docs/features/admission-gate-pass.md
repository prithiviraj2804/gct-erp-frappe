# Slice 1 — Admission Gate Pass · `Gate`

**Status:** built (backend); SPA screens deferred
**Module:** `Gate` · **Depends on:** nothing

## 1. Summary

A prospective student walks up to the campus gate and says they have come about admission. Before
this, nothing recorded that. Now the security desk captures who came, **which college they want**,
**how the lead reached us**, and **which of our staff owns it** — and closes the pass when they
leave.

This is the first slice built feature-first ([../METHOD.md](../METHOD.md)). Two masters exist
because these journeys named them, and not one field was added that a journey didn't ask for. A
third was built, lost its only consumer, and was deleted — see §5.

**Referral routes are deliberately mixed.** Staff and consultancy referrals link to records, so
"which agency sends us the most enquiries" is a query. The referring student and the three
accountable-staff slots are typed names, chosen for entry speed at a busy gate. The cost is real and
worth stating: typed names cannot be aggregated reliably — two spellings are two people to any
report. The controller trims and case-folds them where it can, which narrows the problem without
solving it.

## 2. Personas and roles

| Persona | What they do | Role |
|---|---|---|
| Security desk operator | Records the arrival, captures the photo, marks the exit | **Gate Security** (new) |
| Admissions / administration | Reads passes, reports on referral routes | System Manager for now |

`Gate Security` is the app's first real role — everything before this was System Manager only. It
can create, read, write and print a pass but **cannot delete or export one**: a gate log is an audit
trail, and an operator who mistypes corrects the record rather than removing it.

Created by [../../erp/patches/v1_0/create_gate_roles.py](../../erp/patches/v1_0/create_gate_roles.py)
in **`[pre_model_sync]`** — a doctype JSON naming a role that doesn't exist yet fails to sync, so
the role has to be in the database before migrate reaches the doctype.

## 3. Journeys

### J1 — an admission enquiry arrives

1. A prospective student, usually with a parent, reaches the gate and asks about admission.
2. The operator opens **Admission Gate Pass → New**.
3. Records **student name, phone number, Aadhaar number, parent/guardian name, native place**, and
   whether they came by **vehicle** — the registration number becomes required if they did.
4. Picks the **College** the student wants admission to. `institution` fills itself from the college;
   `academic_year` is set from whichever year that institution currently has admissions open on.
5. Picks the **Reference** — how the lead reached us. Exactly one field follows, and nothing else
   is shown:

   | Reference | What appears | Type |
   |---|---|---|
   | Staff Reference | Reference Staff | **dropdown** → Staff |
   | Consultancy Reference | Consultancy Name | **dropdown** → Consultancy |
   | Student Reference | Referring Student | typed |
   | Direct Admission | Reference Remarks | typed, optional |
   | Other | Reference Remarks | typed, required |

6. Types **Reference Staff Name 1** — the staff member accountable for this enquiry, required
   whatever the route was — and optionally a second and third.
7. Captures a **photo** at the desk. Required — a pass cannot be saved without one.
8. Saves. The pass takes a number (`AGP-2026-00001`), an `in_time`, and status **Inside**.

### J2 — the visitor leaves

1. The operator finds the pass, or filters the list to status **Inside**.
2. Presses **Mark Exit**. The server stamps `out_time` and status becomes **Exited**.
3. Pressing it again is refused, naming the time already recorded.

### Exceptions

| What happens | What the system does |
|---|---|
| A referring staff member or consultancy from **another institution** is named | Rejected — `HierarchyMismatchError`. This is a tenant leak the Link field alone permits. |
| The same staff name is typed into two of the three slots | Rejected, naming the slot it clashes with. Compared case- and space-insensitively, since these are typed names: `" anitha  RAMESH "` and `"Anitha Ramesh"` are one person. Names are stored trimmed. |
| Aadhaar isn't 12 digits | Rejected. `1234 5678 9012` is accepted and stored as `123456789012`. |
| Phone isn't 10 digits | Rejected. `+91 98765 43210` is accepted and stored as `9876543210`. |
| The institution has **no** admission-open academic year | The pass **saves anyway**, with `academic_year` blank. Deliberate — a gate desk must never be blocked because an administrator forgot to flag the year. |
| The reference is changed on an edit | The previous route's referrer is cleared, so no enquiry counts twice. |
| A route is chosen but its referrer is left empty, or Vehicle is ticked with no number | Rejected server-side. `mandatory_depends_on` alone would not do this — see §6. |
| The college is corrected to one under **another** institution | `academic_year` is re-derived for the new tenant. Without that the pass would be stuck forever: the field is read-only, so the desk could not clear the value the hierarchy check was objecting to. |

## 4. States and transitions

```
Inside ──Mark Exit──▶ Exited
```

One-way, and `status` is **derived** from `out_time` in the controller — never typed. The doctype is
not submittable: a gate log is recorded, not approved.

## 5. Doctypes

### New masters — `Master` module

| Doctype | Justified by | Fields |
|---|---|---|
| **Staff** | J1.6 — the desk must name the accountable staff member | `institution`, `college`, `staff_code`, `staff_name`, `designation`, `mobile`, `email`, `status` |
| **Consultancy** | J1.5 — an enquiry arriving through an agency names which one | `institution`, `consultancy_code`, `consultancy_name`, `contact_person`, `mobile`, `email`, `city`, `state`, `status`, `description` |

`Staff.designation` is in for exactly one reason: the operator has to pick the right person out of a
dropdown at a busy gate, and two people share a name more often than not. It is in `search_fields`,
without which it would not reach the picker and the field would be decorative.

A **Student** master was built and then **deleted**. The referring student became a typed name, which
left Student with no consumer at all — and the rule is that a master without a consumer does not
exist. It gets rebuilt properly, and fully, by the People & Identity slice.

### New transaction doctype — `Gate` module

**Admission Gate Pass**, named `AGP-.YYYY.-.#####`. A gate pass has no natural business key, so a
naming series is the readable alternative to a UUID. Sections: Visitor Details · Photo Capture ·
Movement · Remarks.

### Existing doctypes touched

| Doctype | Change | Why |
|---|---|---|
| Institution, College, Academic Year | `Gate Security` read/report/select permission row | Frappe requires read on a Link's target to select it; without this the form's pickers are empty |

### Where the photo goes

`photo` is `Attach Image`, so the column holds a URL — `/private/files/<name>` — and the bytes live
under `sites/erp.localhost/private/files/`. Every upload also creates a `File` record carrying
`attached_to_doctype` / `attached_to_name` / `attached_to_field` back to the pass.

**Private, not public**, and that matters: a public file is served straight off disk at `/files/<name>`
with no login and no permission check, and this one sits beside an Aadhaar number. Frappe defaults
attachments to private unless `make_attachment_public` is set on the field or `make_attachments_public`
on the DocType — neither is set here. The uploader still shows a "Private" toggle an operator could
untick, so it is a default rather than a guarantee.

### Explicitly not built

Each of these was reachable and skipped on purpose:

- **Gate master** — one gate assumed; `college` records where. Arrives when a campus has several
  gate points that need telling apart.
- **Admission Source master** — the five reference routes are a Select. It becomes data when
  someone needs to add a route without a schema change; the Admissions slice is the likely moment.
- **Admission Enquiry** — the pass *is* the enquiry record for now. The Admissions slice turns it
  into a funnel with stages.
- **`Staff.department`** — no journey needs it. `designation` already does the disambiguating that
  J1.6 requires; department is reporting roll-up, and the HR slice adds it in one field.
- **`campus` on the pass** — `college` already resolves to one, and a second picker at the gate buys
  nothing until multi-campus colleges exist.
- **Tenant validation on the typed referrers** — impossible, not skipped. `student_reference` and the
  three staff slots hold names, not records, so there is no institution on the other end to compare.
  The tenant guarantee covers the two Link referrers and stops there.

## 6. Server logic

Controller [admission_gate_pass.py](../../erp/gate/doctype/admission_gate_pass/admission_gate_pass.py),
`validate` in order: `set_academic_year` → `clear_unused_reference` →
`validate_conditionally_mandatory` → `validate_hierarchy` → `validate_aadhaar` →
`validate_phone_number` → `validate_reference_staff` → `validate_movement`.

**The order is load-bearing.** Clearing runs before the hierarchy check, because a referrer belonging
to a route the desk has already moved off is about to be discarded — validating it first would let a
stale value nobody can see block a legitimate save.

**`validate_conditionally_mandatory` exists because `mandatory_depends_on` does not fire on save.**
It appears nowhere in `frappe/model/`; Frappe's own `_get_missing_mandatory_fields` reads `reqd`
alone. So the four `mandatory_depends_on` rules in this doctype's JSON are Desk *form* behaviour and
protect no API path — and the SPA, which never loads Desk form scripts, would have posted a
"Consultancy Reference" pass naming no agency. Verified by probe before the guard was written.

**Hierarchy.** Seven `validate_same_parent` calls, reusing
[../../erp/master/hierarchy.py](../../erp/master/hierarchy.py) — no new ancestry logic anywhere in
this slice. The three referrer links are checked as well as the ancestors, because a Staff or
Consultancy from another institution named on this pass is precisely the cross-tenant contamination
that guard exists to stop.

**Endpoint.** `erp.api.gate.gate_pass.mark_exit(pass_name)`, whitelisted POST, in
[../../erp/api/gate/gate_pass.py](../../erp/api/gate/gate_pass.py). A deliberate exception to the
[frappe-api](../../.claude/skills/frappe-api/SKILL.md) skill's "don't wrap CRUD" rule, for two
reasons specific to a gate log: the exit time must be the **server's** (a wrong workstation clock
would silently rewrite the audit trail), and leaving must not be repeatable (an update call would
happily overwrite a real departure with a later one).

## 7. Frontend

**Read-only in the SPA; writes still in Desk.** The original decision here was "none this slice —
Desk UI only", and what that deferred was the *surface*, not the journeys: J2's "find the pass, or
filter the list to status Inside" is a list screen, and it was written before any code.

The generic doctype screens now serve it:

- `/gate/admission-gate-pass` — the list, with the **Status** filter J2 asks for and search across
  `student_name`, `phone_number` and `aadhaar_number`.
- `/gate/admission-gate-pass/<name>` — one pass, read-only, laid out in the sections this JSON
  authored. `depends_on` is honoured, so a pass with no vehicle does not show an empty Vehicle
  Number, and only the reference route actually used appears.

Both are rendered by [../../frontend/src/screens/doctype/pages/DoctypeListScreen.tsx](../../frontend/src/screens/doctype/pages/DoctypeListScreen.tsx)
and `DoctypeRecordScreen.tsx` from `erp.api.doctype.get_doctype_schema` — there is no gate-specific page.

**Still Desk-only, and why:** creating a pass, editing one, and **Mark Exit**. `photo` is `reqd: 1`
and an `Attach Image`, so a pass cannot be created before its file exists — the SPA has no upload
path yet, and a create form that cannot satisfy a mandatory field is worse than no create form. The
`Mark Exit` action waits on the same work.

**`link_filters` do not reach the SPA.** The picker scoping described below is a Desk-client rule
only — its sole runtime consumer is `frappe/public/js/frappe/form/controls/link.js`, and nothing
checks it on save. When SPA writes land they must re-implement it; the parsed form is already
published by `erp.api.doctype.get_doctype_schema`. See [../DATA-MODEL.md](../DATA-MODEL.md).

The client script [admission_gate_pass.js](../../erp/gate/doctype/admission_gate_pass/admission_gate_pass.js)
does the form work: cascade-clears referrers when the college changes, clears the other routes when
the reference changes, and adds the **Mark Exit** button while the pass is Inside — refusing it on a
form with unsaved edits, since marking the exit reloads the document and would discard them.

Picker scoping lives in **`link_filters` on the JSON, not `set_query` in the script**. A `set_query`
only applies on the form; `link_filters` also covers the quick-entry dialog and list-view pickers.
Since `reference_staff_1` is required, an operator clicking "Create a new Staff" gets a quick-entry
dialog — and with script-only filtering its college picker listed every tenant's colleges, failing
only at save.

The `Gate` workspace surfaces the doctype, which is what puts it in the SPA module rail and, now,
what generates its screen routes.

## 8. Other surfaces

- **Photo capture** — an `Attach Image` field. Frappe's own uploader offers the webcam, so no custom
  capture component is needed to get what the mockup shows.
- **Print format for the pass** — not built. "Generate Pass" currently means "save the record".
- Parent notifications, QR / ID-card scanning, approval workflow — none.

## 9. Institution coverage

The same record serves a school and a college without a branch anywhere in this slice: `college`
links to College, whose `college_type` already includes **School** alongside Engineering, Arts &
Science, Medical, Polytechnic, MBA and Law ([../PRODUCT.md](../PRODUCT.md)). A parent enquiring
about Class 6 and a student enquiring about B.E. CSE produce the same shape of pass.

Nothing here reads `terms_per_year` or `term_label`, because nothing here is expressed in terms.

## 10. Non-goals

Turning the enquiry into an application, seat allotment, fee collection, and the other four pass
families in the sidebar mockup (visitor, hostel, staff, material).

"Any SPA screen" was listed here and no longer is — read-only list and record screens exist (§7).
What remains out: SPA create/edit, SPA **Mark Exit**, photo capture in the browser, a print format,
QR / ID-card scanning, and bulk actions.

## 11. Verification

```bash
bench --site erp.localhost migrate
bench --site erp.localhost run-tests --app erp
bench --site erp.localhost run-tests --module erp.gate.doctype.admission_gate_pass.test_admission_gate_pass
```

**42 tests pass** (12 pre-existing hierarchy + 30 from this slice). They cover: a valid pass inserts
with a UUID `id` and status Inside · academic year auto-fills from the open admission year, and
re-derives when the college moves tenant · college, staff and consultancy from another institution
each throw · a route naming no referrer, and a ticked vehicle with no number, each throw · Aadhaar
and phone normalisation and rejection · switching the reference clears the stale referrer · duplicate
staff in any of the three slots throws · `out_time` before `in_time` throws, and a later one flips
status · a consultancy code duplicated within one institution throws, on insert *and* on edit.

Several of these were mutation-tested — the guard was removed and the suite re-run to confirm the
test actually fails without it, rather than passing for an unrelated reason.

Then walk J1 and J2 by hand at `/app/admission-gate-pass/new`.

## 12. Open questions

- Should `Gate Security` see passes for **every** college, or only the ones they are posted to? User
  Permissions would scope it, but nothing needs that until a second campus goes live.
- Does the pass need a print format — "Generate Pass" producing something the visitor carries?
- The other four pass families share `in_time` / `out_time` / `status` / photo. Whether they become
  separate doctypes or share a base is a decision for whichever is built next.
