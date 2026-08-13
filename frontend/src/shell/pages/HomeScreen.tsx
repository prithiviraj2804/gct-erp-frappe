import { LayersIcon } from 'lucide-react'
import { Navigate } from 'react-router'

import { Button } from '@/shared/ui/button'
import { Spinner } from '@/shared/ui/spinner'
import { useBrandedDocument, useInstitutionBranding } from '@/shared/hooks/use-branding'
import { useModuleRail } from '@/shared/hooks/use-navigation'
import { normalizeFrappeError } from '@/shared/lib/errors'

/**
 * Home — a redirect to the first module this user is allocated.
 *
 * There is no landing screen of its own. A generic home for an ERP whose entire content is
 * per-module would be a page whose only job is to point somewhere else, so it points
 * immediately: `get_module_rail` returns only the modules this user may see, ordered by the
 * workspace `sequence_id` that exists to control exactly this, and the first one wins.
 *
 * The route stays because things link to it — the topbar's institution mark, the login
 * redirect, `RequireAuth`'s bounce-back — and because it is the one place that can explain a
 * user with no modules at all. AppShell renders no rail in that case, so if this page said
 * nothing they would face a blank screen with no navigation and no reason given.
 */
export default function HomePage() {
  const { data: brand } = useInstitutionBranding()
  const { data: modules, isPending, isError, error, refetch } = useModuleRail()

  useBrandedDocument('Home', brand?.institution ?? null)

  if (isPending) {
    return (
      <div className="grid flex-1 place-items-center" role="status" aria-live="polite">
        <Spinner className="size-6 text-muted-foreground" />
        <span className="sr-only">Loading your modules</span>
      </div>
    )
  }

  if (isError) {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">{normalizeFrappeError(error).message}</p>
        <Button className="h-10" onClick={() => void refetch()}>
          Try again
        </Button>
      </Centered>
    )
  }

  if (modules.length === 0) {
    return (
      <Centered>
        <LayersIcon className="size-7 text-muted-foreground" aria-hidden="true" />
        <h1 className="font-heading text-lg font-semibold text-foreground">No modules available</h1>
        <p className="text-sm text-muted-foreground">
          Your account has no modules assigned yet. Ask your administrator to grant access.
        </p>
      </Centered>
    )
  }

  // `replace`, so Back from the module page leaves the app rather than bouncing through the
  // redirect again.
  return <Navigate to={`/${modules[0].slug}`} replace />
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid flex-1 place-items-center px-6 py-16">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">{children}</div>
    </div>
  )
}
