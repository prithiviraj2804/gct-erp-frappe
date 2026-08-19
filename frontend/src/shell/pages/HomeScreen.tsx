import { LayersIcon } from 'lucide-react'

import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { useBrandedDocument, useInstitutionBranding } from '@/shared/hooks/use-branding'
import { useAllModuleMenus, useModuleRail } from '@/shared/hooks/use-navigation'
import { useSession } from '@/shared/hooks/use-session'
import { scopeStats } from '@/shared/lib/branding'
import { HomeSkeleton } from '@/shell/home/components/HomeSkeleton'
import { QuickAccess } from '@/shell/home/components/QuickAccess'
import { ScopeStats } from '@/shell/home/components/ScopeStats'
import { WelcomeHeader } from '@/shell/home/components/WelcomeHeader'
import { WorkspaceLaunchpad } from '@/shell/home/components/WorkspaceLaunchpad'
import { buildQuickAccess } from '@/shell/home/lib/quick-access'
import { buildWorkspaces } from '@/shell/home/lib/workspaces'

/**
 * Home — the dashboard a user lands on after signing in.
 *
 * It does the two things no per-module page can: orient (a greeting, the institution's identity
 * and its scale) and launch across every module at once. It is deliberately NOT a copy of the
 * rail — the rail is a 72px strip of icons; this gives modules names, summaries and counts, and
 * is the touch/keyboard-reachable way in. This reverses an earlier decision to redirect straight
 * to the first module: that redirect solved an *empty* home, not a useful one.
 *
 * The rail is the spine and everything else decorates it, so the states fall out of that. A rail
 * failure is the only hard error; a rail with no modules is the single "nothing to do here" case;
 * and a branding or menu miss just renders that section thinner rather than taking the page down.
 */
export default function HomePage() {
  const { data: session } = useSession()
  const { data: brand } = useInstitutionBranding()
  const { data: modules, isPending, isError, error, refetch } = useModuleRail()
  const menus = useAllModuleMenus()

  useBrandedDocument('Home', brand?.institution ?? null)

  if (isPending) return <HomeSkeleton />

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <ErrorState error={error} onRetry={() => void refetch()} title="Couldn't load your home" />
      </div>
    )
  }

  if (modules.length === 0) return <NoModules />

  const fullName = session?.status === 'authenticated' ? session.fullName : null
  const stats = scopeStats(brand?.scope ?? null)
  const workspaces = buildWorkspaces(modules, menus)
  const quickLinks = buildQuickAccess(menus)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <WelcomeHeader fullName={fullName} brand={brand?.institution ?? null} />

      {stats.length > 0 && <ScopeStats stats={stats} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WorkspaceLaunchpad workspaces={workspaces} />
        </div>
        <aside className="lg:col-span-1">
          <QuickAccess links={quickLinks} />
        </aside>
      </div>
    </div>
  )
}

/**
 * The one genuinely empty state: an account with no modules. AppShell renders no rail for these
 * users, so this page is the only thing on screen — it has to say why, and point at the fix,
 * rather than leave a blank frame. Kept as a heading (not an `EmptyState`) because it is the
 * whole page here, not a hole inside one.
 */
function NoModules() {
  return (
    <div className="grid flex-1 place-items-center px-6 py-16">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <LayersIcon className="size-7 text-muted-foreground" aria-hidden="true" />
        <h1 className="font-heading text-lg font-semibold text-foreground">No modules available</h1>
        <p className="text-sm text-muted-foreground">
          Your account has no modules assigned yet. Ask your administrator to grant access.
        </p>
      </div>
    </div>
  )
}
