import type { RailModule } from '@/types/navigation'

/**
 * What every shell layout is handed.
 *
 * `AppShell` resolves all of this once — the rail query, the module the URL is in, the module to
 * show, the palette/shortcut callbacks — and each layout only arranges it. That split is what
 * keeps the alternatives honest: they cannot differ in *behaviour*, only in where things sit,
 * because none of them owns any state. In particular there is still exactly ONE global key
 * listener in the app, and it is not in here.
 */
export interface ShellLayoutProps {
  /** Every module this user is allocated, in display order. Empty while `isPending`. */
  modules: RailModule[]
  isPending: boolean
  /** Module Def name the URL is inside, or null on a non-module route like /home. */
  activeModule: string | null
  /** The module whose screens to show: the active one, else the first allocated. */
  shown: RailModule | null
  /** False only for a user with no modules at all. */
  hasModules: boolean
  onOpenCommandPalette: () => void
  onOpenShortcuts: () => void
}
