import { ChevronDownIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, useLocation } from 'react-router'

import { Button } from '@/shared/ui/button'
import { Sidebar, SidebarContent } from '@/shared/ui/sidebar'
import { Skeleton } from '@/shared/ui/skeleton'
import { useModuleMenu } from '@/shared/hooks/use-navigation'
import { cn } from '@/shared/lib/utils'
import { FALLBACK_MODULE_ICON, MODULE_ICONS } from '@/shell/lib/module-icons'
import type { MenuItem, RailModule } from '@/shared/types/navigation'

/**
 * Which module sections the user has collapsed, by Module Def name.
 *
 * Persisted because collapsing is a statement about how someone works ("I never touch Master"),
 * not a transient view state — re-expanding it on every page load would make the control
 * pointless. Read defensively: a hand-edited or half-written value must not take the shell down.
 */
const COLLAPSED_KEY = 'erp:nav:collapsed'

function readCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, boolean>)
      : {}
  } catch {
    return {}
  }
}

function writeCollapsed(next: Record<string, boolean>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next))
  } catch {
    // Private mode, or a full quota. The nav still works; only the memory is lost.
  }
}

/**
 * Is `pathname` inside `route`?
 *
 * Prefix match, not equality: a record route is /master/institution/SJC, and an exact test
 * would drop the mark the moment a record opens — the one time you most want to see where you
 * are. The trailing slash is load-bearing, or /master/institution would also light up on
 * /master/institution-type.
 */
function isCurrentRoute(pathname: string, route: string | null): boolean {
  return !!route && (pathname === route || pathname.startsWith(`${route}/`))
}

const ITEM_CLASS = cn(
  'relative flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] text-sidebar-foreground/75',
  'transition-colors duration-150 ease-out',
  'hover:bg-sidebar-accent hover:text-sidebar-foreground',
  'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
  'motion-reduce:transition-none',
)

/**
 * The current screen. A sapphire TINT plus a bright 2px bar, never a solid fill: a saturated
 * full-width row in a list of full-width rows turns the panel into a block of colour.
 *
 * --sidebar-indicator, not --sidebar-primary, for the bar: the primary sapphire is only
 * 2.21:1 against the active tint and would vanish into the row it is meant to be marking.
 */
const ITEM_CURRENT_CLASS = cn(
  'data-current:bg-sidebar-active data-current:font-medium data-current:text-sidebar-active-foreground',
  'data-current:before:absolute data-current:before:-left-1 data-current:before:h-4',
  'data-current:before:w-0.5 data-current:before:rounded-full',
  'data-current:before:bg-sidebar-indicator',
)

function NavItem({ item, pathname }: { item: MenuItem; pathname: string }) {
  // Page and Report links have no SPA page yet. Shown as unavailable rather than linked to a
  // 404 — the same call the flyout made.
  if (!item.route) {
    return (
      <span aria-disabled="true" className={cn(ITEM_CLASS, 'cursor-default opacity-50')}>
        <span className="truncate">{item.label}</span>
      </span>
    )
  }

  const current = isCurrentRoute(pathname, item.route)

  return (
    <Link
      to={item.route}
      aria-current={current ? 'page' : undefined}
      data-current={current || undefined}
      className={cn(ITEM_CLASS, ITEM_CURRENT_CLASS)}
    >
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

interface ModuleSectionProps {
  module: RailModule
  pathname: string
  collapsed: boolean
  onToggle: (module: string) => void
}

/**
 * One module: a header naming it, and every screen inside it.
 *
 * The header is two controls, not one. The label is a Link to the module's overview page —
 * which lists the same screens as cards — and the chevron is a button that folds the section
 * away. Merging them would force a choice between "clicking a module opens it" and "clicking a
 * module hides it", and both behaviours are ones people reach for.
 */
function ModuleSection({ module, pathname, collapsed, onToggle }: ModuleSectionProps) {
  // Subscribed per section rather than reading one combined list: a section has to be able to
  // tell "still loading" from "this menu failed", and a merged list that drops failures can
  // only ever report the first — leaving a broken module showing skeletons forever.
  const { data: menu, isPending, isError, refetch } = useModuleMenu(module.module)
  const Icon = MODULE_ICONS[module.module] ?? FALLBACK_MODULE_ICON
  const inModule = pathname === `/${module.slug}` || pathname.startsWith(`/${module.slug}/`)
  const listId = `module-nav-${module.slug}`

  return (
    <div className="px-2 pt-3 first:pt-1">
      <div className="flex items-center gap-1 pr-1 pl-1.5">
        <Link
          to={`/${module.slug}`}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1',
            'text-[10.5px] font-semibold tracking-[0.11em] uppercase',
            'transition-colors duration-150 ease-out',
            'hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
            'motion-reduce:transition-none',
            inModule ? 'text-sidebar-foreground' : 'text-sidebar-foreground/70',
          )}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{module.label}</span>
        </Link>
        <button
          type="button"
          onClick={() => onToggle(module.module)}
          aria-expanded={!collapsed}
          aria-controls={listId}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${module.label}`}
          className="grid size-6 shrink-0 place-items-center rounded-md text-sidebar-foreground/55 transition-colors duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none motion-reduce:transition-none"
        >
          <ChevronDownIcon
            className={cn(
              'size-3.5 transition-transform duration-150 ease-out motion-reduce:transition-none',
              collapsed && '-rotate-90',
            )}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* `hidden`, not unmounted: the section's items are the shell's whole navigation, and an
          unmount would throw away the DOM on every toggle for a list of at most a dozen links. */}
      <div id={listId} hidden={collapsed} className="mt-0.5 flex flex-col gap-px">
        {isPending ? (
          <div className="flex flex-col gap-1 px-1 py-1">
            {Array.from({ length: 3 }).map((_, i) => (
              // bg-sidebar-accent, not Skeleton's default bg-accent — that is a LIGHT token
              // and would glow on the dark rail.
              <Skeleton key={i} className="h-5 w-full bg-sidebar-accent" />
            ))}
            <span className="sr-only">Loading {module.label} menu</span>
          </div>
        ) : isError || !menu ? (
          <div className="px-2.5 py-1.5">
            <p className="text-xs text-sidebar-foreground/60">Screens unavailable</p>
            {/* Every Button variant is tuned for light surfaces — `outline` is bg-background,
                which reads as a white blob on --sidebar. Styled per-use rather than adding a
                variant for one call site. */}
            <Button
              size="sm"
              onClick={() => void refetch()}
              className="mt-1.5 h-6 border border-sidebar-border bg-transparent px-2 text-xs text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              Try again
            </Button>
          </div>
        ) : menu.groups.length === 0 ? (
          // Reachable today: a user without permission on a module's doctypes, and a module
          // whose workspace has no link rows yet.
          <p className="px-2.5 py-1.5 text-xs text-sidebar-foreground/50">Nothing you can open yet</p>
        ) : (
          menu.groups.map((group, gi) => (
            <div key={group.label ?? `group-${gi}`} className="flex flex-col gap-px">
              {/* The workspace's own Card Break. Rendered only when it is labelled AND the
                  module has more than one group — a lone sub-heading under a module heading
                  says nothing the module heading did not already say. */}
              {group.label && menu.groups.length > 1 && (
                /* /60, not /40: /40 composites to ~3.2:1 on --sidebar and fails the 4.5:1
                   bar DESIGN.md sets for text. Uppercase and tracked so it reads as a label
                   rather than a link one indent to the left. */
                <p className="mt-1.5 px-2.5 pb-0.5 text-[10px] font-semibold tracking-[0.1em] uppercase text-sidebar-foreground/60">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => (
                <NavItem key={`${item.link_type}:${item.link_to}`} item={item} pathname={pathname} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

interface ModuleNavProps {
  modules: RailModule[]
  isPending: boolean
}

/**
 * The module navigation — every module and every screen inside it, always on screen.
 *
 * This replaces the 72px icon rail whose menu flew out on hover. The flyout was an accelerator
 * that had become the only place a screen's *name* appeared: the rail showed icons, so finding
 * "Admission Enquiry" meant hovering a module and reading a panel that overlaid the page. For
 * someone who opens the same screen forty times a day, the 144px this costs is cheaper than
 * that hover — and it removes the hover-timing logic, the panel's stacking-context fight with
 * sticky table headers, and the touch-device gap the module overview page existed to cover.
 *
 * The overview page stays: every module label here links to it, and it still lists the same
 * screens as cards. Nothing in this app is reachable only one way.
 *
 * Menus come from the same permission-filtered `get_module_menu` payload the command palette
 * and the overview page read, already warmed by `usePrefetchModuleMenus`, so sections resolve
 * without a visible skeleton in the common case.
 */
export function ModuleNav({ modules, isPending }: ModuleNavProps) {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const toggle = useCallback((module: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [module]: !prev[module] }
      writeCollapsed(next)
      return next
    })
  }, [])

  return (
    // Three flex facts, all load-bearing.
    //
    //   shrink-0 — `width` alone does not stop a flex item shrinking to its content, which
    //     leaves a ragged gap beside it.
    //   h-auto — Sidebar's own base class is `h-full`, and this column's parent gets its
    //     height from `flex-1`, i.e. its SPECIFIED height is auto. A percentage height cannot
    //     resolve against that, so `h-full` collapsed to the content height and the page's
    //     ground showed through below the last link. Measured at 791px against an 848px row.
    //   self-stretch — what actually fills the row once the height is auto.
    <Sidebar
      collapsible="none"
      className="h-auto w-(--sidebar-width)! shrink-0 self-stretch border-r border-sidebar-border"
    >
      <SidebarContent className="gap-0 pb-4">
        <nav aria-label="Modules">
          {isPending
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-3 pt-3 first:pt-2">
                  <Skeleton className="h-3 w-20 bg-sidebar-accent" />
                  <div className="mt-2 flex flex-col gap-1">
                    {Array.from({ length: 3 }).map((__, j) => (
                      <Skeleton key={j} className="h-5 w-full bg-sidebar-accent" />
                    ))}
                  </div>
                </div>
              ))
            : modules.map((module) => (
                <ModuleSection
                  key={module.module}
                  module={module}
                  pathname={location.pathname}
                  collapsed={!!collapsed[module.module]}
                  onToggle={toggle}
                />
              ))}
        </nav>
      </SidebarContent>
    </Sidebar>
  )
}
