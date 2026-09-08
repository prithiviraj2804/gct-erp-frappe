# `frontend/src` — layout and layering

The **conventional Vite/shadcn top level** — `components/`, `hooks/`, `lib/`, `types/` where a
React developer expects to find them — over an **enforced layering rule**. `eslint.config.js`
enforces the layers; a violation fails `npm run lint`, not code review.

```
app/          Composition root: routes, providers, query client. Imports everything.
  ↑
shell/        The authenticated frame — rail, nav column, status bar, command palette. Picks
              between three layouts in shell/layouts/.
auth/         Sign-in, the session gate.
pages/        The generic doctype renderer: list, record, create, and the registry that lets a
              module override any of them without touching a route.
  ↑
modules/      One folder per Frappe module (gate/, master/, admission/, accounts/), mirroring
              erp/<module>/ on the server. Screen overrides and bespoke task screens.
  ↑
components/   ui/ (shadcn output) plus the app's own composites, grouped by job:
              appearance/ brand/ controls/ feedback/ layout/ table/
hooks/        Cross-cutting React hooks.
lib/          Framework-free helpers, API handles, schemas.
types/        Shared payload types.
global/       Cross-cutting stores — the appearance preferences (theme, density, layout,
              nav-column). Plain modules over `useSyncExternalStore`, no provider.
```

## Why the base layer is five folders and not one

It used to be a single `shared/`, which made the rule easy to state ("shared imports nothing
above itself") and made the tree one level deeper than anyone expects: `shared/lib/utils`,
`shared/hooks/use-session`, `shared/ui/button`. The five folders above are the layout every
Vite + shadcn project uses, and `components.json` can point at them without a translation step.

**The rule did not change — only the number of places it has to be written.** All five are the
base layer and none of them may import from `pages/`, `modules/`, `shell/`, `auth/` or `app/`.
`eslint.config.js` applies the same boundary to each; there is a probe in the commit history
proving it still rejects a violation, because a retargeted rule that quietly matches nothing
passes lint just as happily as a correct one.

## The two inversions worth knowing

- **`pages/` may not import a module.** Modules register with the renderer through
  `pages/doctype/registry.ts` — the one file exempted from the rule — so the generic renderer
  never grows a list of the specific things it knows about.
- **`shell/` may not import a page.** Navigation is data-driven from Frappe workspaces; a shell
  that imports a page has hardcoded part of the nav tree.
