import { useQuery } from '@tanstack/react-query'

import { fetchSession, sessionKeys } from '@/shared/lib/session'

export function useSession() {
  return useQuery({
    queryKey: sessionKeys.current(),
    queryFn: fetchSession,
    // "Logged out" comes back as data (status: 'anonymous'), so anything that lands here
    // is a genuine failure and retrying it just delays the error screen.
    retry: false,
    staleTime: 5 * 60_000,
    // The server can expire the session while the tab sits in the background; refetching
    // on focus is how we notice, since `sid` is httponly and unreadable from JS.
    refetchOnWindowFocus: true,
  })
}
