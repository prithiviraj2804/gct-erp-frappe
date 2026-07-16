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

Shared server helpers live in `erp/api/` (currently only `permission.py`). One module per
area; the dotted path is what the client calls:

```
erp/api/master.py  →  erp.api.master.<function_name>
```

Doctype-specific logic belongs on the controller in
`erp/<module>/doctype/<name>/<name>.py` instead — a whitelisted method there is reachable
at `erp.<module>.doctype.<name>.<name>.<function>`.

> Note: as of writing, this app has **no** `@frappe.whitelist` endpoints yet. The patterns
> below are Frappe conventions, not extracted from existing code in this repo — the first
> one you add sets the precedent, so keep it clean.

## The pattern

```python
# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _


@frappe.whitelist(methods=["GET"])
def get_active_institutions(institution_type: str | None = None) -> list[dict]:
	"""Active institutions, optionally narrowed by type.

	Every whitelisted function is a public HTTP endpoint reachable by any logged-in
	user. Permission is never implied by the caller — check it here.
	"""
	if not frappe.has_permission("Institution", "read"):
		frappe.throw(_("Not permitted"), frappe.PermissionError)

	filters = {"status": "Active"}
	if institution_type:
		filters["institution_type"] = institution_type

	return frappe.get_all(
		"Institution",
		filters=filters,
		fields=["name", "id", "institution_name", "short_name"],
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
const res = await call.get<{ message: Institution[] }>(
  'erp.api.master.get_active_institutions',
  { institution_type: 'University' },
)
const institutions = res.message
```

Frappe wraps every whitelisted return value in a `message` key — unwrap it. Pair with
TanStack Query rather than calling in an effect:

```ts
useQuery({
  queryKey: ['active-institutions', institutionType],
  queryFn: () =>
    call.get<{ message: Institution[] }>('erp.api.master.get_active_institutions', {
      institution_type: institutionType,
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
  "http://127.0.0.1:8000/api/method/erp.api.master.get_active_institutions"
```

A 403 from an unauthenticated curl is the correct result — it proves the endpoint exists
and is guarded. `404` means the path is wrong or the cache is stale.
