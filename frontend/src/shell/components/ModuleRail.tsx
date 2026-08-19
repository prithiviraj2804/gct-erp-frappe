import { Link } from 'react-router'

import { Sidebar, SidebarContent } from '@/shared/ui/sidebar'
import { Skeleton } from '@/shared/ui/skeleton'
import { FALLBACK_MODULE_ICON, MODULE_ICONS } from '@/shell/lib/module-icons'
import { cn } from '@/shared/lib/utils'
import type { RailModule } from '@/shared/types/navigation'

// The rail carries two DIFFERENT states, and they must not share one style:
//
//   - The module the URL is in. That is where you ARE.
//   - The module the flyout is currently PREVIEWING, because the pointer is on its icon or
//     focus has landed there. That is a look-ahead, not a location — you have not moved.
//
// The palette's rule: a sapphire FILL means "you are here", a sapphire BAR means "this is
// marked". The current module gets the fill; a previewed one gets a neutral lift and the bar.
// AppShell makes the two mutually exclusive, so a previewed current module keeps its fill.
const BASE_CLASS = cn(
  'relative grid size-12 place-items-center rounded-lg text-sidebar-foreground/70',
  'transition-colors duration-150 ease-out',
  'hover:bg-sidebar-accent hover:text-sidebar-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
  // ring-offset against --sidebar: without it the ring blurs into the dark surface.
  'focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
  'active:bg-sidebar-accent',
  // A 2px bar, not colour alone — "never use colour as the only way to convey meaning".
  'data-[marked=true]:before:absolute data-[marked=true]:before:-left-2.5',
  'data-[marked=true]:before:h-6 data-[marked=true]:before:w-0.5',
  'data-[marked=true]:before:rounded-full',
)

/** The module you are in. Solid sapphire — the rail's one anchor. */
const CURRENT_CLASS = cn(
  'data-[current=true]:bg-sidebar-primary data-[current=true]:text-sidebar-primary-foreground',
  // A 1px inset top highlight catches the "light" the hairline borders imply, so a 48px
  // block of flat colour doesn't read as a sticker.
  'data-[current=true]:shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]',
  // White, not --sidebar-indicator: the square is already sapphire, so a sapphire bar
  // beside it would be the same colour twice instead of a marker.
  'data-[current=true]:before:bg-sidebar-primary-foreground',
)

/** Previewed in the flyout. Neutral lift plus the sapphire bar — a relation, not a location. */
const DISCLOSED_CLASS = cn(
  'data-[disclosed=true]:bg-sidebar-accent data-[disclosed=true]:text-sidebar-foreground',
  'data-[disclosed=true]:before:bg-sidebar-indicator',
)

interface ModuleRailProps {
  modules: RailModule[]
  isPending: boolean
  /** Module Def name the URL is inside, or null on a non-module route. */
  activeModule: string | null
  /** Module Def name whose menu is on screen right now. Null whenever the flyout is closed. */
  disclosedModule: string | null
  /** Pointer or focus landed on a module — ask the shell to preview it. */
  onPreview: (module: string) => void
}

/**
 * The 72px module rail — the only navigation chrome that is always on screen.
 *
 * Every item is a Link: clicking a module goes to its overview page, which lists the same
 * items the flyout does. That is what makes the shell usable without a pointer — hover is an
 * accelerator here, never the only route to a screen.
 *
 * There is no Home item. The topbar's institution mark links to `/home` — the convention a logo
 * in that position always carries — so a rail button for the dashboard would only duplicate it.
 * The rail stays what it is: the list of modules, nothing else.
 *
 * Items are hand-built rather than `SidebarMenuButton`, whose cva carries
 * `group-data-[collapsible=icon]:size-8!` — that would silently shrink them 48→32px inside a
 * collapsible group. The rail must look identical in every state.
 */
export function ModuleRail({
  modules,
  isPending,
  activeModule,
  disclosedModule,
  onPreview,
}: ModuleRailProps) {
  return (
    // shrink-0 is load-bearing: the rail is a flex item and `width` alone does not stop a
    // flex item shrinking to its content (~49px), which leaves a ragged gap beside it.
    <Sidebar
      collapsible="none"
      className="h-full w-(--sidebar-width-icon)! shrink-0 border-r border-sidebar-border"
    >
      <SidebarContent className="items-center gap-1 py-3">
        <nav aria-label="Modules" className="flex flex-col items-center gap-1">
          {isPending
            ? Array.from({ length: 3 }).map((_, i) => (
                // bg-sidebar-accent, not Skeleton's default bg-accent — that's a LIGHT
                // token and would glow on the dark rail.
                <Skeleton key={i} className="size-12 rounded-lg bg-sidebar-accent" />
              ))
            : modules.map((m) => {
                const Icon = MODULE_ICONS[m.module] ?? FALLBACK_MODULE_ICON
                const current = m.module === activeModule
                const disclosed = !current && m.module === disclosedModule
                return (
                  <Link
                    key={m.module}
                    to={`/${m.slug}`}
                    // The icon is aria-hidden, so this is the item's whole accessible name.
                    aria-label={m.label}
                    aria-current={current ? 'page' : undefined}
                    data-current={current}
                    data-disclosed={disclosed}
                    data-marked={current || disclosed}
                    // Pointer only, deliberately. The flyout sits AFTER the rail in DOM
                    // order, so previewing on focus too would be a dead end: tabbing off
                    // one module lands on the next, which would swap the panel before you
                    // could ever tab into it — leaving every module's menu unreachable by
                    // keyboard except the last one's.
                    //
                    // So focus opens the flyout (see AppShell's wrapper) without changing
                    // what it shows: a keyboard user tabs the rail, then tabs into the menu
                    // for the module they are actually in. Looking ahead into a module they
                    // are NOT in is what its overview page is for, one Enter away.
                    onMouseEnter={() => onPreview(m.module)}
                    className={cn(BASE_CLASS, CURRENT_CLASS, DISCLOSED_CLASS)}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </Link>
                )
              })}
        </nav>
      </SidebarContent>
    </Sidebar>
  )
}
