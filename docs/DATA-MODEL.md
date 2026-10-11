# Foundation data model

The organization foundation separates legal ownership, physical locations, and operating institutions:

```text
Trust
├── Campus
└── Institution
    ├── Institution Type
    └── Institution Campus Assignment ── Campus
```

- **Trust** is the legal education group. One Trust is allowed per site.
- **Campus** is a physical location owned by the Trust.
- **Institution** is an operating school or college and belongs to one Trust.
- **Institution Type** is a configurable tree of kinds such as School, Arts & Science,
  Engineering, and Medical.
- **Institution Campus Assignment** connects an Institution to each Campus where it operates.
  Assignments are effective-dated, describe the campus's purpose, and identify the single primary
  campus that applies during a period.

An Institution may operate across several Campuses, and one Campus may host several Institutions.
An assignment is valid only when the Institution and Campus belong to the same Trust. Overlapping
assignments for the same pair are rejected, as are overlapping primary-campus assignments for one
Institution.

Institution is the operational permission boundary. Trust Admin can operate across the
group; Institution Admin is restricted through Frappe User Permissions on Institution.
