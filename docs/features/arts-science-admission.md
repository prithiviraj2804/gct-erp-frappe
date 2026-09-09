# Slice: Admission — Arts & Science (merit, quota, call order)

## 1. Summary

GCE admits on **its own arithmetic**. There is no TNEA to wait for: an applicant's qualifying-exam
marks are added up, a merit number falls out, the reservation quota splits the seats, and the office
calls candidates down the list until the seats are gone. The institution is both the admitting
authority and the counselling body.

That is the journey this app serves **worst**, and not by a small margin. GCE's Institution Type is
`Arts & Science` (`erp/seed.py:42`), a child of `All` and a *sibling* of both types that carry a
shipped Field Policy — `School` (`erp/seed.py:94-108`) and `Professional` (`erp/seed.py:109-122`).
`erp/field_policy.py:75-97` builds the scope chain from the institution's type and
`get_ancestors_of(..., order_by="lft asc")`, which for GCE is `All`, then `Arts & Science`, then the
institution itself. No policy sits at any of the three, so `resolve_policy` accumulates nothing and
`apply_field_policy` returns at `erp/field_policy.py:207-208` before it looks at a single field.

An arts college's enquiry form is therefore the **raw engineering superset**, and it is the one form
in the app with no rules at all attached to it. The Entrance & Merit section is visible
(`admission_enquiry.json:466-469`), `entrance_exam`, `entrance_registration_no`, `cutoff_marks` and
`entrance_rank` all show, and `cutoff_marks` is unbounded in both directions: it is a plain `Float`
with no `non_negative` (`admission_enquiry.json:487-491`), and the only floor that exists anywhere
is the `Professional` policy's `min_value: "0"` (`erp/seed.py:119`), which GCE does not inherit. GCE
will save a cut-off of −12.5; GCT will not. That asymmetry is not a decision anyone made — it is the
shape of a seed file with a hole in it.

> The institution named in this doc is **GCE**, the Arts & Science institution under trust **GEI**
> ("Gnyanamani Educational Institutions"). The repo records the short code and the type but not the
> expanded institution name; do not put a long name on screen until the `Institution` row is read.

## 2. Personas

- **Admission Counsellor** — logs the enquiry and the applicant's marks. Cannot admit.
- **Admission Manager** — GCE's admission head. Publishes the merit list, and confirms an admission.
- **Principal / Admission Committee** — approves the list before it is published. Today this is a
  signature on paper; the slice gives it a state, not a new doctype (see §7).
- **Accounts Manager / Cashier** — unchanged from the application-fee slice.

## 3. Journeys

1. *Apply.* A walk-in becomes an enquiry, then a paid application. Identical to the existing slice —
   nothing here is arts-specific, and nothing should become so.
2. *Record the marks that decide it.* The qualifying-exam marks go on `previous_education`
   (`Admission Enquiry Education`, which already carries `qualification_level`, `board_university`,
   `percentage`, `year_of_passing` and `register_number`). This is already true today; what is
   missing is any consumer.
3. *Compute merit.* The application gets a **merit number derived from those marks**, against the
   qualification the programme itself names in `Programme.required_prior_qualification`. No entrance
   exam, no rank, no external body.
4. *Claim a quota.* The applicant states a reservation category and produces the certificate for it.
   The category is what the seat is counted against.
5. *Publish the call order.* For one intake and one round, the eligible applications are ordered by
   merit within category and **published** — a dated document the office reads down and the applicant
   is told their place in.
6. *Admit down the list.* Called applicants are admitted through the existing gates until the
   category's seats are full. Nothing about `confirm_admission` changes.

## 4. What the app does today, and where it misfits

**The form has no rules.** Covered in §1. The fix is a seeded `Field Policy` row at
`Arts & Science` — data, not code. It is worth saying plainly that the *entire* observable
difference between GCE and GCT today is one `min_value` on one Float, because the `Professional`
policy's second rule (`entrance_rank`, `erp/seed.py:120`) is already redundant: the schema carries
`non_negative: 1` on that field (`admission_enquiry.json:493-497`). The configuration layer is
doing less work than the seed file makes it look like it is doing.

**The institution computes merit; the app says it does not compute merit.** The Entrance & Allotment
section's own description reads *"The app does not compute rank or merit — it records what the
counselling body decided"* (`admission_application.json:279-283`). For a TNEA seat that is exactly
right and was the correct call. For GCE there **is** no counselling body, so the sentence resolves to
"the app records what GCE decided" — which is a way of saying GCE decides it in a spreadsheet and
types the answer in. `Admission Application.cutoff_marks` makes the same assumption explicit: *"The
cut-off the applicant reported, as computed by the admitting authority"* (`:266-271`). When the
admitting authority is the institution running the form, asking it to *report* the number it is
supposed to be *computing* is the misfit in one field.

Sharper still: the section holding that field is labelled **"Qualifying Marks"**
(`admission_application.json:261-263`) and contains a cut-off and a transfer-certificate number. It
contains no percentage. The only percentages in the app are on the enquiry's education child rows,
one level away from the document that decides the seat.

**There is no Merit List anywhere.** `grep -rni merit` over `erp/` and `docs/` returns three hits and
no doctype: the enquiry's section label (`admission_enquiry.json:468`), the disclaimer above
(`admission_application.json:283`), and the previous slice deferring the whole idea
(`docs/features/admission-application-to-student.md:120-121`). So a call order — "these sixty, in
this sequence, published on this date" — has no home. It is not that the feature is unfinished; it
has never been represented.

**There is no reservation category, on anything.** `reservation_category` appears exactly once in the
repository, in `docs/ROADMAP.md:26`, as a vocabulary master planned for slice 5. It is not among the
62 fields of `Admission Enquiry`, the 47 of `Admission Application`, or the fields of `Student`
(`erp/student/doctype/student/student.json` — which carries `admission_route` and
`allotment_reference` and no category). Meanwhile **Community Certificate** is a seeded document type
(`erp/patches/v1_0/seed_admission_document_types.py:27`), so the office can record that the original
of a community certificate was verified in the applicant's presence and cannot record *which
community it certified*. A quota roster is a count per category. There is nothing to count.

**The wrong default route is a GCE problem, not a K-12 problem.** `admission_route` is `reqd: 1`
with options `Government Quota / Management Quota / Direct` and a default of **Government Quota**
(`admission_application.json:124-131`). `derive_application_state` parks any government-quota
application with no outcome at *Awaiting Counselling* (`erp/admission/application_state.py:56-60`),
and `assert_allotted_to_us` refuses admission until the outcome is *Allotted To Us*
(`erp/admission/pipeline.py:136-157`).

It is a bad default and **not** a deadlock: `assert_allotted_to_us` returns at
`erp/admission/pipeline.py:142` for any route that is not `Government Quota`, so setting the route
to *Direct* gets an arts application to *Admitted* today with no code change. `docs/ROADMAP.md:44`
nonetheless books this as "a K-12 application deadlocks in *Awaiting Counselling*", scheduled for
slice 5 — wrong in the wording and wrong in the scope. The scope is what matters here: this is not a
school defect that arts colleges also happen to hit. Direct admission is GCE's **ordinary** case.

What makes it expensive is *when* it fails. A default is what an operator gets when nobody tells
them otherwise, and this one does not fail at the point of the mistake — it fails weeks later at the
admission desk, with a message about a counselling body GCE has never dealt with. Until then every
arts application in the funnel reports as *Awaiting Counselling*, and the trust reads that number
and believes it.

## 5. Masters the journeys name

The build rule is that no master is created without a feature slice that consumes it, and that a
master starts at the minimum its first consumer justifies. Four earn their place; several obvious
candidates do not, and are listed after.

| doctype | module | why (justifying journey) |
|---|---|---|
| `Reservation Category` | Master | J4 — the vocabulary a quota is counted in. Already booked in `ROADMAP.md:26` |
| `Programme Intake Seat` | Master | J4/J6 — the per-category seat split the roster counts against |
| `Admission Merit List` | Admission | J5 — the published call order, per intake per round |
| `Admission Merit List Entry` | Admission | J5 — one application's place in one list |

`Programme Intake Seat` is **drawn in `docs/DATA-MODEL.md:23`** as "seat matrix by route × category"
and does not exist — `erp/master/doctype/` has no such directory. The diagram is describing an
intention. This journey is the first one that actually needs it, because a quota is meaningless
without a per-category denominator: `assert_seat_available` today reads one scalar,
`Programme Intake.total_seats` (`erp/admission/pipeline.py:189-205`), and one number cannot say that
the BC seats are full while the general seats are not.

**Grown, not created** — fields on existing doctypes, because the trust will filter, sort and group
on every one of them and the promotion boundary in `docs/CONFIGURATION.md:248-256` puts that squarely
on the DocField side of the line:

- `Admission Enquiry.reservation_category`, `Admission Application.reservation_category`,
  `Student.reservation_category` — a Link to the new master. Stamped on the student at admission
  like every other academic field (`erp/api/admission/admission.py:37-49`), never re-derived.
- `Admission Application.merit_score` — the computed number, a typed column so a merit list is
  orderable in Report Builder and a rollup can band it.
- A shipped `Field Policy` at `Arts & Science` in `erp/seed.py`, hiding `entrance_exam`,
  `entrance_registration_no` and `entrance_rank`, and bounding `cutoff_marks`. One tuple in
  `FIELD_POLICIES`; `_ensure_field_policies` (`erp/seed.py:183-216`) already replays it idempotently
  and marks it `is_standard`.

**Not created, and the reason:**

- **`Merit Rule` / per-subject weighting.** A B.Sc. Physics merit may count PCM only and a B.Com.
  the aggregate — but we do not have GCE's stated rule in hand, and a weighting engine built against
  a guess would be configuration nobody can fill in correctly. The first slice computes merit from
  the aggregate `percentage` already on the education row for the qualification the programme names.
  When a real per-subject rule arrives it justifies its own master and its own slice.
- **`Entrance Exam` master.** Arts & Science admission does not turn on one; the policy at
  `Arts & Science` hides the field rather than giving it a vocabulary. Booked at `ROADMAP.md:26`
  for the slice that needs it.
- **`Qualification` / `Education Board` masters.** `Programme.required_prior_qualification` is still a
  Select and `Admission Enquiry Education.board_university` is still Data. Nothing in these journeys
  filters on either, so promoting them here would be a master with no consumer.
- **`Admission Application Allotment`.** Multi-round *counselling*, already backlogged at
  `ROADMAP.md:56-57`. A merit **round** is not a counselling round and must not borrow its record: a
  round here is a new `Admission Merit List`, which is the point of §7.

## 6. States

`Admission Enquiry.status` remains **the one pipeline** a human moves a lead along, and this slice
adds nothing to it. Being on a merit list is not a position in the pipeline — it is a fact about a
published document, and a called applicant who never turns up leaves the lead exactly where it was.
`Admission Application.application_state` stays derived in `validate`
(`erp/admission/doctype/admission_application/admission_application.py:179-181`) and needs one change
only: the government-quota branch in `derive_application_state` is already route-guarded
(`application_state.py:56`), so a direct-route arts application skips *Awaiting Counselling* with no
new code — once the route is right.

`Admission Merit List.status`: **Draft → Published**. A published list is not edited. A corrected
mark, a late applicant or a second call is a **new list for the next round**, and the earlier one
stands unchanged — because the institution told sixty people where they stood, and a document that
silently reorders itself after the fact destroys the only evidence that they were told correctly.
This is the same argument the previous slice made for keeping `counselling_outcome` as recorded
evidence rather than folding it into a state (`application_state.py:16-18`), applied to a list this
institution produces itself.

## 7. Decisions

- **Fix the form with a seed row, not with code.** The whole misfit in §1 is the absence of one tuple
  in `erp/seed.py:FIELD_POLICIES`. Adding a branch on `institution_type` would undo slice 3, which
  deleted the last two such branches (`ROADMAP.md:16`). The configuration layer already resolves
  correctly for this institution; it just has nothing to resolve.
- **The Field Policy at `Arts & Science` hides, and does not require.** The shipped policies state
  only what is *structurally* true of a kind of institution, and leave "required" to the trust
  (`erp/seed.py:89-92`). An arts college structurally has no entrance rank; whether it insists on a
  10th mark sheet at enquiry time is GEI's business.
- **Merit is computed and stored, not computed on read.** A merit number that is recalculated every
  time a report runs would change when a mark is corrected six weeks later, and the published list
  would stop matching the numbers behind it. So `merit_score` is written in `validate` alongside
  `application_state`, and the list stores its own ordering.
- **The merit list is evidence, not a view.** This is the whole reason it is a doctype and not a
  Script Report. A report answers "who is top today"; the institution needs "who did we publish, on
  what date, in what order". A report cannot be wrong about the past, because it has no past.
- **The list is ordered within category, and the categories are the intake's own split.** One global
  order plus a category column would read as a single queue and would be misread as one. What the
  office actually calls down is one queue per category, which is what `Programme Intake Seat` makes
  countable.
- **Approval is a state on the list, not a Workflow.** Exactly one Workflow may be active per doctype
  — `workflow.py:113-120` silently deactivates the others (`DATA-MODEL.md:138-140`) — so spending
  the app's one Workflow slot on the merit list would foreclose every other approval chain on it.
  Draft → Published, written by an Admission Manager, is the whole requirement.
- **`admission_route` cannot be governed by a Field Policy, so the default must move elsewhere.**
  It is `reqd: 1` (`admission_application.json:129`), and `FieldPolicy.validate_not_statically_required`
  refuses any rule carrying a `requirement` on a statically required field
  (`erp/master/doctype/field_policy/field_policy.py:185-213`). A `Field Policy Rule` has no
  default-override property either — its fields are `fieldname`, `requirement`, `label_override`,
  `display_order`, `min_value`, `max_value`, `description_override`. The route default therefore
  belongs on `Institution Type` as a capability, the way `requires_department` already does
  (`erp/seed.py:41`, `institution_type.py:75-114`, `CONFIGURATION.md:45-51`). That change is shared
  with the management-quota slice and is specified there.
- **Nothing here touches the reporting spine.** `programme`, `institution`, `trust`,
  `application_state`, `application_date` and `programme_intake` are all spine fields on
  `Admission Application` (`erp/master/doctype/field_policy/field_policy.py:45-55`), and the new
  columns are additions beside them.
  GCE stays countable next to GCT and GIS in the Admission Funnel, which is the bound configuration
  is allowed to reach (`CONFIGURATION.md:199-212`).

## 8. What we do not know, and must ask before building

Stated explicitly because this doc is meant to drive a build, and a guess written in this voice would
read as a decision:

- **The reservation categories and their percentages.** Tamil Nadu's split (OC / BC / BCM / MBC /
  SC / SCA / ST, and the percentages attached) is a statutory matter that changes, differs between
  aided and self-financing seats, and differs again for a minority institution. **Do not seed
  percentages.** Seed the *category names* GEI confirms, and let `Programme Intake Seat` carry the
  counts the institution actually publishes.
- **Whether GCE's seats are all self-financing, or partly aided.** Aided seats in Tamil Nadu are
  commonly filled through a government or university single-window process, which would make part of
  GCE's intake a `Government Quota` route after all — and the existing counselling machinery would
  then be correct for those seats and wrong only as a default. This changes whether the route default
  is per institution type or per intake.
- **GCE's affiliating university and its merit formula.** Affiliation is not recorded where it should
  be: `Trust.affiliated_university` is a Link to `Trust`, which is a known defect
  (`ROADMAP.md:39`), and `Institution` carries only `affiliation_number`. If the university mandates
  a formula, the "aggregate percentage" simplification in §5 is wrong and the weighting master is
  needed in this slice rather than a later one.
- **Whether a category change after publication is permitted.** It decides whether the list needs a
  supersede pointer or whether a new round is genuinely enough.

## 9. Proof

Demonstrable steps, in the order they would be run. Each one fails today in the way stated.

1. **The policy resolves.** `resolve_policy("Admission Enquiry", institution=<GCE>)` returns `{}`
   today; after the seed row it returns rules for `entrance_exam`, `entrance_registration_no`,
   `entrance_rank` and `cutoff_marks`. Assert it for one institution per Institution Type, the way
   `CONFIGURATION.md:138-144` specifies the config test gate — a checked-in dict, so the hole cannot
   reopen silently. (That gate is specified and **not written**: `erp/config/` holds only
   `__init__.py`. This slice is where it starts, covering Field Policy resolution rather than
   `Config Value`.)
2. **The unbounded cut-off is refused.** Save a GCE enquiry with `cutoff_marks = -12.5`. It saves
   today. After the slice it throws *Out Of Range* from `_check_bounds`
   (`erp/field_policy.py:314-341`) — the same throw GCT already gets.
3. **A direct admission completes without anyone knowing to change a field.** Raise an application
   from a paid GCE lead and leave the route untouched. Today `application_state` reads *Awaiting
   Counselling* and `confirm_admission` throws *Allotment Awaited* (`pipeline.py:153-157`); setting
   the route to *Direct* by hand already works, which is the point — after the slice the operator
   never has to. The application reaches *Admitted* and a `Student` exists, with no counselling
   outcome ever recorded.
4. **Merit is computed, and ordered.** Two applicants with 88.4% and 91.2% on the education row for
   the programme's required qualification: `merit_score` on each application equals the computed
   number, and the published list orders 91.2 before 88.4. Correct the 88.4 to 94.0 and publish
   again: a **second** list appears and the first is byte-identical to what it was.
5. **The quota is enforced per category, not in aggregate.** An intake with `total_seats = 60` and a
   `Programme Intake Seat` row of 10 for one category: admit 10 in that category and the 11th is
   refused while 50 seats remain overall. Today the 11th is admitted, because
   `assert_seat_available` reads only `total_seats` (`pipeline.py:189-205`).
6. **The trust can still count.** The Admission Funnel shows GCE alongside GCT and GIS with the same
   columns, and `test_trust_reporting.py:173` (`test_institutions_of_different_kinds_stay_comparable`)
   passes unchanged. Attempting a policy rule on `programme` or `application_state` still throws
   *Reporting Spine* (`test_trust_reporting.py:182`).
7. **The new doctypes are reachable.** `test_conventions.py:186`
   (`test_every_doctype_is_reachable_from_a_workspace`) passes — the merit list goes in the
   `Admission` workspace and the two masters in `Master`.

## 10. Documents this slice must correct

Each is a statement in the docs that the code does not support. A build that leaves them standing
perpetuates them, and the next reader trusts them.

- `docs/CONFIGURATION.md:3-4` opens by claiming the codebase serves "a school, an engineering
  college, a medical college and an arts & science college without branching on their type". It
  serves the first three. The fourth resolves no policy at all (§1), so the claim is true only in
  the sense that nothing branches — because nothing happens.
- `docs/DATA-MODEL.md:23` draws `Programme Intake Seat` inside the *built* hierarchy. It does not
  exist in `erp/master/doctype/`. This slice creates it; until then the diagram should mark it.
- `docs/ROADMAP.md:44` describes the route default as a K-12 deadlock. It is neither confined to
  K-12 nor a deadlock (§4).
- `docs/CONFIGURATION.md:53-77` describes `erp/config/resolver.py`, `get_config`, `get_many` and
  `explain` in the present tense. `erp/config/` contains only `__init__.py`.
- `docs/CONFIGURATION.md:174-197` gives worked examples for School and Engineering and none for the
  one type that has no policy at all. The gap itself is now recorded, at `:140-144`, as the thing
  the unbuilt config test gate would fail to catch — which is the right diagnosis and still leaves
  the section reading as though two policies covered the tree.

## 11. Explicitly not built (later slices)

Per-subject merit weighting; an aided/self-financing seat distinction; a single-window import of a
state body's allotment for aided seats; the applicant-facing view of "your place in the list";
`Entrance Exam`, `Qualification` and `Education Board` masters (`ROADMAP.md:26`); withdrawal after a
call, and the re-call it should trigger; tuition fee structure (`ROADMAP.md:55`), so the money a
called applicant pays to hold the seat still has nowhere to go beyond the application fee; the
config resolver — **`erp/config/resolver.py` does not exist**, only `erp/config/__init__.py`, though
`CONFIGURATION.md:53-77` describes it as though it does, so nothing in this slice may call
`get_config`.
