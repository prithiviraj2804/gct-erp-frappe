import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether the `rail` shell's nav column (its second sidebar) is hidden.
 *
 * A preference rather than component state, for one reason: someone who collapses it wants it
 * collapsed tomorrow too. Working a wide table is not a mood, it is how that person's day looks.
 *
 * Scoped to the `rail` layout on purpose. `topnav` has no second sidebar — its screens are in the
 * top bar — and `stacked` is a single column whose collapse is per-module, so neither has
 * anything for this to hide.
 */
export const NAV_COLLAPSED_STORAGE_KEY = 'erp-nav-collapsed'

let current: boolean | null = null

const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

/** Cached: `getSnapshot` runs on every render and must be stable between actual changes. */
function read(): boolean {
  if (current === null) {
    try {
      current = localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY) === '1'
    } catch {
      current = false
    }
  }
  return current
}

/** Expanded. Collapsing hides navigation, so it is never the state someone arrives in. */
function serverSnapshot(): boolean {
  return false
}

/**
 * The current value, outside React.
 *
 * For the global key handler in `AppShell`, which must stay registered exactly once and
 * therefore cannot depend on a value that changes on every toggle. Mirroring the state into a
 * ref was the first attempt and the React Compiler rejects it — writing a ref during render is
 * exactly the pattern that rule exists to catch. Reading the store is the right answer anyway:
 * the store is already the source of truth, so there is nothing to keep in sync.
 */
export function getNavCollapsed(): boolean {
  return read()
}

export function setNavCollapsed(next: boolean): void {
  current = next
  try {
    localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, next ? '1' : '0')
  } catch {
    // Holds for the session; will not survive a reload.
  }
  for (const listener of listeners) listener()
}

export function useNavCollapsed(): [boolean, (next: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, read, serverSnapshot)
  const set = useCallback((next: boolean) => setNavCollapsed(next), [])
  return [collapsed, set]
}
