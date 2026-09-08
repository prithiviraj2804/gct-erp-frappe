import { useParams } from 'react-router'

import { useModuleMenu, useModuleRail } from '@/hooks/use-navigation'

export type DoctypeRouteStatus = 'pending' | 'unknown-module' | 'unknown-doctype' | 'ready'

export interface DoctypeRoute {
  moduleSlug: string
  doctypeSlug: string
  /** Module Def name, e.g. "Master". Null until resolved. */
  module: string | null
  moduleLabel: string | null
  /** Doctype name, e.g. "Institution". Null until resolved. */
  doctype: string | null
  /** The workspace link's label — what the menu calls this screen. Falls back to the doctype. */
  screenLabel: string | null
  /** Path of the module overview page, for breadcrumbs. */
  modulePath: string
  /** Path of this screen's list, for breadcrumbs and record links. */
  listPath: string
  status: DoctypeRouteStatus
}

/**
 * Resolve `/:moduleSlug/:doctypeSlug` to a real module and doctype.
 *
 * Costs no extra requests. Both queries it reads are already warm before the page mounts — the
 * rail is fetched by `AppShell` on every screen, and the menu by the flyout for the module you
 * are in. `get_module_menu` returns `doctype_by_slug` for exactly this purpose; its docstring
 * says so.
 *
 * Fails closed by construction rather than by a check. `doctype_by_slug` is built only from
 * links that passed `_is_doctype_allowed` server-side, so a doctype the user cannot read is
 * simply absent from the map and resolves to `unknown-doctype` — indistinguishable, correctly,
 * from a typo. A doctype that exists but is not on THIS module's workspace is also absent,
 * which is right: route identity comes from the workspace, not from the doctype's own module.
 */
export function useDoctypeRoute(): DoctypeRoute {
  const { moduleSlug = '', doctypeSlug = '' } = useParams()
  const { data: modules, isPending: railPending } = useModuleRail()

  const railModule = modules?.find((m) => m.slug === moduleSlug) ?? null
  const { data: menu, isPending: menuPending } = useModuleMenu(railModule?.module ?? null)

  const doctype = menu?.doctype_by_slug?.[doctypeSlug] ?? null
  const screenLabel =
    menu?.groups
      .flatMap((group) => group.items)
      .find((item) => item.slug === doctypeSlug && item.link_type === 'DocType')?.label ?? doctype

  let status: DoctypeRouteStatus
  if (railPending || (railModule && menuPending)) status = 'pending'
  else if (!railModule) status = 'unknown-module'
  else if (!doctype) status = 'unknown-doctype'
  else status = 'ready'

  return {
    moduleSlug,
    doctypeSlug,
    module: railModule?.module ?? null,
    moduleLabel: railModule?.label ?? null,
    doctype,
    screenLabel,
    modulePath: `/${moduleSlug}`,
    listPath: `/${moduleSlug}/${doctypeSlug}`,
    status,
  }
}
