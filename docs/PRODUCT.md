# The product

A multi-tenant ERP for education groups. One **Institution** — a university, a trust, a college or
school group — runs many **Campuses** and many **Colleges**, and this system is where all of them
operate: admissions, students, fees, attendance, examinations, hostel, transport, staff.

Multi-tenant here is not a UI concern. It is why the hierarchy is denormalised onto every record
and then validated on every save — see the denormalisation contract in [DATA-MODEL.md](DATA-MODEL.md).
One college's data must never quietly become another's.

## Who it serves

Every kind of institution in the group, without a separate product per kind.

**Institution types** — `institution_type` on
[Institution](../erp/master/doctype/institution/institution.json):
University · Autonomous · Trust · College Group · School Group

**College types** — `college_type` on [College](../erp/master/doctype/college/college.json):
Engineering · Arts & Science · Medical · Polytechnic · School · MBA · Law

One Institution holding several of these at once — an engineering college, an arts & science
college and a CBSE school under one trust — is the normal case, not the edge case. Every feature
has to work when the group is mixed.

## One model, profile-driven

Schools and colleges are the same shape with different words. A school's "Class 10" is a college's
"B.E. Computer Science": something students are admitted into, that runs for a period, that has
sections, subjects, a fee structure and an exam schedule.

So we build **one set of doctypes**, and let the institution's profile decide the vocabulary and the
rules. We do not fork the model per education type.

| Concept | College | School |
|---|---|---|
| Programme | B.E. Computer Science | Class 10 / Grade 10 |
| Programme Level | UG · PG · Diploma · Ph.D. | Primary · Middle · Secondary · Higher Secondary |
| Academic Structure | Semester (2/yr), Trimester | Term (3/yr), Annual |
| Term | Semester 1…8, running continuously | Term I/II/III, repeating every year |
| Department | CSE, Mechanical | Subject group, or nothing at all |
| Course | Paper, carries credits | Subject, no credits |
| Section | Section of a semester | Section of a class |
| Degree | B.E., B.Sc., MBA | Not used |

### How the profile is decided today

There is deliberately **no `Institution Profile` doctype**. The profile is derived from what already
exists:

- `College.college_type` — the kind of institution
- `Programme.programme_level` →
  [Programme Level](../erp/master/doctype/programme_level/programme_level.json) — where it sits on
  the ladder
- `Programme.academic_structure` →
  [Academic Structure](../erp/master/doctype/academic_structure/academic_structure.json), which
  carries `terms_per_year` and **`term_label`**

`term_label` is the whole trick. The same Programme doctype reads "Semester 1" for an engineering
college and "Term I" for a school, because the linked Academic Structure says which word to use.
Nothing downstream needs to know which kind of institution it is looking at.

A dedicated profile master gets created the first time a **feature** actually needs to branch on
one — that is [METHOD.md](METHOD.md) applied to itself. Until then, reading `college_type` and
`academic_structure` is the supported way to vary behaviour.

### What this rules out

Do not add school-only or college-only doctypes that duplicate a concept that already exists —
no `Class` beside `Programme`, no `Subject` beside `Course`. If a school needs a field a college
doesn't, add the field and make it conditional (`depends_on` in the JSON), not a second doctype.

The one thing to watch: a school's terms repeat every year (Term I of Class 9, Term I of Class 10)
while a college's semesters run straight through (Semester 1…8). Any feature that numbers terms
must read `terms_per_year` from Academic Structure rather than assuming either behaviour.

## Personas

| Persona | Cares about |
|---|---|
| Institution admin | The whole group — colleges, campuses, consolidated reporting |
| College admin / principal | One college, end to end |
| HOD | A department's programmes, staff and students |
| Faculty | Their classes, attendance, marks |
| Student | Their own record — fees, attendance, results |
| Parent / guardian | Their child's attendance, fees, movements, results |
| Admissions officer | The applicant funnel |
| Accounts | Fees, invoices, receipts, dues |
| Exam cell | Schedules, marks, results |
| Security desk | Who is entering and leaving, right now |
| Warden | Hostel occupancy, outpasses, night attendance |
| Transport in-charge | Routes, vehicles, stops, who boarded |

Roles get created per slice, when a journey needs one. Not up front — an unused role is the same
mistake as an unused master.
