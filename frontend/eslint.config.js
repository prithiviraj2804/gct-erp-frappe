import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * Import boundaries — the layering rule in `src/README.md`, enforced.
 *
 * A folder structure is a suggestion until something fails when you cross it. These rules are
 * what stop the layers collapsing back into one bucket:
 *
 *   the base    `components/`, `hooks/`, `lib/`, `types/`, `global/` may import nothing above
 *               themselves. The moment one imports a page or a module it is not shared any
 *               more, and every consumer inherits that dependency. This is FIVE folders where
 *               it used to be one (`shared/`), which is the cost of the flatter layout — the
 *               rule is the same rule, it just has to be stated five times.
 *   modules/    may not import each other. Gate reaching into Master is how two features become
 *               one that cannot be removed. They meet through `pages/doctype/registry.ts`.
 *   pages/      may not import a module. The registry inverts that: modules register with the
 *               renderer, never the other way round, or the generic renderer grows a list of the
 *               specific things it knows about — exactly what it exists to avoid.
 *   shell/      may not import a page or a module. Navigation is data-driven from Frappe
 *               workspaces; a shell that imports a page has hardcoded part of the nav tree.
 */
const boundaries = (target, forbidden, message) => ({
  files: [`src/${target}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      { patterns: forbidden.map((group) => ({ group: [group], message })) },
    ],
  },
})

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // The base layer is five folders now, so the same rule is applied to each. `components/ui`
  // and the rest cannot reach upward into a page, a module or the shell.
  ...['components', 'hooks', 'lib', 'types', 'global'].map((base) =>
    boundaries(
      base,
      ['@/pages/*', '@/pages/**', '@/modules/*', '@/modules/**', '@/shell/*', '@/shell/**', '@/auth/*', '@/auth/**', '@/app/*', '@/app/**'],
      `${base}/ is a base layer and may not import from a layer above it.`,
    ),
  ),
  boundaries(
    'modules',
    ['@/modules/*/**'],
    'A module may not import another module. Meet through pages/doctype/registry.ts.',
  ),
  boundaries(
    'pages',
    ['@/modules/*/**'],
    'pages/ must not import a module — modules register with the renderer, not the reverse. The one exception is registry.ts, which is where that inversion happens.',
  ),
  boundaries(
    'shell',
    ['@/pages/*', '@/pages/**', '@/modules/*', '@/modules/**'],
    'The shell is navigation only; it is data-driven from Frappe workspaces and must not import a page.',
  ),
  {
    // The single, deliberate exception: the registry is where modules are collected. It is the
    // inversion point, so it is the one file in pages/ allowed to name them.
    files: ['src/pages/doctype/registry.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Vendored shadcn output. It ships `buttonVariants`/`badgeVariants`/`useSidebar` alongside
    // its components by design, which the fast-refresh rule flags and we are not going to fix
    // by editing generated files — the next `shadcn add` would undo it.
    files: ['src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
