import { Link } from 'react-router'

import { AppearanceMenu } from '@/shell/components/AppearanceMenu'
import { InstitutionMark } from '@/components/brand/InstitutionMark'
import { Kbd } from '@/components/controls/Kbd'
import { SearchIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { UserMenu } from '@/shell/components/UserMenu'
import { useInstitutionBranding } from '@/hooks/use-branding'
import { APP_NAME, ROUTES } from '@/lib/constants'
import { commandPaletteHint } from '@/lib/platform'
import { cn } from '@/lib/utils'
import { FALLBACK_MODULE_ICON, MODULE_ICONS } from '@/shell/lib/module-icons'
import type { RailModule } from '@/types/navigation'

/**
 * A wide sidebar listing modules BY NAME — the left column of the `topnav` and `stacked` shells.
 *
 * The rail's trade is the opposite one: 56px of glyphs buys the page 184px of width, and costs a
 * newcomer a guess per icon (which is why every rail tile has a tooltip). Here the width is spent
 * on the answer instead. Neither is better in the abstract — a registrar who lives in two modules
 * wants the rail, and someone learning the system wants this — which is exactly why both exist.
 *
 * Identity at the head, search under it, modules, then appearance and the account at the foot:
 * the same order as the rail, so switching layouts moves things sideways rather than reshuffling
 * them.
 */
export function ModuleSidebar({
  modules,
  isPending,
  activeModule,
  onOpenCommandPalette,
  onOpenShortcuts,
  children,
}: {
  modules: RailModule[]
  isPending: boolean
  activeModule: string | null
  onOpenCommandPalette: () => void
  onOpenShortcuts: () => void
  /** Rendered under the module list — the `stacked` shell puts each module's screens here. */
  children?: React.ReactNode
}) {
  const { data: branding } = useInstitutionBranding()
  const brand = branding?.institution ?? null
  const name = brand?.name ?? APP_NAME

  return (
    <div className="flex h-full w-(--sidebar-width) shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* h-13, matching every other head band in the app so the seam lands at one y. */}
      <div className="flex h-13 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
        <Link
          to={ROUTES.HOME}
          aria-label={name}
          title={name}
          className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 transition-colors duration-150 ease-out hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring motion-reduce:transition-none"
        >
          {/* Both mark AND name here, unlike the rail — a 240px column can carry the name, and
              the rail could not. This is the layout's whole premise applied to identity too. */}
          <InstitutionMark brand={brand} size="xs" surface="chrome" className="max-w-8 shrink-0 p-0.5" />
          <span className="truncate font-heading text-sm font-semibold text-sidebar-foreground">
            {name}
          </span>
        </Link>
      </div>

      <div className="px-2 pt-2">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          aria-label="Jump to a screen"
          className="flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent px-2 text-sm text-sidebar-foreground-muted transition-colors duration-150 ease-out hover:bg-sidebar-active hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring motion-reduce:transition-none"
        >
          <SearchIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Jump to…</span>
          {/* The shortcut is PRINTED here rather than hidden in a tooltip — there is room, and a
              visible hint teaches it to everyone rather than only to people who hover. */}
          <Kbd className="ml-auto shrink-0 border-sidebar-border text-sidebar-foreground-muted">
            {commandPaletteHint()}
          </Kbd>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        <nav aria-label="Modules" className="flex flex-col gap-0.5">
          {isPending
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 rounded-md bg-sidebar-accent" />
              ))
            : modules.map((m) => {
                const Icon = MODULE_ICONS[m.module] ?? FALLBACK_MODULE_ICON
                const current = m.module === activeModule
                return (
                  <Link
                    key={m.module}
                    to={`/${m.slug}`}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors duration-150 ease-out motion-reduce:transition-none',
                      'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sidebar-ring',
                      current
                        ? // The current module is a tint carrying a saturated label, not a solid
                          // fill: a full-width solid row at this width is a slab of colour, which
                          // is the same reason the rail's screen list never used one.
                          'bg-sidebar-active font-semibold text-sidebar-active-foreground'
                        : 'text-sidebar-foreground-muted hover:bg-sidebar-accent hover:text-sidebar-foreground',
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{m.label}</span>
                  </Link>
                )
              })}
        </nav>
        {children}
      </div>

      <div className="shrink-0 border-t border-sidebar-border p-2">
        <AppearanceMenu variant="row" />
        <UserMenu variant="row" onOpenShortcuts={onOpenShortcuts} />
      </div>
    </div>
  )
}
