# Slice: Admission — A School Admission (K-12)

## 1. Summary

A parent walks into a K-12 school, asks about a class, and a child ends up on the admission
register. There is no counselling body in this journey and no entrance exam. What sits between the
enquiry and the register is the school's own sequence: a registration, the institution's application
form, a check that the child is old enough for the class and that the transfer certificate and birth
certificate are real, a conversation with the parents or a short entry assessment, the fee, and the
admission.

The real institution is **GIS** ("Gnyanamani International School"), a K-12 school under the trust
**GEI**, alongside the engineering and arts & science institutions the earlier slices were built
against. Nothing here is a second admission pipeline. The claim this slice tests is the one the app
is built on — that a school and an engineering college are rows in one table, differing by
configuration — and the finding is that the claim holds for the *schema* and fails for the
*defaults*. A school application raised today through
the shipped path is stamped `Government Quota`, reports itself as `Awaiting Counselling`, and is
refused at the admission desk with a message about an allotment order that will never arrive. The
route out exists and is one Select away; nobody is told, and nothing in the test suite notices.

So this slice is mostly a slice about defaults, one about a form that cannot show what a school
reads, and one about a fee that today has no way of not being charged.

## 2. Personas

- **Admission Coordinator** — the school's counterpart to the Admission Counsellor. Takes the
  registration, raises the application, records the parent interaction or the assessment outcome,
  ticks documents off. Cannot admit. The role already exists as `Admission Counsellor`; a school
  calls the person something else and that is a label, not a second role.
- **Principal / Admission Manager** — per-institution admission authority. Everything the
  coordinator can do, plus confirming an admission (which writes the statutory register), plus
  approving a fee concession.
- **Accounts Manager** — the only role that may authorise a fee waiver and the only one that may pay
  money out.
- **Cashier** — takes the registration/application fee in, prints the receipt.
- **Trust Admin** — reads GIS and the engineering college in one report, and must be able to.

## 3. Journeys

1. *Register.* A parent enquires for a class — Class I, or a mid-year transfer into Class VI. The
   coordinator logs an `Admission Enquiry` against GIS: the child's name and date of birth, the
   parent's name and phone, the class asked for, and (for anything above the entry class) the school
   last attended. No department is named, because a class sits under none. No entrance field is
   shown, because a school does not admit on one.
2. *Apply.* The application fee is settled (paid, or waived — journey 5). The coordinator raises the
   `Admission Application`, which is the document the class teacher and the principal actually read:
   it carries the class applied for, the previous school, its board, the class completed and the
   marks, and the document checklist that class's intake publishes.
3. *Check the child fits the class.* Age as on the intake's cut-off date, and the documents:
   birth certificate, transfer certificate from the previous school, the last report card. Originals
   are seen and handed straight back.
4. *Interact or assess.* The school meets the parents, or the child sits a short entry assessment,
   or both. The outcome is recorded against the application as a recommendation. This is the step
   the counselling allotment occupies for an engineering seat, and it is the school's own decision —
   no external body is involved.
5. *Settle the fee.* Ordinarily the cashier collects the application fee and prints a receipt. Two
   cases do not: a statutory free seat, and a concession the school itself grants (a sibling already
   on roll, a staff ward). Those are approved, recorded, and produce **no** receipt — because no
   money moved.
6. *Admit.* On a free seat in the class, with the age window satisfied, the documents verified and
   the interaction recommended, the principal confirms the admission. A `Student` is written with a
   register number and the lead reaches *Admitted*.
7. *Count.* The Trust Admin opens the Admission Funnel and sees GIS and the engineering college side
   by side, in the same columns, adding to one total.

## 4. States

`Admission Enquiry.status` remains **the one pipeline** a human moves a lead along, unchanged:
`New → Contacted → Visited → Application Submitted → Documents Verified → Admitted`, with
`Rejected`/`Dropped` as off-ramps (`erp/admission/fee_gate.py:20`).

`Admission Application.application_state` remains derived, and **gains no new value**. A school never
visits `Awaiting Counselling` or `Not Allotted`; it moves
`Draft → Documents Pending → Documents Verified → (Offered → Accepted | Declined) → Admitted`. Two
unreachable options on a Select are harmless. A *new* option would not be: `application_state` is in
the reporting spine (`erp/master/doctype/field_policy/field_policy.py:49-51`), so a state only a
school could reach would put a column in the trust's funnel that two of its three institutions can
never fill. The school's own middle step is therefore recorded as a fact and enforced as a stage
gate, not promoted to a state — see §7.

New: `Admission Enquiry.application_fee_waived` (Check, read-only), mirroring the existing
`application_fee_refunded` pattern (`erp/admission/doctype/admission_enquiry/admission_enquiry.json:167-183`).
`application_fee_paid` keeps its meaning exactly — "set only by a submitted Fee Payment" — and a
waiver never touches it.

## 5. Where today's code misfits this journey

### 5.1 The route defaults to `Government Quota`. It is a bad default, not a deadlock.

`admission_route` is a Select of `Government Quota\nManagement Quota\nDirect`, `reqd: 1`, with
`"default": "Government Quota"`
(`erp/admission/doctype/admission_application/admission_application.json:124-132`). An operator who
accepts the default gets two effects. `derive_application_state`
(`erp/admission/application_state.py:56-60`) sees the government-quota route and a
`counselling_outcome` of `Awaited` — itself the field's default, `admission_application.json:136-138`
— and returns `Awaiting Counselling`. Then at the admission desk, `assert_status_transition` calls
`assert_allotted_to_us` (`erp/admission/pipeline.py:106`; defined `:136-157`), which throws *"Record
the counselling allotment before admitting this applicant"* (`:153-157`).

It is not a deadlock. `assert_allotted_to_us` returns immediately for any route that is not
`Government Quota` (`pipeline.py:142-143`), and `derive_application_state` skips its counselling
branch on the same condition. Setting the route to `Direct` on the form gets a school application
through to `Admitted` today, with no code change at all.

`docs/ROADMAP.md:26` says a school application is "blocked forever by the allotment gate" and then,
in the same table row, gives the proof "Raise a school application on route `Direct`; it reaches
`Admitted`". The second sentence is right and the first is not; `docs/ROADMAP.md:44` repeats the
"deadlocks" wording. Both need correcting when this slice lands.

The reason it still matters is that a default is what an operator gets when nobody tells them
otherwise, and this one does not fail at the point of the mistake. It fails weeks later, at the
admission desk, with a message about a body the school has never dealt with — and until then every
school application in the funnel reports as `Awaiting Counselling`, which is a number the trust
will read and believe. Nothing catches it: the only school-path tests
(`erp/admission/doctype/admission_application/test_admission_application.py:338`, `:351`, `:357`)
stop at `start_application` and never assert the state or admit the applicant.

### 5.2 `application_state` is a hardcoded precedence ladder

`derive_application_state` (`erp/admission/application_state.py:45-72`) is a fixed ladder: a produced
student, then the counselling outcome, then the offer, then the documents. For a school on route
`Direct` the ladder reads correctly — the counselling branch is skipped and the rest is a fair
summary of a school application.

The precise complaint is not that the counselling branch is dead weight for a school. Today it is
live and wrong, because §5.1 routes school applications straight into it. Once the route is data it
becomes correctly inert, and the branch stays because the engineering college needs it. What the
ladder genuinely cannot express is journey 4: there is no rung for the parent interaction or the
entry assessment, and no field anywhere carrying its outcome.

### 5.3 The application fee is unconditional, and one amount per intake

The gate is absolute: `assert_fee_paid_for_status` throws unless `application_fee_paid`
(`erp/admission/fee_gate.py:24`, `:38-44`), and `start_application` refuses to raise the application
at all without it (`erp/api/admission/application.py:51-57`). The amount is not a per-applicant
figure either — `FeePayment.set_ancestors_and_amount` overwrites `amount` with the intake's
`application_fee` on every validate, deliberately, so it "is always the intake's `application_fee`,
never a client value" (`erp/accounts/doctype/fee_payment/fee_payment.py:46-51`, `:76`). There is no
field on the receipt a discount could be entered in.

One lever exists and it is the wrong shape. `Programme Intake.application_fee` is `reqd: 1`, but a
`reqd` Currency is satisfied by zero — `has_content` stringifies the value and `cstr(0.0)` is
`"0.0"` (`frappe/model/base_document.py:956-969`, `:973`, frappe 16.31.0) — and a zero-amount receipt
posts no ledger entries (`fee_payment.py:34-35`) while still setting the flag and advancing the lead
(`:97-110`). So a fee-free *intake* works today. A fee-free *applicant* does not: an RTE seat and a
paying seat in the same Class I would have to become two `Programme Intake` rows, which splits the
class's sanctioned strength into two counts and doubles the class in every rollup that groups by
`programme_intake` — a spine field (`erp/master/doctype/field_policy/field_policy.py:49-51`).

Nor is ticking the flag an option. `application_fee_paid` is documented as "Set only by a submitted
Fee Payment" (`admission_enquiry.json:148-157`); a waiver that set it would leave the register
asserting a payment the ledger has no voucher for.

### 5.4 Field Policy governs the enquiry only, and the app's own worked example is unbuildable

`apply_field_policy` (`erp/field_policy.py:183-246`) has exactly one caller:
`erp/admission/doctype/admission_enquiry/admission_enquiry.py:43`. `AdmissionApplication.validate`
(`erp/admission/doctype/admission_application/admission_application.py:27-37`) does not call it, and
the layer now says so out loud: `GOVERNED_DOCTYPES` (`erp/field_policy.py:41-56`) holds
`Admission Enquiry` and nothing else, and `validate_document_type_is_governed`
(`erp/master/doctype/field_policy/field_policy.py:110-139`) refuses a policy for any other doctype
with *"Nothing applies a Field Policy to Admission Application, so every rule here would be silently
ignored"*. So the situation is not that a school's application policy would quietly do nothing — it
cannot be saved at all.

That is a better failure than the silent one it replaced, and it also means the fix is bounded and
checkable rather than a matter of remembering: `apply_field_policy` in the controller, the doctype
name in the frozenset, and `erp/test_conventions.py:258-300` asserts the two match in both
directions, so neither half can be shipped without the other. `erp.api.doctype` already publishes
the flag to the SPA (`erp/api/doctype.py:435`), so the client learns the application is governed the
moment the frozenset does.

The shipped School policy (`erp/seed.py:94-108`) hides `entrance_exam`,
`entrance_registration_no`, `cutoff_marks` and `entrance_rank` on the **enquiry**, and relabels
`previous_education` to "Previous School Record". All four entrance fields exist a second time on
`Admission Application` (`admission_application.json:265-321`), where nothing hides them. A school's
application form therefore still carries an "Entrance & Allotment" section; the only thing collapsing
it is a client-side `depends_on` on `admission_route == 'Government Quota'`
(`admission_application.json:282`), and `docs/DATA-MODEL.md:129-134` is explicit that `depends_on` is
advice, not a rule.

Worse, `docs/CONFIGURATION.md:113-120` presents the School policy as the app's canonical worked
example and names four fields — `previous_school`, `education_board`, `previous_class`,
`marks_percentage` — that **exist on no doctype in this app**. An operator typing that policy today
is refused three times over: at the doctype, as above; then row by row by `validate_fields_exist`
(`erp/master/doctype/field_policy/field_policy.py:165-183`), which is a hard error precisely because
a rule naming a field that does not exist is indistinguishable from a working one. The same table's
last line, `admission_route`
→ default `Direct`, is unbuildable twice over: `Field Policy Rule` has no default-value property at
all (its fields are `fieldname`, `requirement`, `label_override`, `display_order`, `min_value`,
`max_value`, `description_override`), and `admission_route` is `reqd: 1`, which
`validate_not_statically_required` (`erp/master/doctype/field_policy/field_policy.py:185-213`)
refuses to govern. Part of this slice's job is to make that section of CONFIGURATION.md true.

### 5.5 A class sits under no Department — and that part already works

`erp/seed.py:41` states `requires_department: "No"` on the `School` type;
`institution_requires_department` (`erp/master/doctype/institution_type/institution_type.py:100-114`)
resolves it through the tree and `AdmissionEnquiry.validate_department`
(`admission_enquiry.py:120-139`) skips the requirement. On the application, `department` is read-only
and derived from the programme (`admission_application.py:56-76`), so it lands blank, and
`validate_same_parent` is silent on a blank link (`erp/master/hierarchy.py:39-41`, `:50`). A class is
a `Programme` whose `programme_level` is one of the K-12 rungs seeded at `erp/seed.py:65-68`
(PRI / MID / SEC / HSC), with one `Programme Intake` per `Academic Year`.

Nothing here needs building. It is listed because it is the part of the model that already fits, and
it is the reason no school-only doctype is justified anywhere in this slice.

### 5.6 The prior-school record hangs off the wrong document

`previous_education` is a table on the **enquiry** (`admission_enquiry.json:458-464`) of
`Admission Enquiry Education` rows: `qualification_level` (a Select of
`10th / 12th / Diploma / ITI / Undergraduate / Postgraduate / Other`), `board_university`,
`institution_name`, `specialization`, `year_of_passing`, `percentage`, `register_number`.
`Admission Application` has no equivalent — its entire field list
(`admission_application.json:8-56`) says nothing about the school last attended except
`transfer_certificate_no` (`:272-277`). The application reaches those rows only through
`enquiry_education()` (`erp/admission/eligibility.py:62-71`), read back off the enquiry, and only to
answer the prior-qualification question (`admission_application.py:159-160`).

Two consequences. First, the application — the document the class teacher and the principal read, and
the one the register is written from, since `confirm_admission` copies every academic field off the
application (`erp/api/admission/admission.py:36-49`, `:99-118`) — cannot display the previous school,
its board, the class completed or the marks. Second, the vocabulary has no room for "Class V
passed": `Programme.required_prior_qualification` is the same Select, so a Class VI intake can only
say "nothing required" (blank) or misstate it as `10th`. The existing test that proves a school class
can require a prior result uses Class 11 and the value `10th`
(`erp/admission/doctype/admission_enquiry/test_admission_enquiry.py:298-317`) — the one K-12 boundary
the board-milestone vocabulary happens to name.

### 5.7 Age as on a cut-off date — already enforced, and enforced well

This is not a gap. The rule is stated as data on the intake rather than as a branch on the
institution's type: `min_age`, `max_age` and `age_as_on` on `Programme Intake`, with
`validate_age_window` (`erp/master/doctype/programme_intake/programme_intake.py:39-62`) refusing a
bound that has no cut-off date, because "under 5" is unmeasurable without saying when (`:58-62`).

It is enforced on the **application**, at `admission_application.py:163` inside `validate_eligibility`
(`:150-163`) — on the application and not the enquiry because the intake is the document that carries
the window, and only the application names the intake. `assert_age_within_window`
(`programme_intake.py:86-129`) reads the three fields and computes whole completed years with
calendar arithmetic (`:109`) rather than `date_diff(...) // 365`, for the reason its docstring gives
at `:94-97`: dividing by 365 loses leap days and reports a child born on 2 June as five years old on
the 1 June before their birthday — an off-by-one landing exactly on the boundary the rule exists to
police. Outside either bound it throws with the computed age and the cut-off date in the message
(`:111-129`).

Two limits, neither a defect. It is silent when the intake sets no window (every degree programme)
and silent when the date of birth is unknown (`:98-99`), and the date of birth it reads is the
**enquiry's** (`admission_application.py:162`), which is not `reqd`
(`admission_enquiry.json:316-320`). A school that wants the age rule to actually bite must therefore
make `date_of_birth` required — and it can, today, with a Field Policy rule at scope `School`: the
field is not `reqd: 1` in the JSON and is not in the reporting spine
(`erp/master/doctype/field_policy/field_policy.py:46-48`), so both of Field Policy's refusals pass.
That is one configuration row, not a code change, and it belongs in this slice's seed. It also lands
with exactly the right blast radius: `_required_binds` (`erp/field_policy.py:254-285`) applies a
Required rule unconditionally on insert but, on an existing document, only to a field the writer is
actually changing — so every *new* school enquiry must carry a date of birth while last term's
DOB-less leads stay editable rather than becoming unsaveable.

## 6. Masters & doctypes the journey requires

| doctype | module | why (justifying journey) |
|---|---|---|
| `Admission Route` | Master | J2/J6 — the route must become data carrying `requires_allotment`, so a school's default is stated per institution type and the allotment gate stops comparing against a literal |
| `Education Board` | Master | J2/J7 — the application records the board the child comes from and the trust counts intake by it; free text makes "CBSE", "C.B.S.E." and "Cbse" three boards |
| `Fee Concession Category` | Accounts | J5 — a fee-free or fee-reduced seat must name its ground and who approved it, or a waiver is a receipt that is simply missing |

Three masters, at minimum fields. `Admission Route`: `route_code`, `route_name`,
`requires_allotment` (Check), `status`, `id`. `Education Board`: `board_code`, `board_name`,
`status`, `id` — seeded with the boards this trust's institutions actually receive students from,
not a pretend national register. `Fee Concession Category`: `concession_code`, `concession_name`,
`waives_application_fee` (Check), `status`, `id`. A `Check` is honest on both of those because
neither cascades, so neither needs to distinguish "no" from "not stated"
(`docs/DATA-MODEL.md:112-121`).

**Grown, not created:**

- `Institution Type` gains `default_admission_route` (Link → `Admission Route`) and
  `requires_admission_interaction` (Select, blank/Yes/No), both read by the **existing**
  `resolve_capability` (`institution_type.py:75-97`) exactly as `requires_department` is. A nullable
  Link is genuinely tri-state, so blank still means inherit.
- `Admission Application` gains `previous_school` (Data), `education_board` (Link →
  `Education Board`), `previous_class` (Data), `marks_percentage` (Float) — the four fields
  `docs/CONFIGURATION.md:113-120` already promises — plus the interaction block `interaction_on`
  (Date), `interaction_mode` (Select), `interaction_outcome` (Select:
  blank/Recommended/Not Recommended), `interacted_by` (Link → `Staff`) and `interaction_remarks`.
  `admission_route` becomes a Link to `Admission Route`, keeps `reqd: 1`, and loses its static
  default: it is filled in `validate` from the resolved capability, which runs before
  `_validate_mandatory` (`erp/master/doctype/field_policy/field_policy.py:188-191`).
- `Admission Enquiry` gains `fee_concession` (Link → `Fee Concession Category`),
  `fee_concession_approved_by` (Link → `Staff`), `fee_concession_reference` (Data — the sibling's
  register number or the state's RTE reference goes here) and `application_fee_waived` (Check,
  read-only, derived).
- `AdmissionApplication.validate` calls `apply_field_policy`, **and** `"Admission Application"`
  joins `GOVERNED_DOCTYPES` (`erp/field_policy.py:41-56`). Two lines that must land together, which
  is what `erp/test_conventions.py:258-300` exists to guarantee; together they are the thing that
  makes CONFIGURATION.md §6 true rather than aspirational.
- `erp/admission/pipeline.py` gains a fourth rule — the interaction gate — composed into
  `assert_status_transition`, which is precisely what its docstring invites (`pipeline.py:9-13`).
  `assert_allotted_to_us` reads `Admission Route.requires_allotment` instead of the
  `GOVERNMENT_QUOTA` literal (`application_state.py:23`), and `derive_application_state` does the
  same.
- `erp/admission/fee_gate.py` asks whether the fee is **settled** — paid or fully waived — rather
  than paid. `start_application` (`erp/api/admission/application.py:51-57`) asks the same question.
- `erp/seed.py` gains: the `Admission Route` and `Education Board` rows; a School Field Policy for
  `Admission Application` (the four school fields Required, the four entrance fields and
  `allotment_reference` Hidden); `date_of_birth` Required on the School enquiry policy; and
  `default_admission_route` = `Direct` on `School`, `Government Quota` on `Professional`.

**Deliberately not created, and why:**

- No `Previous School` master. A school does not maintain a register of every feeder school, and a
  Link would force an operator to create a master row for a one-off transfer from another district.
  `previous_school` stays free text; the *board* is the part anyone counts by.
- No `Admission Assessment` doctype. One interaction per applicant is a field block; more than one
  round is a child table. Which it is depends on a fact about GIS I do not have — see §8.
- No `Guardian` or `Sibling` table. A sibling concession needs the sibling's register number, and
  `fee_concession_reference` holds it. A relationship model is a later slice with its own journeys.
- No `Programme Intake Seat`. The size of a statutory quota is a seat-matrix question, reserved for
  roadmap slice 7; this slice models the fee waiver only, and says nothing about how many such seats
  a class has. (Note that `docs/DATA-MODEL.md:23` draws `Programme Intake Seat` inside the *built*
  hierarchy, though no such doctype exists in `erp/master/doctype/`.)
- No `Qualification` master. §5.6's "Class V passed" problem is real, but this journey does not need
  it: a school's entry class requires nothing prior, and Class XI requires the board milestone the
  existing Select already names. Recording what the child completed (`previous_class`) is enough
  here; *enforcing* a per-class prerequisite needs the master and is deferred to roadmap slice 5.
- No school-only doctype, pipeline, or `institution_type` branch anywhere.

## 7. Decisions

- **The school's difference is a default, not a branch.** Every alternative considered here made the
  school a special case in code — a `School` test in `derive_application_state`, a second state
  ladder, a `school_admission.py` — and every one of them would have to be repeated for Nursing the
  next time a trust buys a college. The route becomes a row, the default becomes a capability on the
  type, and the two existing gates read data. That is the same move slice 3 made when it deleted the
  two `!= "School"` branches, applied to the one place the literal survived.
- **`Admission Route` is a master, not a longer Select.** The gate needs to ask a *question* of the
  route — does this route wait on an external allotment — and a Select can only be compared against
  a string. That comparison is the `GOVERNMENT_QUOTA` literal in `application_state.py:23`, and it is
  the reason an NRI or a sports route cannot be added without a deploy today.
- **The capability goes on `Institution Type`, not through the config resolver.** `docs/CONFIGURATION.md`
  §3 specifies `get_config` / `get_many` / `explain`, and `erp/config/` contains only `__init__.py` —
  the resolver is roadmap slice 4 and is not built. `resolve_capability`
  (`institution_type.py:75-97`) is built, walks the same ancestry, and already carries
  `requires_department`. Using it means this slice does not wait on slice 4, and moving two keys onto
  `Config Setting` afterwards is a data migration, not a redesign.
- **No new `application_state`, because the trust has to be able to count.** An "Assessment Pending"
  rung would be a column in the Admission Funnel that the engineering and arts & science
  institutions can never fill, which is the exact harm the reporting spine exists to prevent
  (`erp/master/doctype/field_policy/field_policy.py:33-55`, `docs/CONFIGURATION.md:133-151`). The
  school's step is recorded as a fact on the application and enforced as a *stage gate*.
- **The interaction is a stage gate, not a Required field.** Field Policy's `Required` is per
  document, not per stage: it binds on insert and thereafter on any save that touches the field
  (`erp/field_policy.py:254-285`), so requiring `interaction_outcome` for the School scope would make
  it impossible to *raise* the application before the interaction has happened. A stage-conditional
  rule has only one honest home — `assert_status_transition`, alongside the fee, document and seat
  gates, which is where the pipeline docstring says a fourth rule goes.
- **Four scalars on the application, not a second child table.** A school child has one previous
  school, one class completed and one mark; a degree applicant may hold a 10th, a 12th and a diploma,
  which is why the *enquiry* has a grid. Scalars are also the only shape the other two requirements
  accept. Report Builder can `GROUP BY education_board` on a column and not on a grid. And a Field
  Policy rule governs a *field*: `_is_blank` (`erp/field_policy.py:249-251`) treats an empty table as
  blank, so a whole-table `Required` rule is expressible — but a rule about one column inside a grid
  cannot be written at all, and `Hidden`/`Read Only` on a child table is now refused outright by
  `fieldtype_objection` (`erp/field_policy.py:343-370`) because reverting is a row operation dressed
  as a column write. A school configuring its application form therefore needs the four facts as
  four columns, or it cannot configure them. The enquiry's grid stays exactly as it is; nothing is
  migrated.
- **A waived fee creates no receipt.** A ₹0 `Fee Payment` would work — no GL entries are posted for a
  zero amount (`fee_payment.py:34-35`) and the flag is still set (`:97-110`) — and it would be a
  document asserting that money changed hands when it did not, sitting in the same list as real
  receipts and printable on the same print format. The waiver is recorded where it belongs, on the
  lead, with the category and the approver named.
- **A waiver never sets `application_fee_paid`.** That flag means a submitted receipt exists, and the
  ledger is the other half of the same statement. `application_fee_waived` is a second, separate
  fact, and the gate reads their disjunction — the same shape as the existing refund, which
  deliberately leaves `application_fee_paid` standing because "the fee *was* paid, and the refund is
  the evidence of what followed" (`docs/features/admission-application-to-student.md:94-96`).
- **The age rule is not rebuilt.** §5.7 is already correct, already lives on the intake as data, and
  already gets the leap-day arithmetic right. The only thing this slice adds is a configuration row
  making `date_of_birth` Required for a school, which is what turns a silent skip into a real check.
- **A partial concession does not open the gate.** If a category waives only part of the application
  fee, money is still owed, so the fee gate is unsatisfied until a receipt exists. Only
  `waives_application_fee` settles it. This keeps one rule instead of an arithmetic comparison
  between a category, a receipt and an intake.

## 8. What is not known, and must be asked before building

Stated plainly rather than guessed, because a wrong number written into a seed row becomes an
institution's policy.

- **RTE.** I know the Right of Children to Free and Compulsory Education Act, 2009 obliges specified
  private unaided schools to admit children from disadvantaged groups in the entry class, and 25% is
  the figure usually quoted for §12(1)(c). I have **not** verified which entry class it attaches to,
  which school categories are covered, whether GIS is covered at all, or how Tamil Nadu operates
  reimbursement. The design above therefore carries **no percentage anywhere**: a category, a flag
  and an approver, with the quota *count* deferred to the seat matrix. Confirm the real obligation
  before seeding a category named after it.
- **The interaction step itself.** Whether GIS runs a parent interaction, a written entry assessment,
  both, or neither; at which classes; whether the outcome is a recommendation or a score; and
  whether more than one round can happen for one applicant. If more than one can, the field block in
  §6 is the wrong shape and it becomes a child table.
- **Which concessions the school actually grants** (sibling, staff ward, alumni, single parent, …)
  and whether any of them is partial rather than full. If the common case is partial, the fee model
  needs an amount and this slice's "a partial concession does not open the gate" decision needs
  re-arguing.
- **Whether registration opens before the previous class's results are out.** If it does,
  `marks_percentage` cannot be Required at application time and must be gated at a later stage
  instead — the same shape as the interaction gate.
- **GIS's own board.** `Institution` carries `approval_number`, `affiliation_number` and an
  `accreditation` JSON blob, but no board field. If one institution runs both a CBSE and a
  state-board stream, "which board does this school teach" becomes a question this slice has not
  asked, and `education_board` on the *institution* is a separate decision from
  `education_board` on the application.
- **The per-class document checklist.** `Programme Intake Document` is where it lives and it is
  operator data, not code, so nothing needs building — but the classes cannot be opened for admission
  until someone states the list.

## 9. Proof

1. **Fresh site.** `bench migrate` seeds `Admission Route` (rows matching the three values the Select
   held, `Government Quota` alone carrying `requires_allotment`), `Education Board`, the School
   Field Policy for `Admission Application`, and `default_admission_route` on `School` and
   `Professional`. A test asserts that resolving `default_admission_route` returns `Direct` for a
   School institution and `Government Quota` for an Engineering one **with no row on either leaf** —
   inheritance through the tree, not two seeded values.
2. **The assertion no existing test makes.** Raise a school admission end to end without ever
   touching `admission_route`: an enquiry at GIS for Class I under GEI, no department, no
   previous-education row; the fee collected; `start_application`. The application saves with route
   `Direct` and `application_state` = `Documents Pending` — **not** `Awaiting Counselling`.
3. **The age window bites.** The LKG fixture already proves the window itself
   (`test_admission_application.py:117-127`, `:338-349`). Add the case that makes it real: with
   `date_of_birth` Required by the School policy, an enquiry with no date of birth is refused with
   *"This institution requires: Date of Birth"* (`erp/field_policy.py:242-246`), and the same enquiry at
   the engineering college saves.
4. **Documents.** The checklist is the intake's, already proven
   (`test_admission_application.py:357-367`: `BIRTH` for the school class, `MARK12`/`ALLOTMENT` for
   CSE). Verify the birth certificate and the transfer certificate; `application_state` reads
   `Documents Verified`.
5. **The interaction gate.** With `requires_admission_interaction` = `Yes` on `School`, moving the
   lead to `Admitted` is refused until `interaction_outcome` is `Recommended`; then
   `confirm_admission` writes the `Student` and the lead reaches `Admitted`. The same call on an
   engineering lead with every interaction field blank throws nothing.
6. **The engineering path is untouched.** The whole existing `test_admission_application.py` suite
   (33 tests, including the TNEA allotment path at `:231`) passes **without edits**. If any test needs
   editing, the route change was not backwards compatible and the migration is wrong.
7. **The waiver leaves the books alone.** An enquiry carrying a full `Fee Concession Category`
   reaches `Application Submitted` and then `Admitted` with **no** `Fee Payment` and **no**
   `GL Entry`: the trust's trial balance is byte-identical before and after, `application_fee_paid`
   is still 0, and `application_fee_waived` is 1.
8. **One report, two readers.** `Admission Funnel` run as Trust Admin shows GIS and the engineering
   college side by side, both counted through `application_state`, plus a Total. Run as an
   Institution Admin scoped to GIS it shows GIS only, with a Total equal to GIS's own numbers — and
   the report is the same report, not a school variant (`docs/CONFIGURATION.md:153-178`).
9. **Both forms, in a browser.** The school application shows Previous School / Board / Class
   Completed / Marks and no Entrance & Allotment section; the engineering application shows the
   reverse. Both come from `erp.api.field_policy.get_policy`, so the SPA branches on nothing —
   and the server refuses a hidden field's value either way, because `apply_field_policy` now runs
   in `AdmissionApplication.validate`. `erp.api.doctype` reports `governed: true` for
   `Admission Application` (`erp/api/doctype.py:435`), which is how the SPA knows not to draw the
   ungoverned superset.
10. **Reachability.** Every new master appears in a workspace, or
    `IntegrationTestWorkspaceReachability` (`erp/test_conventions.py:174-203`) fails the build.

## 10. Explicitly not built (later slices)

The RTE seat *quota* and the whole seat matrix (`Programme Intake Seat`, roadmap slice 7); tuition
fee structure and any concession against tuition, since no `Fee Head` / `Fee Structure` exists;
`Qualification` and the per-class prerequisite (roadmap slice 5); a `Programme Section` for the
divisions a class is split into; the per-year `Programme Enrolment` the roadmap reserves — promoting
Class VI to VII is not expressible today and this slice does not pretend otherwise; a parent-facing
registration portal; multi-round assessment; a sibling/guardian relationship model; class-teacher
allocation; the admission-register PDF and the school's own offer letter; and any use of the config
resolver, which is slice 4.

## 11. Documents this slice must correct

Recorded here because each is a statement in the docs that the code does not support, and a build
that leaves them standing perpetuates them.

- `docs/ROADMAP.md:26` and `:44` — a school application does not "deadlock"; the default is wrong and
  route `Direct` works today. The row's own Proof column already says so.
- `docs/CONFIGURATION.md:113-120` — the School worked example names four fields that exist on no
  doctype, on a doctype `GOVERNED_DOCTYPES` does not govern, with an `admission_route` default that
  `Field Policy Rule` has no property to express. This slice creates the four fields and governs the
  doctype; the `admission_route` line should be rewritten as a capability on `Institution Type`.
- `docs/CONFIGURATION.md:78-86` — the three-layer table should name the governed-doctype registry,
  since "which doctypes does Field Policy actually enforce on" is now a checked fact and not a
  reader's guess.
- `docs/DATA-MODEL.md:23` — `Programme Intake Seat` is drawn in the built hierarchy and does not
  exist in `erp/master/doctype/`.
- `docs/PRODUCT.md`, `docs/METHOD.md`, `docs/MODULES.md` and `docs/features/TEMPLATE.md` are
  referenced by `CLAUDE.md` and by the `feature-slice` skill and do not exist in this repository.
