import { LayoutGridIcon } from 'lucide-react'
import { Link } from 'react-router'

import { Sidebar, SidebarContent, SidebarSeparator } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ROUTES } from '@/lib/constants'
import { FALLBACK_MODULE_ICON, MODULE_ICONS } from '@/lib/module-icons'
import { cn } from '@/lib/utils'
import type { RailModule } from '@/types/shell'

const ITEM_CLASS = cn(
  'relative grid size-12 place-items-center rounded-lg text-sidebar-foreground/70',
  'transition-colors duration-150 ease-out',
  'hover:bg-sidebar-accent hover:text-sidebar-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
  // ring-offset against --sidebar: without it the ring blurs into the dark surface.
  'focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
  'active:bg-sidebar-accent',
  'data-[selected=true]:bg-sidebar-primary data-[selected=true]:text-sidebar-primary-foreground',
  // A 2px bar, not colour alone — "never use colour as the only way to convey meaning".
  'data-[selected=true]:before:absolute data-[selected=true]:before:-left-2.5',
  'data-[selected=true]:before:h-6 data-[selected=true]:before:w-0.5',
  'data-[selected=true]:before:rounded-full data-[selected=true]:before:bg-sidebar-primary-foreground',
)

interface ModuleRailProps {
  modules: RailModule[]
  isPending: boolean
  selectedModule: string | null
  onSelect: (module: string) => void
  homeActive: boolean
}

/**
 * The 72px module rail.
 *
 * Items are hand-built rather than `SidebarMenuButton`, whose cva carries
 * `group-data-[collapsible=icon]:size-8!` — the rail lives inside the collapsible group, so
 * its buttons would silently shrink 48→32px whenever the panel collapses. The rail must
 * look identical in both states.
 */
export function ModuleRail({ modules, isPending, selectedModule, onSelect, homeActive }: ModuleRailProps) {
  return (
    // shrink-0 is load-bearing. The rail and the panel are flex siblings, so when the
    // sidebar collapses to 72px they both compete for that space and the rail gets shrunk
    // to its content (~49px), leaving a ragged gap. `width` alone does not stop a flex item
    // shrinking. shadcn's own demo hides this because its icon width happens to equal the
    // collapsed container width; ours is 72px, so it shows.
    <Sidebar
      collapsible="none"
      className="w-[calc(var(--sidebar-width-icon)+1px)]! shrink-0 border-r border-sidebar-border"
    >
      <SidebarContent className="items-center gap-1 py-3">
        <nav aria-label="Modules" className="flex flex-col items-center gap-1">
          {/* The only rail item that navigates — Home is a page, not a module. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={ROUTES.DASHBOARD}
                aria-label="Home"
                aria-current={homeActive ? 'page' : undefined}
                data-selected={homeActive}
                className={ITEM_CLASS}
              >
                <LayoutGridIcon className="size-5" aria-hidden="true" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Home</TooltipContent>
          </Tooltip>

          <SidebarSeparator className="my-1 w-8 bg-sidebar-border" />

          {isPending
            ? Array.from({ length: 3 }).map((_, i) => (
                // bg-sidebar-accent, not Skeleton's default bg-accent — that's a LIGHT
                // token and would glow on the dark rail.
                <Skeleton key={i} className="size-12 rounded-lg bg-sidebar-accent" />
              ))
            : modules.map((m) => {
                const Icon = MODULE_ICONS[m.module] ?? FALLBACK_MODULE_ICON
                const selected = m.module === selectedModule
                return (
                  <Tooltip key={m.module}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={m.label}
                        aria-controls="module-menu"
                        aria-expanded={selected}
                        // Not aria-current="page" — selecting a module discloses its menu,
                        // it does not navigate.
                        data-selected={selected}
                        onClick={() => onSelect(m.module)}
                        className={ITEM_CLASS}
                      >
                        <Icon className="size-5" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-56">
                      {m.label}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
        </nav>
      </SidebarContent>
    </Sidebar>
  )
}
