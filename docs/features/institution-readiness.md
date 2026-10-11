# Institution Readiness

Phase A turns a registered Institution into an operating academic unit. It is complete when an administrator can set the institution defaults, open an academic year, and define departments and programmes.

## User journey

1. Assign the Institution to each Campus where it operates and identify its effective primary Campus.
2. Open **Institution Settings** and create the single settings record for the Institution.
3. Create an **Academic Year** with non-overlapping dates, then select it as the default in Institution Settings.
4. Create **Departments** using codes unique within the Institution.
5. Create **Programmes** under the Institution. A Department is optional so school grades and institution-wide programmes are supported.

## Rules

- Every record belongs to exactly one Institution and carries its Trust for filtering and future permission scoping.
- Linked records must belong to the same Institution and Trust.
- Institution Campus Assignments must link records from the same Trust.
- One Institution can use several Campuses, but only one primary Campus assignment can apply at a time.
- Assignment periods for the same Institution and Campus cannot overlap.
- One Institution has one Institution Settings record.
- Academic year dates must be ordered and cannot overlap within an Institution.
- Department and programme codes are unique within an Institution.
- Programme duration must be greater than zero.

## States

- Settings, departments, and programmes are **Active** or **Inactive**.
- Academic years move from **Draft** to **Active** to **Closed**.

Terms, programme offerings, admission cycles, applicants, enrolment, inherited configuration, and the SPA are outside Phase A.
