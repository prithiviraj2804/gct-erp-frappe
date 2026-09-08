---
name: verify
description: Verify a change to the erp app actually works by exercising it, not just type-checking — backend via bench console/tests, frontend via build plus Playwright against a real browser. Use before committing anything non-trivial.
---

# Verifying a change in `apps/erp`

Run only the parts your change touches. The goal is to observe real behaviour, not to
watch a compiler succeed — `tsc` passing says nothing about whether the page renders.

## Prerequisites

Anything hitting `/api` needs the bench running:

```bash
cd /workspace/development/frappe-bench && bench start
```

Quick check that it's up (403 means it's alive and just wants auth — that's fine):

```bash
curl -s -o /dev/null -w "%{http_code}" -H "Host: erp.localhost" \
  http://127.0.0.1:8000/api/method/frappe.auth.get_logged_user
```

## Backend changes (doctypes, hooks, `erp/api/`, `erp/utils.py`)

```bash
cd /workspace/development/frappe-bench
bench --site erp.localhost migrate                      # after any schema/doctype change
bench --site erp.localhost clear-cache                  # after hooks.py / config changes
bench --site erp.localhost run-tests --app erp
```

Then actually exercise it in a console — a passing test suite is not evidence that your
specific change works if no test covers it:

```bash
bench --site erp.localhost console
```
```python
# e.g. prove the UUID hook fires for a new doctype
d = frappe.get_doc({"doctype": "Trust", "trust_code": "T-1"}).insert()
print(d.id)
frappe.db.rollback()   # console changes persist otherwise
```

`hooks.py` edits need `clear-cache` before they take effect. A hook that appears not to
fire is usually a stale cache, not broken code.

## Frontend changes (`frontend/`)

```bash
cd /workspace/development/frappe-bench/apps/erp/frontend
npm run lint
npm run build      # tsc -b && vite build → ../erp/public/dist/
npm run test:e2e   # Playwright; auto-starts the Vite dev server
```

`tsconfig.app.json` covers `src`; `tsconfig.node.json` covers `vite.config.ts`,
`playwright.config.ts`, and `e2e`. If you add a directory outside those, `tsc -b` will
silently skip it — check the file is actually included before trusting a green build.

## Driving the real app (Playwright MCP)

The `playwright` MCP server is configured in `.mcp.json`. Use it to load the app and look
at it, rather than inferring from code:

- **Dev**: <http://localhost:5173> — needs `npm run dev`; proxies `/api` to the bench.
- **Production route**: <http://erp.localhost:8000/erp> — serves the built
  `erp/public/dist/`, so **run `npm run build` first** or you're testing a stale bundle.

Deep routes must survive a hard refresh (`website_route_rules` maps `/erp/<path>`);
`/erp/home` returning 200 is the check that client-side routing still works.

Useful: `browser_navigate`, `browser_snapshot` (accessibility tree — prefer over
screenshots for asserting structure), `browser_console_messages`, `browser_network_requests`.

## Reporting

State what you actually ran and what it printed. If a step was skipped, say so. If tests
fail, show the output rather than describing it. "Build passed" is not the same claim as
"the feature works", and only the second one answers the question.
