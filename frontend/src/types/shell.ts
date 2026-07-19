/** One module in the icon rail, from `erp.api.navigation.get_module_rail`. */
export interface RailModule {
  /** Module Def name, e.g. "Gate_Entry". The API identity. */
  module: string
  /** URL segment, e.g. "gate-entry". */
  slug: string
  label: string
  icon: string | null
  /** Workspace ordering. The rail is sorted server-side; exposed for debugging only. */
  sequence_id: number
}

export interface MenuItem {
  label: string
  icon: string | null
  link_type: 'DocType' | 'Page' | 'Report'
  link_to: string | null
  slug: string | null
  /**
   * SPA path WITHOUT the /erp prefix, e.g. "/master/institution". The prefix is the
   * router's basename in production — baking it in here would produce /erp/erp/...
   * `route` is null for link types that have no SPA page yet.
   */
  route: string | null
  description: string | null
}

/** A Workspace "Card Break" group. `label` is null for links before any Card Break. */
export interface MenuGroup {
  label: string | null
  icon: string | null
  items: MenuItem[]
}

export interface ModuleMenu {
  module: string
  module_slug: string
  label: string
  icon: string | null
  groups: MenuGroup[]
  /** Permitted slugs only — an unpermitted deep link is absent, so it fails closed. */
  doctype_by_slug: Record<string, string>
}
