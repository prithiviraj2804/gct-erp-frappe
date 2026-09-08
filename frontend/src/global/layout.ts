import { useCallback, useSyncExternalStore } from 'react'

/**
 * Which shell arrangement the app renders.
 *
 * These are whole navigation designs, not skins — they differ in where the modules live, where a
 * module's screens live, and how many planes the chrome has. They are a preference rather than a
 * fork so the alternatives can be compared on real data, in one build, without the default ever
 * being at risk: `rail` is what ships, and everything else is opt-in.
 *
 * - `rail`    — 56px icon rail + a 220px screen column. Two nav planes, both permanent, maximum
 *               page width. The default, and the only one any existing test exercises.
 * - `topnav`  — a 240px sidebar listing modules BY NAME, and the current module's screens as
 *               group menus across a top bar. The classic ERP menubar; names beat glyphs when
 *               you do not yet know the app, and a top bar scales to modules with many screens.
 * - `stacked` — one 260px sidebar, every module a collapsible section holding its own screens.
 *               No rail and no top bar: one column, one mental model, the whole tree visible.
 */
export type Layout = 'rail' | 'topnav' | 'stacked'

export const LAYOUTS: readonly Layout[] = ['rail', 'topnav', 'stacked']

export const LAYOUT_LABELS: Record<Layout, string> = {
  rail: 'Rail',
  topnav: 'Top nav',
  stacked: 'Stacked',
}

/** One line each, for the picker — these are design choices, not jargon a user should decode. */
export const LAYOUT_HINTS: Record<Layout, string> = {
  rail: 'Icon rail plus a screen column. Most page width.',
  topnav: 'Modules in the sidebar, screens across the top.',
  stacked: 'One sidebar. Every module expands in place.',
}

export const LAYOUT_STORAGE_KEY = 'erp-layout'

/**
 * `rail` — the shell that shipped. Changing this default changes the app for every user who has
 * never touched the setting, which is the whole population until they do.
 */
const DEFAULT: Layout = 'rail'

function isLayout(value: string | null): value is Layout {
  return value === 'rail' || value === 'topnav' || value === 'stacked'
}

/**
 * Cached, because `useSyncExternalStore` calls `getSnapshot` on every render and must get a
 * value that is `Object.is`-stable between changes — a fresh `localStorage.getItem` per call is
 * both a synchronous disk-backed read and, more importantly, an invitation to tear.
 */
let current: Layout | null = null

const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

function read(): Layout {
  if (current === null) {
    try {
      const stored = localStorage.getItem(LAYOUT_STORAGE_KEY)
      current = isLayout(stored) ? stored : DEFAULT
    } catch {
      // Private mode, partitioned iframe, storage disabled.
      current = DEFAULT
    }
    document.documentElement.dataset.layout = current
  }
  return current
}

/** No SSR here, but StrictMode's double render demands a snapshot that never touches `document`. */
function serverSnapshot(): Layout {
  return DEFAULT
}

export function setLayout(next: Layout): void {
  current = next
  // Mirrored onto <html> purely so the arrangement is legible in devtools and assertable in a
  // test. Nothing in CSS keys off it — unlike theme and density, a layout is a different React
  // tree, not a different set of values, so there is no flash to prevent and no boot script.
  document.documentElement.dataset.layout = next
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, next)
  } catch {
    // The choice still holds for this session; it just will not survive a reload.
  }
  for (const listener of listeners) listener()
}

/** `[layout, setLayout]`, the useState shape — so a caller reads like any other control. */
export function useLayout(): [Layout, (next: Layout) => void] {
  const layout = useSyncExternalStore(subscribe, read, serverSnapshot)
  const set = useCallback((next: Layout) => setLayout(next), [])
  return [layout, set]
}
