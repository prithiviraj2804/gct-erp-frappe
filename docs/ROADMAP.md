# Roadmap

Slices in order. Each one ships end to end — journeys, doctypes, screens, proof — before the next
one starts ([METHOD.md](METHOD.md)).

The "pulls in" column is an **expectation, not a commitment**. What a slice actually builds is
decided by its own spec, from its own journeys. A master named here is not approved; it is a guess
about where it will first be needed.

## Slice 1 — Admission Gate Pass · `Gate` ✅

**Status: built (backend). SPA screens deferred by decision.** →
[features/admission-gate-pass.md](features/admission-gate-pass.md)

A prospective student arrives at the gate asking about admission. The desk records who came, which
college they want, how the lead reached us, and which staff member owns it — and closes the pass
when they leave.

Pulled in, because the journeys named them: **Staff**, **Consultancy**, and the app's first real
role, **Gate Security**.

A **Student** master was built here and then deleted. When the referring student became a typed name
rather than a picked record, Student had no consumer left — and a master with no consumer does not
exist under this method. Deleting it was the method working, not a mistake: Student gets designed
once, properly, by the slice that actually reads it.

---

## DRAFT — everything below

Order and contents get settled in the modules discussion. Listed so that discussion has something
concrete to rearrange.

| # | Slice | Outcome | Expected to pull in |
|---|---|---|---|
| 2 | People & identity | One record per student / staff / guardian, reused everywhere | Student, Staff, Guardian, Student Category, Staff Category |
| 3 | Admissions | Enquiry → application → merit → admitted student | Applicant, Quota, Admission Source, Community, Religion; consumes Programme Intake + Admission Type |
| 4 | Enrollment & sections | An admitted student sits in a section of a term | Section, Semester/Term, Branch |
| 5 | Fees | Bill a student, collect, track dues | Fee Head, Fee Structure, Invoice, Payment, Scholarship |
| 6 | Attendance & timetable | Faculty marks a class; parents see it | Course, Period, Timetable, Shift, Classroom |
| 7 | Examinations | Schedule, marks entry, results | Exam, Exam Schedule, Mark Sheet, Grade Scale |
| 8 | Hostel | Allot a room, track occupancy and night attendance | Hostel, Block, Room, Bed |
| 9 | Transport | Routes, stops, vehicles, who boarded | Route, Stop, Vehicle, Driver |
| 10 | Library | Catalogue, issue, return, fines | Book, Copy, Loan |
| 11 | HR & payroll | Staff lifecycle, leave, salary | Designation, Leave Type, Salary Component |
| 12 | Inventory & procurement | Stores, purchase, assets | Item, Supplier, Purchase Order |
| 13 | Reports & dashboards | The numbers each persona actually opens the app for | — |

## How a slice gets marked done

Not "the code is merged". A slice is done when:

- its journeys can be walked in the running app by the personas they name
- the masters it built are moved into the built table in [DATA-MODEL.md](DATA-MODEL.md)
- its spec records what was deliberately left out
- it is ticked here

## Standing constraint

Every slice has to work for a mixed group — an engineering college, an arts & science college and a
school under one institution ([PRODUCT.md](PRODUCT.md)). If a slice only makes sense for one of
them, that's a design problem in the slice, not a reason to fork the model.
