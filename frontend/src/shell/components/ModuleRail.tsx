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
// One device per state, not three. The current module used to be a 48px block of saturated
// sapphire carrying an inset highlight AND a white bar, while a previewed one carried a second
// bar in a different colour — four decorations for two states, on the narrowest surface in the
// app. Now: where you ARE is a sapphire tint plus one indicator bar; what you are LOOKING AT is
// a neutral lift and nothing else. The tint is what DESIGN.md prescribes for a current row
// anyway, so the rail and the flyout's current item finally read the same.
const BASE_CLASS = cn(
  'relative grid size-9 place-items-center rounded-md text-sidebar-foreground/70',
  'transition-colors duration-150 ease-out',
  'hover:bg-sidebar-accent hover:text-sidebar-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
  // ring-offset against --sidebar: without it the ring blurs into the dark surface.
  'focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
  'active:bg-sidebar-accent',
)

/**
 * The module you are in.
 *
 * A tint, not a fill, and the one bar in the rail. --sidebar-indicator rather than
 * --sidebar-primary: the primary sapphire is only 2.21:1 against the tint and would vanish
 * into the row it is marking, where the indicator holds 4.66:1.
 *
 * The bar is why the tint is enough — "never use colour as the only way to convey meaning".
 */
const CURRENT_CLASS = cn(
  'data-[current=true]:bg-sidebar-active data-[current=true]:text-sidebar-foreground',
  // -left-2.5 is 10px, exactly the gutter beside a 36px icon in a 56px rail, so the bar sits
  // flush against the rail's edge rather than floating in the gap.
  'data-[current=true]:before:absolute data-[current=true]:before:-left-2.5',
  'data-[current=true]:before:h-5 data-[current=true]:before:w-0.5',
  'data-[current=true]:before:rounded-full data-[current=true]:before:bg-sidebar-indicator',
)

/** Previewed in the flyout. A neutral lift — a look, not a location, so it gets no marker. */
const DISCLOSED_CLASS = 'data-[disclosed=true]:bg-sidebar-accent data-[disclosed=true]:text-sidebar-foreground'

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
 * The 56px module rail — the only navigation chrome that is always on screen.
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
 * `group-data-[collapsible=icon]:size-8!` — that would silently resize them inside a
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
                <Skeleton key={i} className="size-9 rounded-md bg-sidebar-accent" />
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
                    <Icon className="size-4" aria-hidden="true" />
                  </Link>
                )
              })}
        </nav>
      </SidebarContent>
    </Sidebar>
  )
}
