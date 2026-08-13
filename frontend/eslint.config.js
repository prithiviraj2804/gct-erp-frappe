import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * Import boundaries — the layering rule in `src/README.md`, enforced.
 *
 * A folder structure is a suggestion until something fails when you cross it. These four rules
 * are what stop the layers collapsing back into one bucket:
 *
 *   shared/  may import nothing above itself. The moment it imports a screen or a module, it
 *            is not shared, and every consumer inherits that dependency.
 *   modules/ may not import each other. Gate reaching into Master is how two features become
 *            one that cannot be removed. They meet through `screens/doctype/registry.ts`.
 *   screens/ may not import a module. The registry inverts that: modules register with the
 *            renderer, never the other way round, or the generic renderer grows a list of the
 *            specific things it knows about — exactly what it exists to avoid.
 *   shell/   may not import a screen or a module. Navigation is data-driven from Frappe
 *            workspaces; a shell that imports a screen has hardcoded part of the nav tree.
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
  boundaries(
    'shared',
    ['@/screens/*', '@/screens/**', '@/modules/*', '@/modules/**', '@/shell/*', '@/shell/**', '@/auth/*', '@/auth/**', '@/app/*', '@/app/**'],
    'shared/ is the bottom layer and may not import from a layer above it.',
  ),
  boundaries(
    'modules',
    ['@/modules/*/**'],
    'A module may not import another module. Meet through screens/doctype/registry.ts.',
  ),
  boundaries(
    'screens',
    ['@/modules/*/**'],
    'screens/ must not import a module — modules register with the renderer, not the reverse. The one exception is registry.ts, which is where that inversion happens.',
  ),
  boundaries(
    'shell',
    ['@/screens/*', '@/screens/**', '@/modules/*', '@/modules/**'],
    'The shell is navigation only; it is data-driven from Frappe workspaces and must not import a screen.',
  ),
  {
    // The single, deliberate exception: the registry is where modules are collected. It is the
    // inversion point, so it is the one file in screens/ allowed to name them.
    files: ['src/screens/doctype/registry.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Vendored shadcn output. It ships `buttonVariants`/`badgeVariants`/`useSidebar` alongside
    // its components by design, which the fast-refresh rule flags and we are not going to fix
    // by editing generated files — the next `shadcn add` would undo it.
    files: ['src/shared/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
