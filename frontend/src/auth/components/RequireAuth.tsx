import { Navigate, Outlet, useLocation } from 'react-router'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useSession } from '@/hooks/use-session'
import { ROUTES } from '@/lib/constants'
import { normalizeFrappeError } from '@/lib/errors'

function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-live="polite">
      <Spinner className="size-6 text-muted-foreground" />
      <span className="sr-only">Checking your session</span>
    </div>
  )
}

export function RequireAuth() {
  const location = useLocation()
  const { data, isPending, isError, error, refetch } = useSession()

  if (isPending) return <FullPageSpinner />

  // A failed session probe is NOT the same as being logged out, and conflating them would
  // throw a perfectly valid user back to /login over a dropped connection. Offer a retry.
  if (isError) {
    const { message } = normalizeFrappeError(error)
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button className="h-10" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (data.status === 'anonymous') {
    // Remember where they were headed so login can send them back.
    return <Navigate to={ROUTES.LOGIN} state={{ from: location.pathname }} replace />
  }

  return <Outlet />
}
