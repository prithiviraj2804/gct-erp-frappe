---
name: frappe-api
description: Add a whitelisted server endpoint under erp/api/ and call it from the React SPA — decorator, permission checks, HTTP method binding, and the frontend call handle. Use when the SPA needs server logic beyond plain doctype CRUD.
---

# Adding a server endpoint

## Before writing one: do you need it?

`frappe-js-sdk` already exposes doctype CRUD through the `db` handle
(`db.getDoc`, `db.getList`, `db.createDoc`, `db.updateDoc`), and Frappe enforces
doctype permissions on those automatically. Write a whitelisted method only for logic
that isn't CRUD — aggregation, multi-doctype transactions, external calls. A custom
endpoint that just wraps `get_list` adds a permission surface for no benefit.

## Where it goes

Everything whitelisted lives under `erp/api/`, and the dotted path is what the client calls.
Keeping one prefix is the point: `grep -rn "erp\.api\." ` finds the app's entire public
surface in one shot, which matters for a SPA-first app whose server is consumed over HTTP.

**A file at the root is app-wide. A subpackage is a Frappe module.**

```
erp/api/
  session.py      erp.api.session.get_session             ← app-wide: the platform. These
  branding.py     erp.api.branding.get_login_branding       would still exist if every
  modules.py      erp.api.modules.get_allowed_modules       business module were deleted.
  navigation.py   erp.api.navigation.get_module_rail
  doctype.py      erp.api.doctype.get_doctype_schema
  permission.py   (hook target, not whitelisted)
  gate/           ← a Frappe module, mirroring erp/gate/
    gate_pass.py  erp.api.gate.gate_pass.mark_exit
```

Create a subpackage when a module first needs an endpoint, not before — an empty package
asserting a convention is the same mistake as an unused master. Name the file after what it
serves (`gate_pass.py`), not after the module again (`gate/gate.py`).

Note this is **not** upstream's layout — ERPNext has no `api` package at all and puts
whitelisted methods beside the code they serve. The single-prefix rule is this app's choice,
made because its consumer is a React client rather than Desk.

Doctype-specific logic belongs on the controller in
`erp/<module>/doctype/<name>/<name>.py` instead — a whitelisted method there is reachable
at `erp.<module>.doctype.<name>.<name>.<function>`.

> Moving an endpoint renames its dotted path, which is a **breaking change to callers you do
> not control from the frontend** — Desk client scripts (`<doctype>.js`) call these too, as do
> docs and tests. `grep -rn "erp\.api\.<old>"` across the whole app before and after.

## The pattern

```python
# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _


@frappe.whitelist(methods=["GET"])
def get_active_trusts(trust_type: str | None = None) -> list[dict]:
	"""Active trusts, optionally narrowed by type.

	Every whitelisted function is a public HTTP endpoint reachable by any logged-in
	user. Permission is never implied by the caller — check it here.
	"""
	if not frappe.has_permission("Trust", "read"):
		frappe.throw(_("Not permitted"), frappe.PermissionError)

	filters = {"status": "Active"}
	if trust_type:
		filters["trust_type"] = trust_type

	return frappe.get_all(
		"Trust",
		filters=filters,
		fields=["name", "id", "trust_name", "short_name"],
		limit_page_length=100,
	)
```

Rules that matter:

- **`methods=["GET"]` / `["POST"]`** — bind the verb. Anything that writes must be POST;
  an unbound mutation is callable via GET and becomes CSRF-reachable.
- **`allow_guest=True`** exposes the endpoint to unauthenticated callers. Do not add it
  without a stated reason.
- **Check permissions explicitly.** `@frappe.whitelist()` only means "reachable by a
  logged-in user" — it grants nothing and checks nothing about the data.
- **Arguments arrive as strings** from HTTP. Cast deliberately (`frappe.utils.cint`,
  `flt`, `frappe.parse_json`); a `list[str]` type hint does not parse anything.
- **Style is ruff-enforced**: tab indentation, double quotes, line length 110.

## Calling it from the SPA

Use the shared handles from `src/lib/frappe.ts` — never construct a new `FrappeApp`:

```ts
import { call } from '@/lib/frappe'

// call.get / post / put / delete → (path, params)
const res = await call.get<{ message: Trust[] }>(
  'erp.api.master.get_active_trusts',
  { trust_type: 'University' },
)
const trusts = res.message
```

Frappe wraps every whitelisted return value in a `message` key — unwrap it. Pair with
TanStack Query rather than calling in an effect:

```ts
useQuery({
  queryKey: ['active-trusts', trustType],
  queryFn: () =>
    call.get<{ message: Trust[] }>('erp.api.master.get_active_trusts', {
      trust_type: trustType,
    }),
  select: (r) => r.message,
})
```

Shared response types go in `src/types/`.

## Verify it

`clear-cache` after adding an endpoint — the whitelist is cached, and a missing method is
usually staleness rather than a wrong path:

```bash
bench --site erp.localhost clear-cache
curl -s -H "Host: erp.localhost" \
  "http://127.0.0.1:8000/api/method/erp.api.master.get_active_trusts"
```

A 403 from an unauthenticated curl is the correct result — it proves the endpoint exists
and is guarded. `404` means the path is wrong or the cache is stale.
