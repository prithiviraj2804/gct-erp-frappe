import type { ModuleMenu } from '@/types/navigation'

/** A one-click deep link on the home page's Quick access rail. */
export interface QuickLink {
  /** Unique across modules — a screen label alone can repeat, the route cannot. */
  route: string
  label: string
  /** The module it lives in, shown as context because Quick access crosses modules. */
  module: string
}

/**
 * The first few openable screens across every module, in rail-then-authored order.
 *
 * Deliberately NOT called "recent": the app tracks no history yet, and a shortlist that claims to
 * be recent but isn't is worse than an honest one. This is simply the shortest path to the screens
 * a user is most likely to want, drawn from the same permission-filtered menu payload the rail
 * uses — so a screen the user cannot open can never appear here.
 */
export function buildQuickAccess(menus: ModuleMenu[], limit = 7): QuickLink[] {
  const links: QuickLink[] = []
  // A doctype linked from two workspaces would otherwise appear (and key) twice. Route is the
  // identity here, so the first mention wins and the rest are skipped.
  const seen = new Set<string>()

  for (const menu of menus) {
    for (const group of menu.groups) {
      for (const item of group.items) {
        if (!item.route || seen.has(item.route)) continue
        seen.add(item.route)
        links.push({
          route: item.route,
          label: item.label,
          module: menu.label,
        })
        if (links.length >= limit) return links
      }
    }
  }

  return links
}
