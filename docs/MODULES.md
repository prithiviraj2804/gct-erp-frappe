# Modules and navigation

> **DRAFT below the line.** The live modules are fact; the proposed module map is a starting
> point for the modules discussion, not a commitment.

## Live modules

[../erp/modules.txt](../erp/modules.txt):

| Module | Package | State |
|---|---|---|
| `Erp` | [../erp/erp/](../erp/erp/) | App-level container. No doctypes, no workspace — so it never appears in the rail. |
| `Gate` | [../erp/gate/](../erp/gate/) | Gate passes and campus movement. Workspace at `sequence_id` 2, icon `unlock`, one card. Holds Admission Gate Pass ([features/admission-gate-pass.md](features/admission-gate-pass.md)); visitor, hostel, staff and material passes come later. |
| `Master` | [../erp/master/](../erp/master/) | 13 doctypes; workspace at `sequence_id` 1, four cards — Organisation, Academic, Admissions, People. |

`Gate` was renamed from `Gate_Entry` while it still held zero doctypes — cheap then, a data
migration afterwards. The old Module Def and its workspace are dropped by
[../erp/patches/v1_0/rename_gate_entry_module.py](../erp/patches/v1_0/rename_gate_entry_module.py),
because `migrate` creates a Module Def for every line in `modules.txt` but never removes one for a
line that has gone.

A Module Def name is an identifier, so a multi-word module is written with an underscore
(`Hostel_Pass`) and the SPA undoes it for display — `moduleLabel` in
[../frontend/src/lib/modules.ts](../frontend/src/lib/modules.ts). No module needs one today.

## How navigation is built

The SPA rail and menus are **data-driven from Frappe metadata**. There is no hardcoded navigation
tree in the frontend.

```
Module Def (app_name="erp")          →  erp.api.modules.get_allowed_modules
      ↓  minus the user's block_modules
Workspace (public, not hidden)       →  erp.api.navigation.get_module_rail     → rail icons, order
      ↓  its Workspace Link rows
Card Break = group header,           →  erp.api.navigation.get_module_menu     → menu groups + routes
DocType link = /{module}/{doctype}
```

- [../erp/api/modules.py](../erp/api/modules.py) — module visibility. Frappe models module access as
  a *denylist* (`User.block_modules`), so "allowed" is all of this app's modules minus that set.
  Scoped to `app_name == "erp"` so Frappe's own Core/Desk/Website modules stay out.
- [../erp/api/navigation.py](../erp/api/navigation.py) — layers workspace metadata on top. Rail order
  comes from the workspace's `sequence_id`, **not** the module name; permission filtering is per
  link via `frappe.has_permission`, and a group whose links are all filtered out is dropped rather
  than shown as an empty header.
- Frontend: [../frontend/src/lib/navigation.ts](../frontend/src/lib/navigation.ts) and
  [../frontend/src/hooks/use-navigation.ts](../frontend/src/hooks/use-navigation.ts), rendered by
  [../frontend/src/components/shell/ModuleRail.tsx](../frontend/src/components/shell/ModuleRail.tsx)
  and `ModuleMenuPanel.tsx`.

Route slugs come from `slugify` in [../erp/utils.py](../erp/utils.py) — `"Admission Entry"` becomes
`admission-entry`, not `admission_entry`. Deliberately not `frappe.scrub`.

**A module with no workspace never reaches the rail** — it has nothing to navigate to. That is why
`Erp` is invisible.

Rail order is the workspace's `sequence_id`, not the module name — Master is 1, Gate is 2. That
field exists precisely so a thin module doesn't sort alphabetically to the front and make the shell
open on nearly nothing.

## Adding a module

1. Add the name to [../erp/modules.txt](../erp/modules.txt) (underscores, no spaces).
2. Create the package: `erp/<snake_name>/__init__.py` and `erp/<snake_name>/doctype/__init__.py`.
3. `bench --site erp.localhost migrate` — this creates the Module Def.
4. Create the workspace at `erp/<snake_name>/workspace/<Name>/<Name>.json` with `"public": 1`, the
   matching `"module"`, a `sequence_id` for rail order, and `links` grouped by `Card Break` rows.
   Copy [../erp/master/workspace/master/master.json](../erp/master/workspace/master/master.json).
5. Add an icon to `MODULE_ICONS` in
   [../frontend/src/lib/module-icons.ts](../frontend/src/lib/module-icons.ts), keyed by the Module
   Def **name**. This is the one frontend change required — without it the module still appears,
   with the fallback box icon.

Menus and routes then follow from the workspace. Adding a doctype to an existing module is step 4
alone: add a link row, and it shows up.

### The Master workspace

Closed in Slice 1: all 13 masters are now reachable, grouped as Organisation (Institution, Campus,
College, Department) · Academic (Programme Level, Degree, Academic Structure, Programme) ·
Admissions (Academic Year, Admission Type, Programme Intake, Consultancy) · People (Staff).

Six of them had been unreachable since they were built — a symptom of the masters-first phase, where
a doctype could exist for weeks without anything, including a menu, needing it.

---

## DRAFT — proposed module map

To be settled in the modules discussion. Listed as candidates so the conversation has something to
cut, not as a build list. Modules get created when a slice needs one — same rule as masters.

| Module | Covers | Likely first slice |
|---|---|---|
| `Master` | Organisation + academic vocabulary + masters other modules share | exists |
| `Gate` | Gate passes, visitors, movements | exists — **Slice 1** |
| `People` | Student, Staff, Guardian — identity shared by everything else | Staff lives in `Master` today; this module is the question of whether it should move, and where Student gets rebuilt |
| `Admission` | Enquiry → application → allotment → admitted | Admissions |
| `Academics` | Curriculum, courses, sections, timetable, attendance | Attendance |
| `Examination` | Schedules, marks, results, transcripts | Examinations |
| `Finance` | Fee heads, structures, invoices, receipts, dues | Fees |
| `Hostel` | Rooms, allotment, occupancy, night attendance | Hostel |
| `Transport` | Routes, stops, vehicles, boarding | Transport |
| `Library` | Catalogue, issue, return, fines | Library |
| `HR` | Staff records, leave, payroll | HR |
| `Inventory` | Stores, purchase, assets | Inventory |

Open questions for that discussion:

- Does `People` deserve its own module, or does Student belong in `Admission` and Staff in `HR`?
- Is `Academics` one module or three (curriculum / timetable / attendance)? Rail space is finite.
- Where do reports and dashboards live — per module, or one `Reports` module?
- Do parents and students get the same SPA with role-filtered navigation, or a separate portal?
