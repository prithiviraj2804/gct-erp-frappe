# Slice: Admission — Professional, Management Quota

## 1. Summary

A nursing or MBA seat that the institution gives **itself**. The applicant walks in, the office
checks that they hold the qualification and the marks the intake demands, the institution decides,
the money is settled, and the student is admitted. No counselling body is involved at any point —
and yet the institution sits under Institution Type `Professional` (`erp/seed.py:43-48`), where
`Nursing` and `MBA` are leaves (`erp/seed.py:53-54`), and inherits a Field Policy written for a
TNEA candidate.

The app is *nearly* right for this. `assert_allotted_to_us` is already conditional — it returns
immediately when the route is not `Government Quota` (`erp/admission/pipeline.py:136-142`), and the
comment above it states the reason correctly: *"a management-quota or direct seat is the
institution's own to give, and no external body allots it"*. `derive_application_state` guards the
whole counselling branch the same way (`erp/admission/application_state.py:56`). The gate is not the
defect. **The default is.** `admission_route` is `reqd: 1` and defaults to *Government Quota*
(`admission_application.json:124-131`), nothing derives that default from the institution, and a
`Field Policy` structurally cannot override it. So the one field that decides whether this whole
journey works is set wrong out of the box, on every management seat, in an institution type where a
management seat is the normal case.

The second defect is quieter and worse. For a government-quota seat, eligibility was enforced by the
external body before the allotment ever reached us. For a management seat the institution is the
**only** enforcer — and the app's marks bar, `Programme Intake.min_percentage`, is enforced nowhere
at all.

## 2. Personas

- **Admission Counsellor** — takes the walk-in, records the qualification and marks. Cannot admit.
- **Admission Manager** — the institution's admission head. Issues the offer, and confirms admission.
- **Accounts Manager / Cashier** — unchanged; and see §4 on what money they can actually record.

## 3. Journeys

1. *Apply.* Paid lead → `start_application` (`erp/api/admission/application.py:25-72`), which seeds
   the programme, intake, admission type, the first preference and the intake's document checklist.
   Unchanged.
2. *Check eligibility.* Two things, and today only one and a half of them happen: the applicant must
   **hold** the qualification the programme names, and must have **cleared the bar** the intake sets.
3. *Decide.* The institution issues its offer with an expiry; the applicant accepts. This is the
   institution's own decision and it already has a record — see §5, where it is the reason no new
   doctype is created.
4. *Settle the money.* Out of scope, honestly and deliberately — see §4.
5. *Admit.* Documents verified, seat free, `confirm_admission` writes the `Student`. Unchanged,
   **once the route is right**.

## 4. What the app does today, and where it misfits

### 4.1 The route default, and what an operator must do about it

`admission_route` is a `Select` of `Government Quota / Management Quota / Direct`, `reqd: 1`,
`default: "Government Quota"` (`admission_application.json:124-131`).

What an operator must do today, exactly: on the Admission Application, **change `admission_route`
from *Government Quota* to *Management Quota*** (or *Direct*) and save. That is the whole remedy, and
it works — `pipeline.py:142` returns before the outcome is ever inspected, and the Desk form even
hides the counselling machinery, because `counselling_outcome` and the whole Entrance & Allotment
section carry `depends_on: eval:doc.admission_route=='Government Quota'`
(`admission_application.json:139` and `:282`).

What happens if they don't: `derive_application_state` sees a government-quota application whose
`counselling_outcome` is still its own default of *Awaited* and returns `Awaiting Counselling`
(`application_state.py:56-60`); `confirm_admission` calls `assert_status_transition`, which calls
`assert_allotted_to_us`, which throws *Allotment Awaited* (`pipeline.py:153-157`) — for a nursing
seat nobody is going to allot.

Stuck, then, but not deadlocked: one field edit clears it. What makes it expensive is *when* it
fails. It does not fail at the point of the mistake; it fails weeks later at the admission desk,
with a message about a body the institution has never dealt with, and in the meantime every
management application in the funnel reports as *Awaiting Counselling* — a number the trust reads
and believes.

Nothing prompts the change. Nothing on `Institution` or `Institution Type` says which route is normal
here. And the field cannot be configured:

- `FieldPolicy.validate_not_statically_required` refuses any rule carrying a `requirement` on a
  `reqd: 1` field, and explains why — `_validate_mandatory` runs after `validate`, so the JSON always
  wins (`erp/master/doctype/field_policy/field_policy.py:185-213`).
- `Field Policy Rule` has no default-override property at all. Its data fields are `fieldname`,
  `requirement`, `label_override`, `display_order`, `min_value`, `max_value` and
  `description_override` (`erp/master/doctype/field_policy_rule/field_policy_rule.json`), and
  `ResolvedField` mirrors exactly those (`erp/field_policy.py`).
- And `apply_field_policy` is called from exactly one controller — `admission_enquiry.py:43`.
  **`Admission Application` is not policy-governed at all**, which
  `erp/field_policy.py:52-56` now declares outright: `GOVERNED_DOCTYPES` holds
  `Admission Enquiry` and nothing else, and `erp/test_conventions.py:258-298` fails if that set
  drifts from the controllers that actually call the enforcer.

`docs/CONFIGURATION.md:146-171` reaches the same conclusion from the other direction and has already
been retitled *"target state, not today"*: its worked example targets `Admission Application`, names
five fieldnames that exist nowhere else in the app, and asks for a `default` property that
`Field Policy Rule` does not have. Two consequences for **this** slice, and they cut against each
other:

- The route default cannot come from the configuration layer even after that layer is extended to
  the application, because a *default* is not one of the properties a policy merge composes
  (`erp/field_policy.py`'s `ResolvedField` carries requirement, label, description, order and two
  bounds — nothing that seeds a value).
- So the capability on `Institution Type` in §5 is not a workaround waiting for a better layer. It
  is the right home: a default route is a property of *a kind of institution*, which is exactly
  what that tree is for, and it is what `requires_department` already is.

### 4.2 The inherited Professional policy asks for facts this seat does not have

A Nursing institution's scope chain is `All` → `Professional` → `Nursing` → the institution
(`erp/field_policy.py:75-97`, ancestors furthest-first), so it inherits the shipped `Professional`
policy: `min_value: "0"` on `cutoff_marks` and on `entrance_rank` (`erp/seed.py:109-122`). The
policy's own description is careful and correct about what it is for — *"Engineering, medical, law and
the rest admit through an entrance exam and a rank"* (`erp/seed.py:112-117`) — and a management seat
admits through neither. The bounds are harmless in themselves; what they signal is that the entrance
block is *part of this institution's enquiry*, which for a management-quota nursing seat it is not.

Worth noting while we are here: one of the two rules buys nothing. `entrance_rank` already carries
`non_negative: 1` in the schema (`admission_enquiry.json:493-497`), so the floor was already there.
The only rule in the shipped `Professional` policy that changes behaviour is the one on
`cutoff_marks`.

### 4.3 The marks bar is collected and enforced nowhere

`Programme Intake` carries `min_percentage` — *"Minimum qualifying-exam percentage (0–100), if any"*
(`programme_intake.json:117-122`) — and `eligibility_criteria`, free text, *"e.g. 10+2 with PCM"*
(`:124-128`).

`grep -rn min_percentage erp/ --include=*.py` returns **one line**:
`erp/master/doctype/programme_intake/programme_intake.py:36`, inside `validate_percentage`, which
checks only that the number an administrator typed lies between 0 and 100. Nothing reads it when an
application is saved. `eligibility_criteria` is read by nothing whatsoever.

`AdmissionApplication.validate_eligibility` (`admission_application.py:150-163`) does exactly two
things: `assert_prior_qualification`, which checks that a row with the required
`qualification_level` **exists** (`erp/admission/eligibility.py:44-59`), and
`assert_age_within_window` (`programme_intake.py:86-129`). It never looks at a percentage — even
though `enquiry_education` already fetches that column off the child rows
(`eligibility.py:62-71`, returning `qualification_level`, `percentage`, `year_of_passing`).

So an intake stating 50% admits a 35% candidate silently, and the free-text criteria are a note to a
human that no code can read. On a government-quota seat that gap is partly covered by the counselling
body, which will not allot an ineligible candidate in the first place. On a management seat there is
nothing behind it. The institution's own bar is the only bar, and it is decorative.

## 5. Masters the journeys name

**None.** That is the finding, not an omission.

The build rule says a master is created only when a journey requires it, and this journey requires
none. Working through what it might have justified:

- **The institution's decision** is already recorded. `offer_issued_on`, `offer_expires_on`,
  `offer_response`, `offer_response_on` exist on the application
  (`admission_application.json:340-364`), and `assert_admissible` already enforces that an issued
  offer was accepted, and not after it lapsed (`pipeline.py:160-186`). The previous slice wrote that
  code with this exact case in mind — *"a management-quota seat is often settled across a desk"*
  (`pipeline.py:162-163`). An `Admission Offer` doctype would be a second home for facts that
  already have one.
- **The eligibility rule** is already data. `min_percentage` is on the intake; the row it applies to
  is named by `Programme.required_prior_qualification`. `Eligibility Rule` is booked for slice 7
  (`ROADMAP.md:28`) and is not needed to enforce a bar that is already stated.
- **A reservation category** is not needed: a management seat is not a quota seat. It belongs to the
  arts & science slice, which counts them.
- **`Fee Head` / `Fee Structure`** would be the honest home for the money in J4, and they are
  backlogged (`ROADMAP.md:55`). Building them here to serve one journey would be the largest
  speculative master in the app.

**Grown, not created:**

| change | where | why (justifying journey) |
|---|---|---|
| `default_admission_route` capability | `Institution Type` | J1 — the route a new application starts on |
| The capability's shipped rows | `erp/seed.py` | J1 — blank at `Professional`; `Nursing`/`MBA` state their own |
| The marks-bar rule | `erp/admission/eligibility.py` | J2 — beside `assert_prior_qualification` |
| A `Field Policy` at `Nursing` / `MBA` | `erp/seed.py` | J1 — hide an entrance block the type does not use |

`default_admission_route` follows `requires_department` exactly: a capability on the Institution Type
tree, resolved nearest-first by `resolve_capability`
(`erp/master/doctype/institution_type/institution_type.py:75-114`, `CONFIGURATION.md:45-51`),
shipped blank at `Professional` so the leaves decide. It must be a
**`Select` with a blank option, never a `Check`** — `frappe/database/schema.py:182` makes `Check` and
`Int` `NOT NULL DEFAULT 0`, so neither can mean "inherit" (`DATA-MODEL.md:112-124`); this is the same
trap `requires_department` already avoids by being `Yes`/`No`/blank.

## 6. States

Nothing new. `Admission Enquiry.status` remains the one pipeline; `application_state` remains derived
in `validate` (`admission_application.py:179-181`). The only change is which branch of
`derive_application_state` a management application enters: because the counselling branch is already
route-guarded at `application_state.py:56`, an application that starts on *Management Quota* goes
straight to the document and offer states and never sees *Awaiting Counselling*. That is the existing
code working as written, once the route it reads is correct.

`counselling_outcome` keeps its stored default of *Awaited* on such an application, and that is fine:
`depends_on` hides it in the form, and nothing reads it unless the route says to. It is not worth a
migration to blank a field no code consults.

## 7. Decisions

- **The route default belongs on `Institution Type`, not in a Field Policy and not in Python.** A
  Field Policy cannot express it (§4.1), and a `if institution_type in (...)` branch is exactly what
  slice 3 deleted twice over (`ROADMAP.md:16`). The capability pattern already exists, already
  resolves through the tree nearest-first, and already ships blank at group nodes so a leaf can
  differ — which is the whole reason `Nursing` was addable as one row (`CONFIGURATION.md:36`).
- **A default, not a lock.** A nursing institution may still take a government-quota seat in the same
  year. `default_admission_route` is applied on a new application and then editable, the way
  `set_academic_year` stamps the open admission year without forbidding a correction
  (`admission_enquiry.py:87-105`). Making it read-only would trade one deadlock for another.
- **The marks bar goes in `eligibility.py`, next to the qualification rule, because it has the same
  two readers.** The enquiry checks the programme the applicant asked about; the application
  re-checks against the programme actually being admitted to, and that re-check is the entire reason
  the module exists (`eligibility.py:4-16`). A bar enforced only on the enquiry would be bypassed by
  every change of branch.
- **The bar applies to the row the programme already names.** An applicant's `previous_education` may
  hold 10th, 12th and a diploma; a bar of 50% is meaningless until it says 50% *of what*. Rather than
  add a "which qualification" field to the intake, the bar applies to the row whose
  `qualification_level` equals `Programme.required_prior_qualification` — the row
  `assert_prior_qualification` already insists on. One statement of the entry qualification, two
  rules reading it.
- **`min_percentage` is a `Float`, so `0` and "not stated" are the same value — and here that is
  safe.** `frappe/database/schema.py:182` makes it `NOT NULL DEFAULT 0` (`DATA-MODEL.md:112-124`), so
  the tri-state rule says it cannot mean "inherit". A 0% bar admits everyone, which is
  indistinguishable from no bar, so a truthiness test loses nothing — which is why
  `programme_intake.py:36` already writes `if self.min_percentage`. Said out loud here so the next
  reader does not "fix" it into a `is not None` check and start throwing on every intake that left it
  blank.
- **The bar is inclusive at the boundary.** A bar of 50 admits exactly 50.0. "50% and above" is how
  every prospectus in the country words it, and an exclusive comparison would reject the candidate
  the number was written for.
- **The money in J4 is out of scope, and the doc says so rather than improvising.** `Fee Payment`
  books one thing: `fee_payment.py:76` sets `amount` from `Programme Intake.application_fee`,
  "never a client value", the doctype has no `fee_type`
  (`erp/accounts/doctype/fee_payment/fee_payment.json`), and `record_application_fee` is its only
  orchestrated writer (`erp/api/accounts/fee_payment.py:21-49`). The pipeline's only fee gate is
  satisfied by the application fee alone (`erp/admission/fee_gate.py:24-44`). A management-quota
  student admitted today therefore has **no record of an admission payment**, and this slice does not
  invent one — it records the gap and leaves it to the fee-structure slice.
- **The `Nursing`/`MBA` Field Policy hides, and does not require.** Same discipline as the shipped
  policies: state what is structurally true of the type and leave "required" to the trust
  (`erp/seed.py:89-92`).
- **Nothing touches the reporting spine.** `application_state`, `programme`, `programme_intake`,
  `institution`, `trust` and `application_date` are spine on `Admission Application`
  (`erp/master/doctype/field_policy/field_policy.py:45-55`); `admission_route` is not, and is not
  governed by a policy anyway.
  A management-quota nursing admission counts in the Admission Funnel exactly like a TNEA one.

## 8. What we do not know, and must ask before building

- **Whether GEI's nursing/MBA institutions have *any* government-quota intake.** If they do, the
  route default is per **intake**, not per institution type, and the capability above is at the wrong
  level. This is the single question that decides the shape of the slice, and it is a question for
  the trust, not for the code.
- **The regulator's eligibility rules.** Indian Nursing Council and AICTE minima, and any state
  addition, are real numbers with real revisions, and they differ by category. **Do not seed a
  percentage.** `min_percentage` is per-intake operator data; the slice enforces whatever GEI states.
- **Whether the bar is on the aggregate or on named subjects.** `eligibility_criteria` currently says
  "10+2 with PCM" in its own example, which is a subject rule the schema cannot express and this
  slice does not attempt. If GEI's real rule is subject-wise, the bar as specified is insufficient
  and the free-text field must stay as the human-readable statement of record.
- **Whether a management seat has its own sanctioned count.** If the sanctioned intake is split
  government/management, `assert_seat_available` reading one `total_seats`
  (`pipeline.py:189-205`) will overfill one pool from the other, and this slice needs
  `Programme Intake Seat` — which is drawn in `DATA-MODEL.md:23` and does not exist. It is created
  by the arts & science slice for the category axis; the route axis is the same table.

## 9. Proof

1. **The route starts right.** On a Nursing institution, a new Admission Application reads
   `admission_route = "Management Quota"`; on an Engineering one it still reads *Government Quota*.
   Change the institution's `institution_type` from `Nursing` to `Engineering` and the default flips
   with **no code change and no policy row** — which is the whole claim of putting it on the tree.
2. **A management admission completes end to end.** From a paid nursing lead: `start_application`,
   verify the checklist rows, issue and accept an offer, `confirm_admission` → a `Student` exists,
   the lead reads *Admitted*, and `counselling_outcome` was never touched. Today the same script
   throws *Allotment Awaited* from `pipeline.py:153-157`.
3. **The government-quota path is unharmed.** The existing engineering TNEA test path still throws
   *Allotment Awaited* on an application with no outcome, and still admits on *Allotted To Us*. The
   full suite (223 green at `ROADMAP.md:18`) passes unchanged.
4. **The marks bar bites.** Intake `min_percentage = 50`; the applicant's education row for the
   programme's required qualification shows 35 → the application is refused, with the required and
   actual percentages both in the message. At 50.0 exactly it is accepted.
5. **A blank bar checks nothing.** Clear `min_percentage` (or leave it 0) and the same application
   saves. No existing test changes, because no existing fixture sets it.
6. **The bar follows the programme, not the enquiry.** Clear the enquiry on a programme with no bar,
   then move the application to a programme whose intake demands 60% with the applicant at 45% → the
   application is refused. This is the case `eligibility.py:4-16` was written for and the reason the
   rule is not in the enquiry's controller.
7. **The entrance block is gone from the form.** `resolve_policy("Admission Enquiry",
   institution=<nursing institution>)` returns `Hidden` for `entrance_exam`,
   `entrance_registration_no` and `entrance_rank`; the assertion is a checked-in dict per Institution
   Type, per `CONFIGURATION.md:138-144` — a gate that is specified there and not yet written
   (`erp/config/` holds only `__init__.py`).
8. **The trust can still count.** Admission Funnel columns unchanged for the nursing institution;
   `test_trust_reporting.py:173` and `:182` pass.

## 10. Documents this slice must correct

- `docs/ROADMAP.md:44` books the route default as a K-12 defect at `pipeline.py:142`. The line it
  names is the *fix*, not the fault, and the fault is not confined to K-12: it is every institution
  that gives its own seats, school, arts college and management-quota nursing alike.
- `docs/ROADMAP.md:26` gives slice 5 the proof "Raise a school application on route `Direct`; it
  reaches `Admitted`" — which already passes. The proof that matters is the one where nobody has to
  know to set the route.
- `programme_intake.json:117-122` describes `min_percentage` as the intake's minimum qualifying
  percentage, which a reader will take to mean it is applied. Until §5's rule lands, that
  description promises enforcement the app does not perform — the field's own text is the misfit's
  best evidence.
- `docs/CONFIGURATION.md:53-77` describes `erp/config/resolver.py` in the present tense; the module
  does not exist.

## 11. Explicitly not built (later slices)

Any admission or tuition payment (`Fee Head`/`Fee Structure`, `ROADMAP.md:55`) — so J4 records
nothing today; a management/government seat split on the intake (needs `Programme Intake Seat`,
created by the arts & science slice); subject-wise eligibility; `Eligibility Rule` as a doctype
(`ROADMAP.md:28`) — the bar is enforced from data already on the intake; NRI and supernumerary routes
(`admission_route` gains an option and, per `ROADMAP.md:26`, eventually becomes a master with a
`requires_allotment` flag); the config resolver — **`erp/config/resolver.py` does not exist**, only
`erp/config/__init__.py`, though `CONFIGURATION.md:53-77` describes it as built, so this slice uses
the `Institution Type` capability pattern and must not call `get_config`.
