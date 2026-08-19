import type { ModuleMenu, RailModule } from '@/shared/types/navigation'

/**
 * One launchable module on the home page — a rail module enriched with what its menu holds.
 *
 * The rail is the authority on WHICH modules a user has, and resolves first, so a card exists the
 * moment the rail lands. The menu adds detail — how many screens, and the Card Break group names
 * that summarise them — folded in as it arrives, so a card never blocks on its own count.
 */
export interface Workspace {
  module: string
  slug: string
  label: string
  /** SPA path to the module overview, e.g. "/master". */
  route: string
  /** Openable screens in the module. `null` until the menu loads. */
  screenCount: number | null
  /**
   * The module's Card Break group names, joined — "Organisation · Academic · Admissions · People".
   * A real, authored summary of what the module holds, so the card says more than its title.
   * `null` when the menu has no named groups (or has not loaded yet).
   */
  summary: string | null
}

/**
 * Join the rail (module identity + order) to the loaded menus (contents), in rail order.
 *
 * `menus` is whatever `useAllModuleMenus` has resolved so far — possibly fewer than the rail, or
 * empty on first paint. A module with no menu yet still produces a card, with a null count and
 * summary, which the card renders as absence rather than as zero.
 */
export function buildWorkspaces(rail: RailModule[], menus: ModuleMenu[]): Workspace[] {
  const byModule = new Map(menus.map((menu) => [menu.module, menu]))

  return rail.map((mod) => {
    const menu = byModule.get(mod.module) ?? null
    return {
      module: mod.module,
      slug: mod.slug,
      label: mod.label,
      route: `/${mod.slug}`,
      screenCount: menu ? countScreens(menu) : null,
      summary: menu ? summarise(menu) : null,
    }
  })
}

/** Openable screens = menu items that resolve to an SPA route; a Page/Report without one is not one. */
function countScreens(menu: ModuleMenu): number {
  return menu.groups.reduce((total, group) => total + group.items.filter((item) => item.route).length, 0)
}

function summarise(menu: ModuleMenu): string | null {
  const labels = menu.groups.map((group) => group.label).filter((label): label is string => !!label)
  return labels.length > 0 ? labels.join(' · ') : null
}
