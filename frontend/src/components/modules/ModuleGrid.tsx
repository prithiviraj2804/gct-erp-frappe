import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAllowedModules } from '@/hooks/use-modules'
import { normalizeFrappeError } from '@/lib/errors'
import { FALLBACK_MODULE_ICON, MODULE_ICONS } from '@/lib/module-icons'
import { moduleLabel } from '@/lib/modules'
import type { ErpModule } from '@/types/auth'

function ModuleCard({ module }: { module: ErpModule }) {
  const Icon = MODULE_ICONS[module.name] ?? FALLBACK_MODULE_ICON

  // Still not a link. Module landing pages don't exist yet (the generic list route is
  // Stage 2), and a card that looks clickable but goes nowhere is worse than one that
  // doesn't. Use the rail to switch modules; this grid is orientation.
  return (
    <li className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="font-heading text-sm font-semibold text-foreground">{moduleLabel(module)}</span>
    </li>
  )
}

export function ModuleGrid() {
  const { data, isPending, isError, error, refetch } = useAllowedModules()

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
        <Spinner />
        Loading modules…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <p className="text-sm text-muted-foreground">{normalizeFrappeError(error).message}</p>
        <Button variant="outline" className="h-10" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  // An admin can block every module for a user, so this is reachable — say why the page is
  // empty rather than rendering a blank grid.
  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <p className="text-sm font-medium text-foreground">No modules available</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account has no modules assigned. Contact your administrator.
        </p>
      </div>
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((module) => (
        <ModuleCard key={module.name} module={module} />
      ))}
    </ul>
  )
}
