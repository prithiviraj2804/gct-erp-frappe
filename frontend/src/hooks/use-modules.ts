import { useQuery } from '@tanstack/react-query'

import { fetchAllowedModules, moduleKeys } from '@/lib/modules'

export function useAllowedModules() {
  return useQuery({
    queryKey: moduleKeys.allowed(),
    queryFn: fetchAllowedModules,
    // Module access changes when an admin edits the user's blocked modules — rare, and a
    // reload picks it up. No point re-fetching this on every mount.
    staleTime: 5 * 60_000,
  })
}
