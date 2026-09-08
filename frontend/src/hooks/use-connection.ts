import { onlineManager, useIsFetching, useIsMutating } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

export type ConnectionState = 'offline' | 'saving' | 'syncing' | 'ready'

/**
 * Whether the browser believes it has a network.
 *
 * Read from TanStack Query's `onlineManager` rather than from `navigator.onLine` directly, and
 * that is the whole point: `onlineManager` is what Query itself consults to decide whether to
 * pause a request. Reading the same source means the indicator and the behaviour can never
 * disagree — a bar that says "online" while every query sits paused is worse than no bar.
 *
 * `navigator.onLine` is famously optimistic (it reports a captive portal as online), so treat
 * this as "the browser has an interface", not "the server is reachable". A request that fails
 * anyway still surfaces as an error on the screen that made it; this only explains the case the
 * screen cannot, which is nothing happening at all.
 */
function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  )
}

/**
 * What the app is doing right now, as one value.
 *
 * Ranked, not combined — a bar with room for one line has to pick, and the order is by what the
 * user can least afford to miss: losing the network beats an in-flight write, and a write beats
 * a read. `saving` is ranked above `syncing` because a mutation is the user's own unsaved work
 * and a query is the app refreshing itself.
 *
 * Every input is state the app already keeps. Nothing here is a new request, a poll or a
 * heartbeat: `useIsFetching`/`useIsMutating` are counters Query maintains anyway, so this
 * indicator costs a subscription and nothing else.
 */
export function useConnectionState(): ConnectionState {
  const online = useIsOnline()
  const fetching = useIsFetching()
  const mutating = useIsMutating()

  if (!online) return 'offline'
  if (mutating > 0) return 'saving'
  if (fetching > 0) return 'syncing'
  return 'ready'
}
