import { useQuery } from '@tanstack/react-query'

import { fetchModuleMenu, fetchModuleRail, navKeys } from '@/lib/navigation'

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
    staleTime: 5 * 60_000,
  })
}
