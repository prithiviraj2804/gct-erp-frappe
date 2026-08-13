# `frontend/src` — layout and layering

Five layers. Each may import the ones below it and nothing above. `eslint.config.js` enforces
this; a violation fails `npm run lint`, not code review.

```
app/        Composition root: routes, providers, query client. Imports everything.
  ↑
shell/      The authenticated frame — rail, flyout, topbar, command palette, module overview.
auth/       Sign-in, the session gate.
screens/    The generic doctype renderer: list, record, and the registry that lets a
            module override either without touching a route.
  ↑
modules/    One folder per Frappe module (gate/, master/), mirroring erp/<module>/ on the
            server. Screen overrides and bespoke task screens live here.
  ↑
shared/     ui/ (shadcn output), lib/, hooks/, types/, components/. Bottom layer: imports
            nothing above itself, ever.
```

## The rules, and why each one earns its keep

**`shared/` imports nothing above itself.** The moment it imports a screen, every consumer of
every shared component inherits that dependency, and "shared" becomes "the other bucket".

**No module imports another module.** Gate reaching into Master is how two features become one
that cannot be removed independently. They meet at `screens/doctype/registry.ts`.

**`screens/` does not import a module** — `registry.ts` is the single exception, because it *is*
the inversion point. Modules register with the renderer; the renderer never grows a list of the
specific things it knows about. That list is what a generic renderer exists to avoid.

**`shell/` does not import a screen.** Navigation is generated from Frappe Module Defs and
Workspaces (`docs/MODULES.md`). A shell that imports a screen has hardcoded part of a nav tree
that is supposed to be data.

## Naming

- A file whose default export is a React component is **PascalCase** (`DoctypeGrid.tsx`,
  `DoctypeListScreen.tsx`).
- Everything else — hooks, lib modules, types — is **kebab-case** (`use-list-state.ts`,
  `module-icons.ts`).

Route-level components are suffixed `Screen`, so `ModuleScreen.tsx` is never confused with
`ModuleRail.tsx`.

## Adding a doctype screen

You don't. Add the doctype to a Workspace and it gets a list, a record page, breadcrumbs,
filters, sorting and permissions with no frontend change at all — see
[`docs/features/master-data-administration.md`](../../docs/features/master-data-administration.md).

Reach for `screens/doctype/registry.ts` only when the schema genuinely cannot say the thing,
and read the rule at the top of that file first: **an override may only override a default the
renderer already produces; it may never supply something the doctype JSON could have said.**
