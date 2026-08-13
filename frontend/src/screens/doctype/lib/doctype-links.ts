import { createContext, use, useMemo } from 'react'

import { useAllModuleMenus } from '@/shared/hooks/use-navigation'

/**
 * Where a Link field's value can be opened.
 *
 * A Link cell used to print its raw value and dead-end there. The reason recorded in
 * `cell-renderers.ts` — that resolving twenty rows × three link columns to their *titles*
 * would cost a query per column — is sound, and this does not undo it: the value is still
 * printed verbatim, because `name` in this app is a readable business key. What it adds is the
 * href, which costs nothing at all.
 *
 * The route for a doctype is already in the browser: `get_module_menu` returns
 * `doctype_by_slug` per module, and `usePrefetchModuleMenus` warms every module the user has as
 * soon as the rail resolves. So this reads the cache and inverts it.
 *
 * Two consequences worth naming, both correct:
 *
 *   - A doctype on no workspace the user can reach has no entry, so its cells render as plain
 *     text. That is the same fail-closed behaviour `useDoctypeRoute` relies on — a link to a
 *     screen the user would be bounced off is worse than no link.
 *   - The index is empty on the first render of a cold session and fills a moment later. A
 *     cell that renders text and then becomes a link is fine; the text never moves.
 */

export type DoctypeLinkIndex = Readonly<Record<string, string>>

export const EMPTY_LINK_INDEX: DoctypeLinkIndex = Object.freeze({})

/**
 * Context rather than a prop, because the alternative is threading an index through
 * `DoctypeGrid` → the cell renderers → every cell component purely so one of the twelve can use it.
 *
 * Deliberately a bare Context and not a `<Provider>` component: a module exporting both a
 * component and a hook trips `react-refresh/only-export-components`, the same constraint that
 * put `cell-renderers` in a `.ts` file.
 */
export const DoctypeLinkContext = createContext<DoctypeLinkIndex>(EMPTY_LINK_INDEX)

/** The list path for a doctype, or null when it is not reachable by this user. */
export function useDoctypeLink(doctype: string | null | undefined): string | null {
  const index = use(DoctypeLinkContext)
  return (doctype && index[doctype]) || null
}

/** Build the doctype → list-path index from every module menu the user can reach. */
export function useDoctypeLinkIndex(): DoctypeLinkIndex {
  const menus = useAllModuleMenus()

  // The identity of `menus` is new on every render, so the memo is keyed on what actually
  // decides the answer: which modules have resolved, and in what order.
  const signature = menus.map((menu) => menu.module_slug).join('|')

  return useMemo(() => {
    const index: Record<string, string> = {}
    for (const menu of menus) {
      for (const [slug, doctype] of Object.entries(menu.doctype_by_slug)) {
        // First module wins. A doctype linked from two workspaces is reachable at two
        // routes; picking the first keeps the destination stable across renders, and the
        // rail's own ordering decides which.
        index[doctype] ??= `/${menu.module_slug}/${slug}`
      }
    }
    return Object.freeze(index)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` stands in for `menus`, whose identity is new every render.
  }, [signature])
}
