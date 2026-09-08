import { useCallback, useSyncExternalStore } from 'react'

/**
 * How much air the app puts around a row.
 *
 * `comfortable` is the default and the one DESIGN.md's 44px `table.rowHeight` describes.
 * `compact` is the density a registrar comparing 300 enquiries actually wants — roughly a
 * quarter more rows per screen, at the same type size.
 *
 * Two steps, not three. SAP Fiori ships Cozy/Compact and Dynamics ships the same pair; a third
 * middle step gives users a choice they cannot perceive and gives us a third set of numbers to
 * keep true.
 */
export type Density = 'comfortable' | 'compact'

export const DENSITIES: readonly Density[] = ['comfortable', 'compact']

export const DENSITY_LABELS: Record<Density, string> = {
  comfortable: 'Comfortable',
  compact: 'Compact',
}

/** Mirrored, deliberately, by the inline boot script in `index.html`. Rename both together. */
export const DENSITY_STORAGE_KEY = 'erp-density'

const DEFAULT: Density = 'comfortable'

function isDensity(value: string | null): value is Density {
  return value === 'comfortable' || value === 'compact'
}

/**
 * The DOM is the store.
 *
 * Density is read by CSS (`[data-density='compact']` in `styles/index.css`) and by the table
 * engine, neither of which can subscribe to React state — so the attribute on `<html>` is the
 * real value and React reads it rather than owning a duplicate. That also means the boot script
 * that sets it before first paint needs no handoff: by the time React mounts, the value is
 * already correct, and `useSyncExternalStore` simply reports it.
 *
 * The alternative — React state as the source, an effect writing the attribute — has a frame
 * where the two disagree, and that frame is a visible reflow of every table on screen.
 */
function read(): Density {
  const value = document.documentElement.dataset.density ?? null
  return isDensity(value) ? value : DEFAULT
}

const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

/**
 * Server snapshot. There is no SSR here, but `useSyncExternalStore` demands one under
 * StrictMode's double-render and it must not touch `document`.
 */
function serverSnapshot(): Density {
  return DEFAULT
}

export function setDensity(next: Density): void {
  document.documentElement.dataset.density = next
  try {
    localStorage.setItem(DENSITY_STORAGE_KEY, next)
  } catch {
    // Private mode, partitioned iframe, storage disabled. The attribute is set either way, so
    // the choice holds for this session and simply does not survive a reload.
  }
  for (const listener of listeners) listener()
}

/**
 * `[density, setDensity]`, the useState shape — so a caller reads like any other control.
 *
 * No provider and no context: density is one global attribute on `<html>`, and a context would
 * add a tree-wide re-render to deliver a value that CSS already applied without React's help.
 */
export function useDensity(): [Density, (next: Density) => void] {
  const density = useSyncExternalStore(subscribe, read, serverSnapshot)
  const set = useCallback((next: Density) => setDensity(next), [])
  return [density, set]
}
