import { ChevronRightIcon } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { EmptyState } from '@/components/feedback/EmptyState'
import { ScreenNotFound } from '@/components/feedback/ScreenNotFound'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBrandedDocument, useTrustBranding } from '@/hooks/use-branding'
import { useModuleMenu, useModuleRail } from '@/hooks/use-navigation'
import { normalizeFrappeError } from '@/lib/errors'
import type { MenuItem, ModuleMenu } from '@/types/navigation'
import { OrganizationOverview } from '@/shell/pages/OrganizationOverview'

/**
 * A module's overview: every screen inside it, as a directory in the content area.
 *
 * It is where a rail click or a home launch tile lands. It exists because the flyout menu is a
 * hover accelerator: without a clickable equivalent, a module's screens would be unreachable
 * on touch, and there would be nowhere for the rail's own links to go.
 *
 * It renders the SAME payload as the flyout (`get_module_menu`), so the two can never
 * disagree about what a user may open — including the workspace's Card Break grouping.
 */
export default function ModulePage() {
  const { moduleSlug } = useParams()
  const { data: brand } = useTrustBranding()
  const { data: modules, isPending: railPending } = useModuleRail()

  // The rail is the authority on which modules this user has, so the slug is resolved
  // against it rather than trusted from the URL. An unknown slug is a 404, not an API call.
  const railModule = modules?.find((m) => m.slug === moduleSlug) ?? null
  const menuQuery = useModuleMenu(railModule?.module ?? null)

  useBrandedDocument(railModule?.label ?? 'Modules', brand?.trust ?? null)

  if (railPending) return <PageSkeleton />

  if (!railModule) {
    return (
      <ScreenNotFound thing="Module" body="There is no module at this address, or it is not one of yours." />
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-(--page-gutter-x) py-(--page-gutter-y)">
      <header>
        <h1 className="font-heading text-2xl leading-snug font-semibold tracking-tight text-foreground">
          {menuQuery.data?.label ?? railModule.label}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {railModule.module === 'Master'
            ? 'Manage the Trust, campuses and institutions in one place.'
            : `Open a ${railModule.label} workspace.`}
        </p>
      </header>

      <div className="mt-(--page-stack)">
        {railModule.module === 'Master' ? (
          <OrganizationOverview />
        ) : (
          <ModuleBody query={menuQuery} label={railModule.label} />
        )}
      </div>
    </div>
  )
}

function ModuleBody({ query, label }: { query: ReturnType<typeof useModuleMenu>; label: string }) {
  const { data, isPending, isError, error, refetch } = query

  if (isPending) return <CardGridSkeleton />

  if (isError) {
    return (
      <EmptyState
        title="Screens unavailable"
        body={normalizeFrappeError(error).message}
        action={
          <Button className="h-10" onClick={() => void refetch()}>
            Try again
          </Button>
        }
      />
    )
  }

  const menu: ModuleMenu = data

  // The common case while modules are still being filled in, and also what a user without
  // permission on any of the module's doctypes sees.
  if (menu.groups.length === 0) {
    return <EmptyState title="No screens yet" body={`${label} has nothing you can access yet.`} />
  }

  return (
    <div className="flex flex-col gap-(--page-stack)">
      {menu.groups.map((group, gi) => (
        <section key={group.label ?? `group-${gi}`}>
          {group.label && (
            <h2 className="text-2xs font-medium tracking-eyebrow text-muted-foreground uppercase">
              {group.label}
            </h2>
          )}
          <div className="mt-2.5 grid gap-(--section-stack) sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((item) => (
              <ScreenCard key={`${item.link_type}:${item.link_to}`} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// `shadow-card`, not a hand-written `shadow-[0_1px_2px_rgb(15_23_42/0.06)]`. The literal was
// DESIGN.md's `shadow.sm` transcribed by hand, which meant it could not follow the token into
// dark mode — where a slate-tinted shadow on a near-black surface is invisible — and it was the
// one surface in the app not using the elevation scale.
const CARD_CLASS =
  'flex items-start gap-3 rounded-xl border border-border bg-card p-(--card-pad) text-left shadow-card'

/**
 * One screen in the directory.
 *
 * Deliberately no icon: every item here is a doctype list, so a per-card icon would be the
 * same glyph repeated across the grid — noise, not information. The label carries the meaning.
 */
function ScreenCard({ item }: { item: MenuItem }) {
  if (!item.route) {
    // Page and Report links have no SPA screen yet. Rendered as unavailable rather than
    // linked to a 404 — the same call the flyout menu makes.
    return (
      <div aria-disabled="true" className={`${CARD_CLASS} opacity-50`}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">Not available yet</p>
        </div>
      </div>
    )
  }

  return (
    <Link
      to={item.route}
      className={`${CARD_CLASS} group transition-colors duration-150 ease-out hover:border-primary/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {item.description}
          </p>
        )}
      </div>
      <ChevronRightIcon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </Link>
  )
}

function CardGridSkeleton() {
  return (
    <div className="grid gap-(--section-stack) sm:grid-cols-2 xl:grid-cols-3" role="status" aria-live="polite">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
      <span className="sr-only">Loading screens</span>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-(--page-gutter-x) py-(--page-gutter-y)">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-(--page-stack)">
        <CardGridSkeleton />
      </div>
    </div>
  )
}
