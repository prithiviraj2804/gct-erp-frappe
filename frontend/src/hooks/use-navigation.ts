import { useQueries, useQueryClient, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { fetchModuleMenu, fetchModuleRail, navKeys } from '@/lib/navigation'
import type { ModuleMenu, RailModule } from '@/types/navigation'

const NAV_STALE_TIME = 5 * 60_000

export function useModuleRail() {
  return useQuery({
    queryKey: navKeys.rail(),
    queryFn: fetchModuleRail,
    // Changes only when an admin edits workspaces or a user's blocked modules — a reload
    // picks that up. No point refetching on every mount.
    staleTime: 5 * 60_000,
  })
}

export function useModuleMenu(module: string | null) {
  return useQuery({
    queryKey: navKeys.menu(module),
    queryFn: () => fetchModuleMenu(module!),
    enabled: !!module,
    staleTime: NAV_STALE_TIME,
  })
}

/**
 * Warm every module's menu as soon as the rail resolves.
 *
 * The flyout opens on hover, and a menu that is not already cached turns that into two content
 * swaps inside a quarter of a second: the panel begins sliding in showing skeleton rows, and
 * ~250ms later they blink out and the real items appear. Measured, and it is the whole of what
 * made hovering feel rough — the transition itself never drops a frame.
 *
 * Prefetching removes the skeleton from the hover path entirely. It is affordable precisely
 * here: a menu is a few link rows, there is one request per allocated module, they are fetched
 * once per session under the same 5-minute `staleTime`, and the rail already names every module
 * the user has. `prefetchQuery` is a no-op for anything already cached, so the module you are
 * currently in — fetched by the flyout on mount — is never requested twice.
 *
 * An effect is right here: this synchronises an external cache, and sets no state.
 */
export function usePrefetchModuleMenus(modules: RailModule[] | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!modules?.length) return

    for (const { module } of modules) {
      void queryClient.prefetchQuery({
        queryKey: navKeys.menu(module),
        queryFn: () => fetchModuleMenu(module),
        staleTime: NAV_STALE_TIME,
      })
    }
  }, [modules, queryClient])
}

/**
 * Every module's menu the user can reach, in rail order.
 *
 * Two very different consumers need the same thing — the command palette, which lists every
 * screen in the app, and the doctype link index, which turns a Link value into a route — and
 * both need it as *data*, not as one module at a time.
 *
 * `useQueries` rather than reading the query cache directly, so a menu landing re-renders the
 * consumer instead of leaving it holding a stale answer. Every one of these is already warm
 * (see `usePrefetchModuleMenus`), so in practice it issues no requests at all.
 */
export function useAllModuleMenus(): ModuleMenu[] {
  const { data: modules } = useModuleRail()

  const results = useQueries({
    queries: (modules ?? []).map((module) => ({
      queryKey: navKeys.menu(module.module),
      queryFn: () => fetchModuleMenu(module.module),
      staleTime: NAV_STALE_TIME,
    })),
  })

  return results.map((result) => result.data).filter((menu): menu is ModuleMenu => !!menu)
}
