# Slice 1.5 — Master data administration · `Master`

**Status: built, including create, edit and delete.**

## 1. Why

Every master this app has built is reachable only through Frappe Desk. The SPA generates a route for
each of them — `erp.api.navigation.get_module_menu` emits `/{module_slug}/{doctype_slug}` for every
Workspace DocType link — and until now all fourteen of those routes were 404s rendered *outside* the
shell, so a mistyped or not-yet-built screen also cost the user their navigation.

This slice makes those routes real. It creates **no doctypes and no fields**; it surfaces what
Slices 0–1 already built.

## 2. Personas

Group administrator and college administrator (both `System Manager` today — see §12). The gate
operator benefits indirectly: J5 is what keeps a retired college out of their picker.

## 3. Journeys

**J1 — a new college joins the group.** The administrator opens Master → College and reads the list:
code, name, institution, type, autonomous, status. Today they can find and read any college in the
group without Desk. *(Creating one is still Desk — see §10.)*

**J2 — the vocabulary is checked before a programme is set up.** Programme Level, Degree and Academic
Structure are global vocabulary rather than tenant data. The administrator opens each list to confirm
what exists before naming it on a Programme. Each is a seven-field record whose list needs no
per-doctype design — which is the observation this slice's implementation rests on.

**J3 — the admission year is confirmed open.** The administrator opens Academic Year, filters by
status, and reads `is_admission_open` on the record. That flag is what stamps `academic_year` onto a
gate pass, so being able to *see* it closes a loop that previously required Desk.

**J4 — a record is looked up by a human name, not a key.** A college is found by typing part of its
name; the list searches `search_fields` as authored on the doctype. The record page then shows the
identity the doctype declares (`title_field`) with its primary key beneath it, so the person can see
both what it is called and what it is keyed by. *This is why the record page renders `title_field` as
the heading and `name` as the subtitle.*

**J5 — a college is retired.** Set to Inactive in Desk, it drops out of the gate desk's College
picker, and the administrator finds it again through the list's **Status** filter. *This is why every
list carries the doctype's own `in_standard_filter` fields rather than a hand-picked set.*

**Exceptions.** A screen the user has no permission for is absent from the menu and its deep link
resolves to an in-shell 404, indistinguishable from a typo — deliberately, since telling the two
apart would leak which doctypes exist. A failed schema or row fetch shows the server's own message
with a retry, and never takes the shell down with it.

## 4. Masters this slice needs

**None.** This slice builds zero doctypes and zero fields. It is entirely surface over what
[../DATA-MODEL.md](../DATA-MODEL.md) already lists as built.

## 5. Data model changes

None.

## 6. Server

One new endpoint, [../../erp/api/doctype.py](../../erp/api/doctype.py). **Writes add none** —
create, update and delete all travel `/api/resource/<doctype>` through the SDK, so every
controller `validate`, every framework constraint and every permission check runs exactly as it
does for Desk. [../METHOD.md](../METHOD.md) step 5 forbids wrapping CRUD in a whitelisted
endpoint precisely because it would add a permission surface and buy nothing.

Link pickers call Frappe's own `frappe.desk.search.search_link`, also not ours: it applies user
permissions, honours each target's `search_fields` and any custom search query, and works for
targets outside this app — `Country` is a Frappe core doctype, so `get_doctype_schema` refuses it
by design and anything needing the target's schema first would fail on it.

```
erp.api.doctype.get_doctype_schema(doctype)  →  fields, layout, list_columns,
                                                filter_fields, search_fields, sort, permissions
```

It returns **no document data**. Rows travel `/api/resource/<doctype>` through `frappe-js-sdk`'s `db`
handle with the framework's own permission checks, which is what
[../METHOD.md](../METHOD.md) step 5 asks for — the rule there forbids wrapping `get_list`, and there
is no list here. What CRUD cannot return is *schema*: labels, fieldtypes, section structure.

It fails closed three ways — Guest, a doctype outside this app's modules, and `has_permission(read)`.
The middle one matters: without it, any logged-in user could read the schema of every doctype on the
site.

It also parses the two `eval:` properties (`depends_on`, `mandatory_depends_on`) and `link_filters`
into data server-side, so the SPA never evaluates a string.
[../../erp/api/test_doctype.py](../../erp/api/test_doctype.py) asserts every expression and every
fieldtype authored anywhere in this app is one the renderer supports — without that, authoring a new
expression in the Desk form builder would silently degrade a screen months later.

`erp/api/` gained structure at the same time: a file at the root is app-wide, a subpackage is a
Frappe module. `erp/api/gate.py` moved to `erp/api/gate/gate_pass.py`
(`erp.api.gate.gate_pass.mark_exit`), which is a breaking rename its Desk client script also had to
follow. See [frappe-api](../../.claude/skills/frappe-api/SKILL.md).

## 7. Frontend

- **Routes** — `/:moduleSlug/:doctypeSlug` and `/:moduleSlug/:doctypeSlug/:name`, plus
  `/:moduleSlug/*` so an unbuilt screen keeps the shell instead of dropping to the bare 404.
- **Pages** — `frontend/src/screens/doctype/pages/DoctypeListScreen.tsx` and
  `DoctypeRecordScreen.tsx`. Two files for all fourteen screens.
- **Overrides** — `frontend/src/screens/doctype/registry.ts`, with each module's entries in
  `frontend/src/modules/<module>/screens.ts`. Four escalating levels (presentation data → slots →
  a whole replacement page), all on the *same* route, so a bespoke screen cannot lose its shell,
  breadcrumbs or auth gate by being bespoke. Without this seam the only way to build the gate desk
  is to slot a static route above `/:moduleSlug/:doctypeSlug` — and three of those turn the
  routing table into the override mechanism, which is the second renderer §8 forbids.
- **Slug resolution** — `useDoctypeRoute` reads `doctype_by_slug` off the already-cached module menu,
  so a deep link costs no extra request and an unpermitted slug is simply absent from the map.
- **List state lives in the URL** (`?q=` search, `?status=` flat Select/Check filters,
  `?f.<field>=<op>:<value>` typed column filters, `?sort=a,-b` multi-sort, `?page=&size=&density=&hide=`),
  so a filtered list is a link someone can paste into a ticket and Back works inside the screen.
  Saved views and column widths are the exception — localStorage, per §10.
- **Components** — `shared/components/` (layout: frame + header; feedback: empty, error,
  not-found) and `screens/doctype/components/` (table, toolbar, pagination, cells, view menu, bulk
  bar, child grid, record summary). The fieldtype→cell mapping is a plain lookup record in a `.ts`
  module, not a factory, because a function returning a component trips the React Compiler — the
  same split `shell/lib/module-icons.ts` already makes.
- **The whole authored form structure survives the wire.** `layout` is tabs → sections → columns,
  and the record page renders all three. Collapsing Tab Break into Section Break, or flattening a
  Column Break, loses an instruction the renderer cannot recover — and the loss is invisible in a
  screenshot, which is why it went unnoticed until it was looked for.
- **A Link field opens what it points at.** The value is still printed verbatim rather than
  resolved to a title (see §8's cost note), but the route is already cached in `doctype_by_slug`,
  so the href is free. A Link to a doctype the user cannot reach degrades to text.
- **Status is a dot plus the word, not a filled badge.** A tinted badge measures ~4.37:1 for the
  success step, under this app's 4.5:1 bar — the same failure DESIGN.md already recorded for
  `destructive`. A dot is non-text and answers to the 3:1 bar, and forty rows of filled pills read
  as a column of colour rather than a column of states. Which words are positive is a *module's*
  decision (`Inside` is the gate's word, not the app's), so it lives in the registry.

## 8. Why generic rather than a page per doctype

All fourteen doctypes are top-level, none submittable, none with child tables, and every one already
authors `in_list_view`, `in_standard_filter`, `search_fields`, `title_field` and `sort_field`. A page
per doctype would restate each field four times — doctype JSON, TS interface, zod schema, JSX — and
three of those four fail *silently* when you forget one.

This is the same call [../MODULES.md](../MODULES.md) already records for navigation: the nav tree is
generated from Workspaces precisely so adding a doctype surfaces it without a frontend edit.

The cost is real and named in §12: schema drift becomes a runtime dependency, and the generic form
will be wrong for any screen whose journey is a *task* rather than a *record*. When that happens, the
answer is an override for one named doctype justified by a named journey — not a second renderer.

## 9. Institution coverage

Nothing here branches on institution type. A school's College row and an engineering college's render
through the same screen, because the difference lives in `college_type` and neither screen reads it.

## 10. Non-goals

The `accreditation` JSON editor beyond a validated textarea · bulk edit · inline cell editing ·
submit/cancel · child-table editing · column reordering · user column pinning · faceted filter
counts · a `Master Administrator` role · User Permission scoping · version history · **and a
hand-written page per master.** (The last four filter/column items are a documented Tier 2/3
backlog, not refusals — see §14.)

**Now built** (moved off this list): create, edit and delete · image upload · column visibility ·
row density · column resizing · row selection · CSV export and bulk export · bulk delete ·
child-table grids · record tabs · **per-column filters** (text/number/date/link) · **multi-column
sort** · **saved views**.

### The two storage choices, and why

Filters, sort, page, density, hidden columns and edit mode all live in the **URL**, because they
are part of the question being asked and a composed view should be a link you paste into a ticket.
The filter grammar is namespaced so the two filter channels never collide: the Select/Check bar
keeps writing flat `?status=Active` (old shared links stay valid), and the typed per-column
filters write `?f.<field>=<op>:<value>` — `f.college_code=like:eng`, `f.total_area=between:10,50`.
Multi-sort is a comma list with a `-` prefix for descending, `?sort=college_type,-modified`, no
separate `dir`. Column filters are ANDed, so `get_count` still sees them and the total stays
honest; only the OR-fanned search hides the count.

**localStorage**, not the URL, holds the two things that are a property of *this person's screen*
rather than of the question: **column widths** and **saved views**. A width in the URL
(`?w=college_name:240`) would make every shared link unreadable; a saved view is a name over a
query, one person's shortcut, keyed per doctype exactly like the widths. A shared `List View`
doctype is the clean upgrade the day views must travel between users — its shape (name + query)
ports directly.

## 11. Verification

- `bench --site erp.localhost run-tests --module erp.api.test_doctype` — 25 tests: the expression
  and fieldtype coverage assertions, the parsers, the endpoint's three refusals, and the layout
  shape (one implicit tab, Column Breaks preserved, `child_schemas` always present).
- `npx playwright test` — `e2e/doctype-screens.spec.ts` covers both shapes (list, record) rather
  than each doctype: schema-driven columns, filter state surviving a reload from the URL alone, the
  no-matches-vs-nothing-here distinction, `depends_on` hiding an inapplicable field, breadcrumbs,
  an unpermitted deep link failing closed *without reaching the server*, Link cells resolving (and
  degrading to text when the target is unreachable), column visibility and density round-tripping
  through the URL, selection and its two honest bulk actions, CSV download, the summary strip, the
  authored Column Breaks surviving, and a tabbed layout switching panels.
  `e2e/shell.spec.ts` adds the command palette: shortcut and pointer, module overviews as entries,
  out-of-order term matching, and state not surviving a close.
- Browser, against a real bench: sign in, walk Master → College → filter → sort → resize a column
  → open a record → back, and confirm the flyout stays lit on the record route. Then the whole
  write loop on Campus — create (empty submit first, to see the required-field errors), pick an
  Institution through the Link search, save, edit the name, save, delete — checking the toasts and
  that the console stays clean. Three real bugs came out of exactly this walk and out of nothing
  else: every field marked required, a Link cell that looked identical to plain text, and a table
  whose sticky header never stuck.

## 12. What writes needed first

`shared/lib/errors.ts` had to learn HTTP 417 and `_server_messages`. Until it did, `frappe.throw`
in a controller — which is how `validate_same_parent` and every hierarchy rule report — reached
the user as **"There was an error while updating the document"**, because `frappe-js-sdk`
overwrites `message` on `db` calls and the real text is in `_server_messages`, double-encoded and
carrying HTML. It now returns *every* message rather than the first, since a controller that
throws once per bad field would otherwise make the user submit N times to discover N problems.

Client-side validation is deliberately thin — required, numeric, JSON, max length. The server is
the authority and re-checks regardless; a second implementation of a business rule is a second
thing to keep in step, and the copy that drifts is always the one nobody tests.

Three things the form gets right that are easy to get wrong:

- **`mandatory_depends_on` is not `depends_on`.** `evalCondition(null, …)` returns true, which is
  correct for visibility and exactly wrong for mandatoriness. Passing it straight through marked
  every field on every form required — caught in the browser, now guarded by a spec.
- **Naming fields lock after create.** `autoname: field:college_code` bakes the value into `name`
  on insert and never recomputes it, so editing it later moves the column while the primary key
  stays put — no error, and every Link pointing at the old key still resolves.
- **Fields the user cannot write render as values, not disabled inputs.** A greyed box around
  `college.institution` invites someone to try; the interesting question is what the value is.

## 13. Open questions

- **Does a `Master Administrator` role exist, or does everything stay `System Manager`?** Every
  journey above is written for an administrator who today is a System Manager.
- **Do all thirteen masters need SPA screens?** Institution is edited roughly once a year; "it stays
  in Desk" is a legitimate answer this slice does not have to overturn.
- **Schema drift has no compile-time guard.** A renamed field or a new fieldtype is now a UI bug
  found by a user, and `npm run build` stays green. `erp/api/test_doctype.py` covers the *server*
  side — every authored expression and fieldtype must be one the renderer supports — and the
  Playwright specs cover the rendering. Both have to run in CI; neither is a type check.
- **No child-table editing.** The record view renders a child grid from `child_schemas`; the form
  has no control for one. No doctype in this app authors a `Table` field yet, so this is a gap
  rather than a regression.
- **No submit/cancel.** Nothing here is submittable (`is_submittable` is false on all fourteen),
  so the docstatus workflow has never been needed. The schema already publishes the flag.
- **Bulk delete is sequential and partial.** Deletes cascade through link validation, so the
  normal outcome is "seven went, three are still referenced" — reported as such, with the rows
  that refused left selected. There is no transaction the REST API could offer instead.

## 14. Table feature backlog (Tier 2/3)

Measured against AG Grid and Material React Table, the table is at Community-tier parity for a
*server-paginated, schema-driven* grid. What a full library offers beyond this is either deferred
or deliberately out of scope:

- **Deferred (fit the model, not yet built):** column reordering · user column pinning (only the
  identity is auto-frozen today) · column auto-fit on a resize-handle double-click · keyboard row
  navigation · faceted filter values with counts (this one needs a small `group_by` count
  endpoint — everything else is frontend-only) · inline cell editing (the audit confirmed
  `db.updateDoc` partial writes work; it was descoped as too opinionated for now) · advanced
  AND/OR filter builder · row detail preview · Excel export.
- **Excluded (wrong shape for a server-paginated generic table):** client-side row grouping ·
  pivot tables · cross-page aggregation · tree data · range selection / fill handle / Excel-range
  clipboard · integrated charts (a dashboard concern, not this table).
